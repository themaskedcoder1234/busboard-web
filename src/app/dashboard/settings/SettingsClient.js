'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function SettingsClient({ user, stats }) {
  const router = useRouter()

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
