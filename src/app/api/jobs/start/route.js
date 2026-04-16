import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { photoQueue } from '@/lib/queue'

export async function POST(req) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const supabase = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { jobId } = await req.json()

    const { data: job } = await supabase
      .from('jobs')
      .select('id, user_id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const { data: photos } = await supabase
      .from('photos')
      .select('id, storage_path, original_name')
      .eq('job_id', jobId)

    // Check token balance
    const { data: profile } = await supabase
      .from('profiles')
      .select('tokens')
      .eq('id', user.id)
      .single()

    const available = profile?.tokens ?? 0
    const required  = photos.length

    if (available < required) {
      await supabase.from('jobs').update({ status: 'failed' }).eq('id', jobId)
      return NextResponse.json(
        { error: `Not enough tokens. You have ${available} but need ${required}.`, tokens: available, required },
        { status: 402 }
      )
    }

    // Deduct tokens
    await supabase
      .from('profiles')
      .update({ tokens: available - required })
      .eq('id', user.id)

    await supabase.from('token_transactions').insert({
      user_id:  user.id,
      amount:   -required,
      reason:   `Job ${jobId} — ${required} photo${required !== 1 ? 's' : ''}`,
    })

    await supabase
      .from('jobs')
      .update({ status: 'processing' })
      .eq('id', jobId)

    for (const photo of photos) {
      await photoQueue.add('process-photo', {
        photoId:      photo.id,
        jobId,
        userId:       user.id,
        storagePath:  photo.storage_path,
        originalName: photo.original_name,
      }, { jobId: photo.id })
    }

    await photoQueue.add('finish-job', { jobId, userId: user.id, total: photos.length },
      { delay: 1000, priority: 10 })

    return NextResponse.json({ ok: true, queued: photos.length })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
