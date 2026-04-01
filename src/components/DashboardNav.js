'use client'
import { useRouter } from 'next/navigation'
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
      {/* Main nav */}
      <nav className="bg-[#C8102E] px-4 sm:px-6 h-14 flex items-center gap-3 sticky top-0 z-50">
        <a href="/dashboard" className="flex items-center gap-2 group">
          <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center group-hover:bg-white/20 transition-colors">
            <span className="text-white text-base">🚌</span>
          </div>
          <span className="text-white font-black tracking-widest text-base sm:text-lg font-mono">BUSBOARD</span>
        </a>
        <span className="flex-1" />
        <span className="text-white/50 text-xs hidden sm:block truncate max-w-[200px]">{user.email}</span>
        <a href="/dashboard/settings"
          className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
          Settings
        </a>
        <button onClick={signOut}
          className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
          Sign out
        </button>
      </nav>

      {/* Destination blind strip */}
      <div className="bg-[#1A1A1A] px-4 sm:px-6 py-2 flex items-center gap-3">
        <div className="bg-[#F5C518] text-[#1A1A1A] font-black text-[10px] px-2 py-0.5 rounded font-mono tracking-wider border border-[#D4A800] flex-shrink-0">
          BB1
        </div>
        <span className="text-[#F5F0E8]/40 text-[10px] tracking-widest uppercase font-mono truncate">
          <strong className="text-[#F5F0E8]/80">BusBoard</strong>&nbsp;·&nbsp;Spot it · Snap it · Save it right
        </span>
      </div>
    </>
  )
}
