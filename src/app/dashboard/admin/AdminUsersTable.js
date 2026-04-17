'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

const TIER_LIMITS  = { free: 50, basic: 500, pro: 5000, fleet: 99999 }
const TIER_OPTIONS = ['free', 'basic', 'pro', 'fleet']
const TIER_COLOURS = {
  free:  'bg-gray-100 text-gray-600',
  basic: 'bg-blue-50 text-blue-700',
  pro:   'bg-[#C8102E]/10 text-[#C8102E]',
  fleet: 'bg-[#1A1A1A] text-[#F5C518]',
}

export default function AdminUsersTable({ initialUsers }) {
  const [users, setUsers]       = useState(initialUsers)
  const [amounts, setAmounts]   = useState({})
  const [adjusting, setAdjusting] = useState({})
  const [tierChanging, setTierChanging] = useState({})
  const [messages, setMessages] = useState({})

  async function getToken() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
  }

  async function changeTier(userId, tier) {
    setTierChanging(p => ({ ...p, [userId]: true }))
    setMessages(p => ({ ...p, [userId]: '' }))
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/set-tier', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, tier }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, subscription_tier: tier, tokens_used: 0 } : u))
      setMessages(p => ({ ...p, [userId]: `✓ Tier set to ${tier}` }))
    } catch (e) {
      setMessages(p => ({ ...p, [userId]: `⚠ ${e.message}` }))
    } finally {
      setTierChanging(p => ({ ...p, [userId]: false }))
    }
  }

  async function adjustTokens(userId, rawAmount) {
    const amount = parseInt(rawAmount)
    if (!amount || isNaN(amount)) return
    setAdjusting(p => ({ ...p, [userId]: true }))
    setMessages(p => ({ ...p, [userId]: '' }))
    try {
      const token = await getToken()
      const res = await fetch('/api/admin/tokens', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, amount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, tokens: data.newTokens } : u))
      setAmounts(p => ({ ...p, [userId]: '' }))
      setMessages(p => ({ ...p, [userId]: `✓ Done — ${data.newTokens} legacy tokens` }))
    } catch (e) {
      setMessages(p => ({ ...p, [userId]: `⚠ ${e.message}` }))
    } finally {
      setAdjusting(p => ({ ...p, [userId]: false }))
    }
  }

  return (
    <div className="card divide-y divide-gray-100">
      {/* Column headers */}
      <div className="py-2 px-1 hidden sm:grid grid-cols-[1fr_120px_160px_180px] gap-3 items-center">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">User</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Plan</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Usage this month</span>
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Actions</span>
      </div>

      {users.map(u => {
        const tier      = u.subscription_tier ?? 'free'
        const limit     = TIER_LIMITS[tier] ?? 50
        const used      = u.tokens_used ?? 0
        const remaining = Math.max(0, limit - used)
        const pct       = Math.min(100, Math.round((used / limit) * 100))

        return (
          <div key={u.id} className="py-3 space-y-2">
            <div className="flex items-start gap-3 flex-wrap">
              {/* User info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{u.email}</p>
                <p className="text-xs text-gray-400">
                  Joined {new Date(u.created_at).toLocaleDateString('en-GB')}
                  {u.is_admin ? ' · Admin' : ''}
                </p>
                {messages[u.id] && (
                  <p className={`text-xs mt-0.5 ${messages[u.id].startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
                    {messages[u.id]}
                  </p>
                )}
              </div>

              {/* Tier selector */}
              <div className="flex items-center gap-2 flex-shrink-0">
                <select
                  value={tier}
                  onChange={e => changeTier(u.id, e.target.value)}
                  disabled={tierChanging[u.id]}
                  className="border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#C8102E] disabled:opacity-50">
                  {TIER_OPTIONS.map(t => (
                    <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                  ))}
                </select>
                {tierChanging[u.id] && <span className="text-xs text-gray-400">…</span>}
              </div>
            </div>

            {/* Token usage bar */}
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>{used.toLocaleString()} / {limit >= 99999 ? '∞' : limit.toLocaleString()} photos</span>
                <span className={remaining === 0 ? 'text-red-500 font-medium' : ''}>{remaining.toLocaleString()} left</span>
              </div>
              {limit < 99999 && (
                <div className="w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                  <div
                    className={`h-full rounded-full ${pct >= 90 ? 'bg-red-400' : pct >= 70 ? 'bg-amber-400' : 'bg-[#C8102E]'}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              )}
            </div>
          </div>
        )
      })}
      {users.length === 0 && (
        <p className="py-6 text-sm text-gray-400 text-center">No users found</p>
      )}
    </div>
  )
}
