import { NextResponse } from 'next/server'
import { createClient, createAdminClient } from '@/lib/supabase-server'

const VALID_TIERS = ['free', 'basic', 'pro', 'fleet']

export async function POST(req) {
  try {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const { data: profile } = await supabase
      .from('profiles').select('is_admin').eq('id', user.id).single()
    if (!profile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

    const { userId, tier } = await req.json()
    if (!userId || !VALID_TIERS.includes(tier)) {
      return NextResponse.json({ error: 'Invalid userId or tier' }, { status: 400 })
    }

    const admin = createAdminClient()
    const { error } = await admin
      .from('profiles')
      .update({ subscription_tier: tier, tokens_used: 0 })
      .eq('id', userId)

    if (error) throw error

    return NextResponse.json({ ok: true, tier })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
