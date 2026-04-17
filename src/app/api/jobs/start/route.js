import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { photoQueue, batchQueue } from '@/lib/queue'
import { getUserTokenStatus } from '@/lib/tokens'

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

    const required = photos.length

    // Check subscription token balance
    const tokenStatus = await getUserTokenStatus(user.id)

    if (tokenStatus.remaining < required) {
      await supabase.from('jobs').update({ status: 'failed' }).eq('id', jobId)
      return NextResponse.json(
        {
          error: 'INSUFFICIENT_TOKENS',
          message: `You have ${tokenStatus.remaining} tokens remaining but tried to process ${required} photos.`,
          remaining: tokenStatus.remaining,
          tier: tokenStatus.tier,
          upgradeUrl: '/pricing',
        },
        { status: 402 }
      )
    }

    const tier = tokenStatus.tier

    await supabase
      .from('jobs')
      .update({ status: 'processing' })
      .eq('id', jobId)

    // Route large uploads to the Batch API queue (50% cheaper, async)
    if (required >= 200) {
      const { data: userProfile } = await supabase
        .from('profiles').select('email').eq('id', user.id).single()

      await batchQueue.add('batch-job', {
        userId:      user.id,
        jobId,
        tier,
        imageRefs:   photos.map(p => p.storage_path),
        fileNames:   photos.map(p => p.original_name),
        notifyEmail: userProfile?.email || user.email,
      })

      return NextResponse.json({
        mode:     'batch',
        message:  `Processing ${required} photos. We'll email you when done — usually within an hour.`,
        jobCount: required,
      })
    }

    // Standard queue — real-time processing
    for (const photo of photos) {
      await photoQueue.add('process-photo', {
        photoId:      photo.id,
        jobId,
        userId:       user.id,
        tier,
        storagePath:  photo.storage_path,
        originalName: photo.original_name,
      }, { jobId: photo.id })
    }

    await photoQueue.add('finish-job', { jobId, userId: user.id, total: required },
      { delay: 1000, priority: 10 })

    return NextResponse.json({
      ok:     true,
      queued: required,
      mode:   required >= 10 ? 'queued' : 'realtime',
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
