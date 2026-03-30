'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin(e) {
    e.preventDefault()
    setLoading(true)
    setError('')
    const supabase = createClient()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false); return }
    router.push('/dashboard')
    router.refresh()
  }

  return (
    <div className="min-h-screen flex flex-col">
      <nav className="bg-[#C8102E] px-6 h-14 flex items-center">
        <Link href="/" className="text-white font-bold tracking-widest text-xl" style={{fontFamily:'monospace'}}>
          🚌 BUSBOARD
        </Link>
      </nav>
      <div className="bg-[#9B0B22] px-6 py-2 flex items-center gap-3">
        <span className="bg-[#F5C518] text-black font-bold text-sm px-2.5 py-0.5 rounded font-mono tracking-wider">15</span>
        <span className="text-white/60 text-xs tracking-widest uppercase"><strong className="text-white/90">BusBoard</strong> &nbsp;·&nbsp; Spot it · Snap it · Save it right</span>
      </div>

      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-bold text-charcoal mb-1">Welcome back</h1>
          <p className="text-gray-500 text-sm mb-7">Log in to your BusBoard account</p>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                className="input" placeholder="you@example.com" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-1.5">Password</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                className="input" placeholder="••••••••" required />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-800 text-sm px-3 py-2.5 rounded-lg">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading} className="btn-red w-full py-2.5">
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-5">
            No account?{' '}
            <Link href="/signup" className="text-[#C8102E] font-semibold hover:underline">
              Sign up free
            </Link>
          </p>
        </div>
      </main>
    </div>
  )
}
