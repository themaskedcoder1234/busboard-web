'use client'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

const TIER_LABELS = { free: 'FREE', basic: 'BASIC', pro: 'PRO', fleet: 'FLEET' }
const TIER_COLOURS = {
  free:  'bg-white/10 text-white/70',
  basic: 'bg-blue-500/20 text-blue-200',
  pro:   'bg-[#F5C518]/20 text-[#F5C518]',
  fleet: 'bg-[#F5C518] text-[#1A1A1A]',
}

export default function DashboardNav({ user, tier = 'free', tokensUsed = 0, tokenLimit = 50, tokensRemaining = 50, isAdmin = false }) {
  const router = useRouter()

  async function signOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/')
    router.refresh()
  }

  const pct     = Math.min(100, Math.round((tokensUsed / tokenLimit) * 100))
  const low     = tokensRemaining <= Math.max(5, Math.round(tokenLimit * 0.1))
  const isEmpty = tokensRemaining === 0

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

        <span className="text-white/50 text-xs hidden sm:block truncate max-w-[140px]">{user.email}</span>

        {/* Tier badge */}
        <span className={`text-[10px] font-black tracking-widest font-mono px-2 py-1 rounded flex-shrink-0 ${TIER_COLOURS[tier] ?? TIER_COLOURS.free}`}>
          {TIER_LABELS[tier] ?? 'FREE'}
        </span>

        {/* Token usage pill */}
        <a href="/dashboard/settings"
          className={`border text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5 flex-shrink-0 transition-colors
            ${isEmpty  ? 'bg-red-500/20 border-red-300/30 text-red-200 hover:bg-red-500/30' :
              low      ? 'bg-amber-400/20 border-amber-300/30 text-amber-200 hover:bg-amber-400/30' :
                         'bg-white/10 border-white/20 text-white hover:bg-white/20'}`}>
          <span className="font-mono font-bold tabular-nums">{tokensRemaining.toLocaleString()}</span>
          <span className="text-white/60 hidden sm:inline">/ {tokenLimit >= 99999 ? '∞' : tokenLimit.toLocaleString()}</span>
        </a>

        {isAdmin && (
          <a href="/dashboard/admin"
            className="bg-[#F5C518] text-[#1A1A1A] font-bold text-xs px-3 py-1.5 rounded-lg hover:bg-[#D4A800] transition-colors flex-shrink-0">
            Admin
          </a>
        )}
        <a href="/dashboard/settings"
          className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
          Settings
        </a>
        <button onClick={signOut}
          className="bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors">
          Sign out
        </button>
      </nav>

      {/* Token progress bar (shows when < 50% remaining) */}
      {pct >= 50 && (
        <div className="h-0.5 bg-[#9B0B22]">
          <div className="h-full bg-white/30 transition-all" style={{ width: `${100 - pct}%` }} />
        </div>
      )}
      {pct < 50 && (
        <div className={`h-1 ${isEmpty ? 'bg-red-900' : low ? 'bg-amber-900' : 'bg-[#9B0B22]'}`}>
          <div
            className={`h-full transition-all ${isEmpty ? 'bg-red-400' : low ? 'bg-amber-400' : 'bg-white/40'}`}
            style={{ width: `${100 - pct}%` }}
          />
        </div>
      )}

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
