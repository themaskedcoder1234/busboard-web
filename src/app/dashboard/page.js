import { createClient } from '@/lib/supabase-server'
import UploadArea from '@/components/UploadArea'
import JobList from '@/components/JobList'
import FlickrConnect from '@/components/FlickrConnect'
import FilenameFormatBuilder from '@/components/FilenameFormatBuilder'
import Link from 'next/link'

const TIER_LIMITS = { free: 50, basic: 500, pro: 5000, fleet: 99999 }

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('flickr_username, flickr_user_id, filename_format, flickr_auto_upload, subscription_tier, tokens_used, tokens_reset_at')
    .eq('id', user.id)
    .single()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const flickrConnected  = !!(profile?.flickr_username)
  const flickrAutoUpload = !!(profile?.flickr_auto_upload)
  const tier             = profile?.subscription_tier ?? 'free'
  const limit            = TIER_LIMITS[tier] ?? 50
  const used             = profile?.tokens_used ?? 0
  const remaining        = Math.max(0, limit - used)
  const resetAt          = profile?.tokens_reset_at
    ? new Date(profile.tokens_reset_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })
    : null

  const lowThreshold = Math.max(5, Math.round(limit * 0.1))

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload photos</h1>
          <p className="text-gray-500 text-sm mt-0.5">Up to 500 photos per batch · JPEG & HEIC supported</p>
        </div>
        <FlickrConnect connected={flickrConnected} username={profile?.flickr_username} />
      </div>

      {/* Token warnings */}
      {remaining === 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-red-500 text-base flex-shrink-0 mt-0.5">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-red-800">No tokens remaining</p>
            <p className="text-xs text-red-700 mt-0.5">
              You've used all {limit} photos on your {tier} plan.
              {resetAt ? ` Resets on ${resetAt}.` : ''}{' '}
              <Link href="/pricing" className="underline font-medium">Upgrade your plan</Link> for more.
            </p>
          </div>
        </div>
      )}

      {remaining > 0 && remaining <= lowThreshold && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-amber-500 text-base flex-shrink-0 mt-0.5">⚠</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-amber-800">
              {remaining} token{remaining !== 1 ? 's' : ''} remaining
            </p>
            <p className="text-xs text-amber-700 mt-0.5">
              Each photo uses 1 token ({used}/{limit} used on {tier} plan).
              {resetAt ? ` Resets ${resetAt}.` : ''}{' '}
              <Link href="/pricing" className="underline font-medium">Upgrade for more</Link>.
            </p>
          </div>
        </div>
      )}

      <FilenameFormatBuilder initialFormat={profile?.filename_format || 'reg'} />

      <UploadArea flickrConnected={flickrConnected} flickrAutoUpload={flickrAutoUpload} tokens={remaining} />

      {jobs && jobs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Recent batches</h2>
          <JobList jobs={jobs} flickrConnected={flickrConnected} />
        </div>
      )}
    </div>
  )
}
