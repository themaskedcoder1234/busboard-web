'use client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase-browser'

export default function DashboardNav({ user }) {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  return (
    <>
      <nav className="bg-[#C8102E] px-4 sm:px-6 h-14 flex items-center gap-3">
        <a href="/dashboard" className="text-white font-bold tracking-widest text-lg sm:text-xl" style={{fontFamily:'monospace'}}>
          🚌 BUSBOARD
        </a>
        <span className="flex-1" />
        <span className="text-white/60 text-sm hidden sm:block">{user.email}</span>
        <button onClick={signOut}
          className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
          Sign out
        </button>
      </nav>
      <div className="bg-[#9B0B22] px-6 py-2 flex items-center gap-3">
        <span className="bg-[#F5C518] text-black font-bold text-sm px-2.5 py-0.5 rounded font-mono tracking-wider">15</span>
        <span className="text-white/60 text-xs tracking-widest uppercase">
          <strong className="text-white/90">BusBoard</strong> &nbsp;·&nbsp; Spot it · Snap it · Save it right
        </span>
      </div>
    </>
  )
}}
