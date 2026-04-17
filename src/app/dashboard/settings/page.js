import { createClient } from '@/lib/supabase-server'
import SettingsClient from './SettingsClient'
import FlickrSettings from '@/components/FlickrSettings'

const TIER_LIMITS = { free: 50, basic: 500, pro: 5000, fleet: 99999 }

export default async function SettingsPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('flickr_username, flickr_auto_upload, flickr_album_format, flickr_title_format, flickr_description_format, subscription_tier, tokens_used, tokens_reset_at')
    .eq('id', user.id)
    .single()

  // Usage stats
  const { data: jobs } = await supabase
    .from('jobs')
    .select('id, status, found, processed, created_at')
    .eq('user_id', user.id)
    .neq('status', 'expired')

  const { data: photos } = await supabase
    .from('photos')
    .select('status, company, reg, address')
    .eq('user_id', user.id)

  const totalJobs   = jobs?.length || 0
  const totalPhotos = photos?.length || 0
  const totalFound  = photos?.filter(p => p.status === 'done').length || 0
  const successRate = totalPhotos > 0 ? Math.round((totalFound / totalPhotos) * 100) : 0

  const companyCounts = {}
  photos?.forEach(p => {
    if (p.company) companyCounts[p.company] = (companyCounts[p.company] || 0) + 1
  })
  const topOperators = Object.entries(companyCounts)
    .sort(([,a],[,b]) => b - a).slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  const locationCounts = {}
  photos?.forEach(p => {
    if (p.address) {
      const city = p.address.split(',')[2]?.trim() || p.address.split(',')[0]?.trim()
      if (city) locationCounts[city] = (locationCounts[city] || 0) + 1
    }
  })
  const topLocations = Object.entries(locationCounts)
    .sort(([,a],[,b]) => b - a).slice(0, 5)
    .map(([name, count]) => ({ name, count }))

  const tier      = profile?.subscription_tier ?? 'free'
  const limit     = TIER_LIMITS[tier] ?? 50
  const used      = profile?.tokens_used ?? 0
  const remaining = Math.max(0, limit - used)
  const resetAt   = profile?.tokens_reset_at ?? null

  const subscription = { tier, limit, used, remaining, resetAt }
  const stats = { totalJobs, totalPhotos, totalFound, successRate, topOperators, topLocations }

  return (
    <div className="space-y-6 max-w-2xl">
      <SettingsClient user={user} stats={stats} subscription={subscription} />
      {profile?.flickr_username && (
        <FlickrSettings initialSettings={profile} />
      )}
    </div>
  )
}
