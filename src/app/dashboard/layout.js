import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import DashboardNav from '@/components/DashboardNav'

const TIER_LIMITS = { free: 50, basic: 500, pro: 5000, fleet: 99999 }

export default async function DashboardLayout({ children }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin, subscription_tier, tokens_used, tokens_reset_at')
    .eq('id', user.id)
    .single()

  const tier      = profile?.subscription_tier ?? 'free'
  const limit     = TIER_LIMITS[tier] ?? 50
  const used      = profile?.tokens_used ?? 0
  const remaining = Math.max(0, limit - used)

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardNav
        user={user}
        tier={tier}
        tokensUsed={used}
        tokenLimit={limit}
        tokensRemaining={remaining}
        isAdmin={!!profile?.is_admin}
      />
      <main className="flex-1 max-w-4xl mx-auto w-full px-4 sm:px-6 py-5 sm:py-8">
        {children}
      </main>
      <footer className="bg-[#6B0718] px-6 py-3 flex items-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center flex-shrink-0">
          <div className="w-2.5 h-0.5 bg-white rounded" />
        </div>
        <span className="text-white/40 text-xs tracking-widest uppercase">
          Built for the <strong className="text-white/60">bus obsessed</strong>
        </span>
      </footer>
    </div>
  )
}
