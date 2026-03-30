import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import DashboardNav from '@/components/DashboardNav'

export default async function DashboardLayout({ children }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <div className="min-h-screen flex flex-col">
      <DashboardNav user={user} />
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-8">
        {children}
      </main>
      <footer className="bg-[#6B0718] px-6 py-3 flex items-center gap-3">
        <div className="w-5 h-5 rounded-full border-2 border-white flex items-center justify-center flex-shrink:0">
          <div className="w-2.5 h-0.5 bg-white rounded" />
        </div>
        <span className="text-white/40 text-xs tracking-widest uppercase">
          Built for the <strong className="text-white/60">bus obsessed</strong>
        </span>
      </footer>
    </div>
  )
}
