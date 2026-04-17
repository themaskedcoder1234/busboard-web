'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

export default function LoginForm({ redirectTo = '/dashboard' }) {
  const router = useRouter()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [error, setError]       = useState('')
  const [loading, setLoading]   = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push(redirectTo)
    router.refresh()
  }

  const signupHref = redirectTo !== '/dashboard'
    ? `/signup?redirect=${encodeURIComponent(redirectTo)}`
    : '/signup'

  return (
    <div className="bg-white border border-[#E8DDD8] rounded-2xl p-8 shadow-sm">
      <div className="flex items-center gap-3 mb-6">
        <div className="w-10 h-10 bg-[#C8102E] rounded-xl flex items-center justify-center">
          <span className="text-white text-lg">🚌</span>
        </div>
        <div>
          <h1 className="text-lg font-black text-[#1A1A1A]">Welcome back</h1>
          <p className="text-[#7A7068] text-xs">Log in to your account</p>
        </div>
      </div>

      <div className="flex h-0.5 mb-6 rounded overflow-hidden">
        <div className="flex-1 bg-[#C8102E]" />
        <div className="w-4 bg-[#F5C518]" />
        <div className="w-8 bg-[#1A1A1A]" />
      </div>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#7A7068] uppercase tracking-wide mb-1.5">Email</label>
          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
            className="input" placeholder="you@example.com" required />
        </div>
        <div>
          <label className="block text-xs font-semibold text-[#7A7068] uppercase tracking-wide mb-1.5">Password</label>
          <input type="password" value={password} onChange={e => setPassword(e.target.value)}
            className="input" placeholder="••••••••" required />
        </div>
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-800 text-xs px-3 py-2.5 rounded-lg">{error}</div>
        )}
        <button type="submit" disabled={loading} className="btn-red w-full py-3 text-base font-bold mt-2">
          {loading ? 'Logging in…' : 'Log in →'}
        </button>
      </form>

      <p className="text-center text-xs text-[#7A7068] mt-5">
        No account?{' '}
        <Link href={signupHref} className="text-[#C8102E] font-bold hover:underline">Sign up free</Link>
      </p>
    </div>
  )
}
