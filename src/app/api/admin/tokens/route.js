import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(req) {
  const token = req.headers.get('authorization')?.replace('Bearer ', '')
  if (!token) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const supabase = createAdminClient()
  const { data: { user } } = await supabase.auth.getUser(token)
  if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

  const { data: adminProfile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()
  if (!adminProfile?.is_admin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { userId, amount } = await req.json()
  if (!userId || typeof amount !== 'number' || amount === 0) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('tokens')
    .eq('id', userId)
    .single()

  const newTokens = Math.max(0, (targetProfile?.tokens ?? 0) + amount)

  await supabase.from('profiles').update({ tokens: newTokens }).eq('id', userId)

  await supabase.from('token_transactions').insert({
    user_id:    userId,
    amount,
    reason:     amount > 0 ? `Admin credit (+${amount})` : `Admin debit (${amount})`,
    created_by: user.id,
  })

  return NextResponse.json({ ok: true, newTokens })
}
