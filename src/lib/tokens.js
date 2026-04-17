import { createAdminClient } from '@/lib/supabase-server'

export const TIER_LIMITS = {
  free:  50,
  basic: 500,
  pro:   5000,
  fleet: 99999,
}

export async function getUserTokenStatus(userId) {
  const supabase = createAdminClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('subscription_tier, tokens_used, tokens_reset_at')
    .eq('id', userId)
    .single()

  if (error || !profile) throw new Error('Could not fetch profile')

  const tier = profile.subscription_tier ?? 'free'
  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free

  const resetAt = new Date(profile.tokens_reset_at)
  const now = new Date()
  if (now >= resetAt) {
    const nextReset = new Date(now.getFullYear(), now.getMonth() + 1, 1)
    await supabase
      .from('profiles')
      .update({ tokens_used: 0, tokens_reset_at: nextReset.toISOString() })
      .eq('id', userId)
    return { tier, used: 0, limit, remaining: limit, resetAt: nextReset }
  }

  const used = profile.tokens_used ?? 0
  return {
    tier,
    used,
    limit,
    remaining: Math.max(0, limit - used),
    resetAt,
  }
}

export async function deductTokens(userId, count = 1) {
  const supabase = createAdminClient()
  const status = await getUserTokenStatus(userId)
  if (status.remaining < count) return false
  const { error } = await supabase
    .from('profiles')
    .update({ tokens_used: status.used + count })
    .eq('id', userId)
  return !error
}

export async function checkTokensAvailable(userId, count = 1) {
  const status = await getUserTokenStatus(userId)
  return status.remaining >= count
}
