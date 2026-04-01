import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function DELETE(req) {
  try {
    const token    = req.headers.get('authorization')?.replace('Bearer ', '')
    const supabase = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    // Delete all photos from storage
    const { data: photos } = await supabase
      .from('photos').select('storage_path').eq('user_id', user.id)
    const paths = (photos || []).map(p => p.storage_path).filter(Boolean)
    if (paths.length) await supabase.storage.from('photos').remove(paths)

    // Delete all ZIPs from storage
    const { data: jobs } = await supabase
      .from('jobs').select('id').eq('user_id', user.id)
    for (const job of jobs || []) {
      const { data: zipFiles } = await supabase.storage
        .from('photos').list(`${user.id}/${job.id}`)
      if (zipFiles?.length) {
        await supabase.storage.from('photos').remove(
          zipFiles.map(f => `${user.id}/${job.id}/${f.name}`)
        )
      }
    }

    // Delete database records (photos cascade from jobs)
    await supabase.from('jobs').delete().eq('user_id', user.id)
    await supabase.from('profiles').delete().eq('id', user.id)

    // Delete the auth user itself
    await supabase.auth.admin.deleteUser(user.id)

    return NextResponse.json({ success: true })
  } catch (e) {
    console.error('Delete account error:', e.message)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
