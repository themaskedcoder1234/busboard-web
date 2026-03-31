import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function GET(req, { params }) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const supabase = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { data: job } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', params.id)
      .eq('user_id', user.id)
      .single()

    if (!job) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    // If job is complete but zip_url is missing or expired, regenerate it
    if (job.status === 'complete' && !job.zip_url) {
      const zipPath = `${user.id}/${job.id}/busboard-renamed.zip`
      const { data: signedUrl } = await supabase.storage
        .from('photos')
        .createSignedUrl(zipPath, 60 * 60 * 24 * 7)

      if (signedUrl?.signedUrl) {
        await supabase.from('jobs').update({ zip_url: signedUrl.signedUrl }).eq('id', job.id)
        job.zip_url = signedUrl.signedUrl
      }

      console.log('Regenerated zip_url:', job.zip_url)
    }

    console.log('Job status:', job.status, '| zip_url:', job.zip_url?.slice(0, 80))
    return NextResponse.json(job)
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
