import { createClient } from '@/lib/supabase-server'
import SettingsClient from './SettingsClient'

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  // Fetch usage stats
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, status, found, processed, created_at')
    .eq('user_id', user.id)
    .neq('status', 'expired')

  const { data: photos } = await supabase
    .from('photos')
    .select('status, company, reg, address')
    .eq('user_id', user.id)

  // Calculate stats
  const totalJobs      = jobs?.length || 0
  const totalPhotos    = photos?.length || 0
  const totalFound     = photos?.filter(p => p.status === 'done').length || 0
  const successRate    = totalPhotos > 0 ? Math.round((totalFound / totalPhotos) * 100) : 0

  // Top operators
  const companyCounts = {}
  photos?.forEach(p => {
    if (p.company) companyCounts[p.company] = (companyCounts[p.company] || 0) + 1
  })
  const topOperators = Object.entries(companyCounts)
    .sort(([,a],[,b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  // Top locations
  const locationCounts = {}
  photos?.forEach(p => {
    if (p.address) {
      const city = p.address.split(',')[2]?.trim() || p.address.split(',')[0]?.trim()
      if (city) locationCounts[city] = (locationCounts[city] || 0) + 1
    }
  })
  const topLocations = Object.entries(locationCounts)
    .sort(([,a],[,b]) => b - a)
    .slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  const stats = { totalJobs, totalPhotos, totalFound, successRate, topOperators, topLocations }

  return <SettingsClient user={user} stats={stats} />
}
