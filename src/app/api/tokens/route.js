import { NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase-server'
import { getUserTokenStatus } from '@/lib/tokens'

export async function GET(req) {
  try {
    const token = req.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const supabase = createAdminClient()
    const { data: { user } } = await supabase.auth.getUser(token)
    if (!user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })

    const status = await getUserTokenStatus(user.id)

    return NextResponse.json({
      tier:        status.tier,
      used:        status.used,
      limit:       status.limit,
      remaining:   status.remaining,
      resetAt:     status.resetAt,
      percentUsed: Math.round((status.used / status.limit) * 100),
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
