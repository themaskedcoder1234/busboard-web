'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function AdminUsersTable({ initialUsers }) {
  const [users, setUsers]       = useState(initialUsers)
  const [amounts, setAmounts]   = useState({})
  const [adjusting, setAdjusting] = useState({})
  const [messages, setMessages] = useState({})

  async function getToken() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token
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
      setMessages(p => ({ ...p, [userId]: `✓ Done — ${data.newTokens} tokens` }))
    } catch (e) {
      setMessages(p => ({ ...p, [userId]: `⚠ ${e.message}` }))
    } finally {
      setAdjusting(p => ({ ...p, [userId]: false }))
    }
  }

  return (
    <div className="card divide-y divide-gray-100">
      {users.map(u => (
        <div key={u.id} className="py-3 flex items-start gap-3 flex-wrap">
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{u.email}</p>
            <p className="text-xs text-gray-400">
              Joined {new Date(u.created_at).toLocaleDateString()}
              {u.is_admin ? ' · Admin' : ''}
            </p>
            {messages[u.id] && (
              <p className={`text-xs mt-0.5 ${messages[u.id].startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>
                {messages[u.id]}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <span className={`text-sm font-bold tabular-nums min-w-[5rem] text-right ${u.tokens > 0 ? 'text-[#C8102E]' : 'text-gray-400'}`}>
              {u.tokens} tokens
            </span>
            <input
              type="number"
              placeholder="±amount"
              value={amounts[u.id] || ''}
              onChange={e => setAmounts(p => ({ ...p, [u.id]: e.target.value }))}
              className="w-24 border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-[#C8102E]"
            />
            <button
              onClick={() => adjustTokens(u.id, amounts[u.id])}
              disabled={adjusting[u.id] || !amounts[u.id]}
              className="btn-red text-xs px-3 py-1.5 disabled:opacity-40 disabled:cursor-not-allowed">
              {adjusting[u.id] ? '…' : 'Apply'}
            </button>
          </div>
        </div>
      ))}
      {users.length === 0 && (
        <p className="py-6 text-sm text-gray-400 text-center">No users found</p>
      )}
    </div>
  )
}
