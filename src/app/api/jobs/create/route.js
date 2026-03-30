import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(req) {
  try {
    const authHeader = req.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    // Verify user
    const supabase = createAdminClient()
    const { data: { user }, error } = await supabase.auth.getUser(token)
    if (error || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { total } = await req.json()

    const { data: job, error: jobError } = await supabase
      .from('jobs')
      .insert({ user_id: user.id, total, status: 'pending', processed: 0, found: 0 })
      .select()
      .single()

    if (jobError) throw jobError

    return NextResponse.json({ jobId: job.id })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
