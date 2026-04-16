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
    .select('id, email, tokens, is_admin, created_at')
    .order('created_at', { ascending: false })

  const totalTokens = users?.reduce((sum, u) => sum + (u.tokens || 0), 0) || 0

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Admin — Users & Tokens</h1>
        <p className="text-gray-500 text-sm mt-0.5">{users?.length || 0} users · {totalTokens} tokens allocated</p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { label: 'Total users',  value: users?.length || 0 },
          { label: 'Total tokens', value: totalTokens },
          { label: 'Admins',       value: users?.filter(u => u.is_admin).length || 0 },
        ].map(s => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-center">
            <p className="text-2xl font-bold text-[#C8102E]">{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      <div>
        <p className="text-xs text-gray-400 mb-2">Enter a positive number to add tokens, negative to remove. Each photo processed uses 1 token.</p>
        <AdminUsersTable initialUsers={users || []} />
      </div>
    </div>
  )
}
