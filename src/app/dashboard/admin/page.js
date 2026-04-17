import { redirect } from 'next/navigation'
import { createClient, createAdminClient } from '@/lib/supabase-server'
import AdminUsersTable from './AdminUsersTable'

export default async function AdminPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single()

  if (!profile?.is_admin) redirect('/dashboard')

  const admin = createAdminClient()
  const { data: users } = await admin
    .from('profiles')
    .select('id, email, tokens, is_admin, subscription_tier, tokens_used, tokens_reset_at, created_at')
    .order('created_at', { ascending: false })

  const tierCounts = { free: 0, basic: 0, pro: 0, fleet: 0 }
  users?.forEach(u => {
    const t = u.subscription_tier ?? 'free'
    tierCounts[t] = (tierCounts[t] || 0) + 1
  })

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin — Users & Subscriptions</h1>
        <p className="text-gray-500 text-sm mt-0.5">{users?.length || 0} users</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total users', value: users?.length || 0 },
          { label: 'Admins',      value: users?.filter(u => u.is_admin).length || 0 },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-[#C8102E]">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
        {Object.entries(tierCounts).map(([tier, count]) => (
          <div key={tier} className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-[#C8102E]">{count}</p>
            <p className="text-xs text-gray-500 mt-0.5 capitalize">{tier}</p>
          </div>
        ))}
      </div>

      <AdminUsersTable initialUsers={users || []} />
    </div>
  )
}
