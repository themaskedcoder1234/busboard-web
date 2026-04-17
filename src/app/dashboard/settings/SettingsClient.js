'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'
import Link from 'next/link'

const TIER_INFO = {
  free:  { label: 'Free',  colour: 'bg-gray-100 text-gray-700',        price: '£0/mo',   model: 'Haiku',          escalation: false },
  basic: { label: 'Basic', colour: 'bg-blue-50 text-blue-700',          price: '£8/mo',   model: 'Haiku',          escalation: false },
  pro:   { label: 'Pro',   colour: 'bg-[#C8102E]/10 text-[#C8102E]',   price: '£19/mo',  model: 'Haiku + Sonnet', escalation: true  },
  fleet: { label: 'Fleet', colour: 'bg-[#1A1A1A] text-[#F5C518]',       price: '£49/mo',  model: 'Haiku + Sonnet', escalation: true  },
}

export default function SettingsClient({ user, stats, subscription }) {
  const router = useRouter()
  const { tier = 'free', limit = 50, used = 0, remaining = 50, resetAt } = subscription ?? {}
  const info = TIER_INFO[tier] ?? TIER_INFO.free
  const pct  = Math.min(100, Math.round((used / limit) * 100))

  const resetDate = resetAt
    ? new Date(resetAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : null

  // Password change state
  const [newPassword, setNewPassword]     = useState('')
  const [confirmPw, setConfirmPw]         = useState('')
  const [pwSaving, setPwSaving]           = useState(false)
  const [pwMessage, setPwMessage]         = useState('')
  const [pwError, setPwError]             = useState('')

  // Email change state
  const [newEmail, setNewEmail]           = useState('')
  const [emailSaving, setEmailSaving]     = useState(false)
  const [emailMessage, setEmailMessage]   = useState('')
  const [emailError, setEmailError]       = useState('')

  // Delete state
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleting, setDeleting]           = useState(false)
  const [deleteError, setDeleteError]     = useState('')

  async function changePassword(e) {
    e.preventDefault()
    setPwError(''); setPwMessage('')
    if (newPassword.length < 8) return setPwError('Password must be at least 8 characters')
    if (newPassword !== confirmPw) return setPwError('Passwords do not match')
    setPwSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    setPwSaving(false)
    if (error) setPwError(error.message)
    else { setPwMessage('Password updated successfully'); setNewPassword(''); setConfirmPw('') }
  }

  async function changeEmail(e) {
    e.preventDefault()
    setEmailError(''); setEmailMessage('')
    if (!newEmail.includes('@')) return setEmailError('Please enter a valid email address')
    setEmailSaving(true)
    const supabase = createClient()
    const { error } = await supabase.auth.updateUser({ email: newEmail })
    setEmailSaving(false)
    if (error) setEmailError(error.message)
    else { setEmailMessage('Check your new email address for a confirmation link'); setNewEmail('') }
  }

  async function deleteAccount() {
    if (deleteConfirm !== 'DELETE') return setDeleteError('Please type DELETE to confirm')
    setDeleting(true)
    setDeleteError('')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/account/delete', {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      if (!res.ok) throw new Error('Failed to delete account')
      await supabase.auth.signOut()
      router.push('/?deleted=true')
    } catch (e) {
      setDeleteError(e.message)
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">

      <div>
        <h1 className="text-2xl font-bold text-gray-900">Account settings</h1>
        <p className="text-gray-500 text-sm mt-0.5">{user.email}</p>
      </div>

      {/* ── Subscription ─────────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-gray-900">Subscription</h2>
          <Link href="/pricing" className="text-xs text-[#C8102E] font-medium hover:underline">
            View all plans →
          </Link>
        </div>

        {/* Tier row */}
        <div className="flex items-center gap-3 flex-wrap">
          <span className={`text-xs font-black tracking-widest uppercase font-mono px-2.5 py-1 rounded ${info.colour}`}>
            {info.label}
          </span>
          <span className="text-sm text-gray-700 font-medium">{info.price}</span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-500">{info.model}{info.escalation ? ' with escalation' : ''}</span>
        </div>

        {/* Token usage */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600 font-medium">
              {used.toLocaleString()} / {limit >= 99999 ? 'Unlimited' : limit.toLocaleString()} photos used
            </span>
            <span className={`font-bold tabular-nums ${remaining === 0 ? 'text-red-600' : remaining <= Math.max(5, Math.round(limit * 0.1)) ? 'text-amber-600' : 'text-gray-500'}`}>
              {remaining.toLocaleString()} remaining
            </span>
          </div>
          {limit < 99999 && (
            <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-400' : 'bg-[#C8102E]'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
          )}
          {resetDate && (
            <p className="text-xs text-gray-400">Resets on {resetDate}</p>
          )}
        </div>

        {/* Features summary */}
        <div className="bg-gray-50 rounded-xl px-3 py-3 space-y-1.5">
          {[
            { label: 'Monthly photos',    value: limit >= 99999 ? 'Unlimited' : limit.toLocaleString() },
            { label: 'AI model',          value: info.model },
            { label: 'Sonnet escalation', value: info.escalation ? 'Included' : 'Not included' },
            { label: 'Batch processing',  value: (tier === 'pro' || tier === 'fleet') ? 'Included (200+ photos)' : 'Not included' },
          ].map(row => (
            <div key={row.label} className="flex items-center justify-between">
              <span className="text-xs text-gray-500">{row.label}</span>
              <span className={`text-xs font-medium ${row.value === 'Not included' ? 'text-gray-400' : 'text-gray-800'}`}>
                {row.value}
              </span>
            </div>
          ))}
        </div>

        {tier === 'free' && (
          <Link href="/pricing"
            className="block text-center bg-[#C8102E] text-white text-xs font-bold py-2.5 rounded-xl hover:bg-[#9B0B22] transition-colors">
            Upgrade plan
          </Link>
        )}
        {tier !== 'free' && tier !== 'fleet' && (
          <Link href="/pricing"
            className="block text-center bg-gray-100 text-gray-700 text-xs font-bold py-2.5 rounded-xl hover:bg-gray-200 transition-colors">
            View upgrade options
          </Link>
        )}
      </div>

      {/* ── Usage Statistics ─────────────────────────────────────── */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Your statistics</h2>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Batches',       value: stats.totalJobs },
            { label: 'Photos',        value: stats.totalPhotos },
            { label: 'Plates found',  value: stats.totalFound },
            { label: 'Success rate',  value: `${stats.successRate}%` },
          ].map(s => (
            <div key={s.label} className="bg-gray-50 rounded-lg px-3 py-3 text-center">
              <p className="text-2xl font-bold text-[#C8102E]">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {stats.topOperators.length > 0 && (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Top operators</p>
              <div className="space-y-1.5">
                {stats.topOperators.map((op, i) => (
                  <div key={i} className="flex items-center justify-between">
                    <span className="text-sm text-gray-700">{op.name}</span>
                    <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{op.count}</span>
                  </div>
                ))}
              </div>
            </div>
            {stats.topLocations.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Top locations</p>
                <div className="space-y-1.5">
                  {stats.topLocations.map((loc, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <span className="text-sm text-gray-700">{loc.name}</span>
                      <span className="text-xs font-medium text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{loc.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {stats.totalPhotos === 0 && (
          <p className="text-sm text-gray-400 text-center py-2">No photos processed yet — upload your first batch to see stats here</p>
        )}
      </div>

      {/* ── Change Email ─────────────────────────────────────────── */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Change email</h2>
        <form onSubmit={changeEmail} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">New email address</label>
            <input
              type="email"
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder={user.email}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C8102E]"
              required
            />
          </div>
          {emailError   && <p className="text-xs text-red-600">⚠ {emailError}</p>}
          {emailMessage && <p className="text-xs text-green-600">✓ {emailMessage}</p>}
          <button type="submit" disabled={emailSaving} className="btn-red text-xs px-4 py-2">
            {emailSaving ? 'Sending…' : 'Update email'}
          </button>
        </form>
      </div>

      {/* ── Change Password ──────────────────────────────────────── */}
      <div className="card space-y-4">
        <h2 className="text-sm font-semibold text-gray-900">Change password</h2>
        <form onSubmit={changePassword} className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">New password</label>
            <input
              type="password"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              placeholder="Min. 8 characters"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C8102E]"
              required
            />
          </div>
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Confirm new password</label>
            <input
              type="password"
              value={confirmPw}
              onChange={e => setConfirmPw(e.target.value)}
              placeholder="Repeat password"
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-[#C8102E]"
              required
            />
          </div>
          {pwError   && <p className="text-xs text-red-600">⚠ {pwError}</p>}
          {pwMessage && <p className="text-xs text-green-600">✓ {pwMessage}</p>}
          <button type="submit" disabled={pwSaving} className="btn-red text-xs px-4 py-2">
            {pwSaving ? 'Saving…' : 'Update password'}
          </button>
        </form>
      </div>

      {/* ── Delete Account ───────────────────────────────────────── */}
      <div className="card border-red-200 space-y-4">
        <div>
          <h2 className="text-sm font-semibold text-red-800">Delete account</h2>
          <p className="text-xs text-red-600 mt-0.5">
            This permanently deletes your account, all photos, all batches and all data. This cannot be undone.
          </p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Type DELETE to confirm</label>
            <input
              type="text"
              value={deleteConfirm}
              onChange={e => setDeleteConfirm(e.target.value)}
              placeholder="DELETE"
              className="w-full border border-red-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-red-500"
            />
          </div>
          {deleteError && <p className="text-xs text-red-600">⚠ {deleteError}</p>}
          <button
            onClick={deleteAccount}
            disabled={deleting || deleteConfirm !== 'DELETE'}
            className="bg-red-600 hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xs font-medium px-4 py-2 rounded-lg transition-colors">
            {deleting ? 'Deleting…' : 'Permanently delete my account'}
          </button>
        </div>
      </div>

    </div>
  )
}
