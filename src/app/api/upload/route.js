import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const supabase = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const form  = await req.formData()
    const jobId = form.get('jobId')
    const files = form.getAll('photos')

    // Verify job belongs to user
    const { data: job } = await supabase
      .from('jobs')
      .select('id')
      .eq('id', jobId)
      .eq('user_id', user.id)
      .single()
    if (!job) return NextResponse.json({ error: 'Job not found' }, { status: 404 })

    const saved = []

    for (const file of files) {
      const bytes       = await file.arrayBuffer()
      const buffer      = Buffer.from(bytes)
      const ext         = file.name.split('.').pop().toLowerCase()
      const storagePath = `${user.id}/${jobId}/${crypto.randomUUID()}.${ext}`

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('photos')
        .upload(storagePath, buffer, {
          contentType: file.type || 'image/jpeg',
          upsert: false
        })

      if (uploadError) {
        console.error('Storage upload error:', uploadError)
        continue
      }

      // Create photo record in DB
      const { data: photoRow } = await supabase
        .from('photos')
        .insert({
          job_id:        jobId,
          user_id:       user.id,
          original_name: file.name,
          storage_path:  storagePath,
          status:        'pending'
        })
        .select()
        .single()

      saved.push(photoRow.id)
    }

    return NextResponse.json({ saved: saved.length })
  } catch (e) {
    console.error('Upload error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
