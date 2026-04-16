import { createClient } from '@/lib/supabase-server'
import UploadArea from '@/components/UploadArea'
import JobList from '@/components/JobList'
import FlickrConnect from '@/components/FlickrConnect'
import FilenameFormatBuilder from '@/components/FilenameFormatBuilder'

export default async function DashboardPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('flickr_username, flickr_user_id, filename_format, flickr_auto_upload, tokens')
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
  const tokens           = profile?.tokens ?? 0

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload photos</h1>
          <p className="text-gray-500 text-sm mt-0.5">Up to 500 photos per batch · JPEG & HEIC supported</p>
        </div>
        <FlickrConnect connected={flickrConnected} username={profile?.flickr_username} />
      </div>

      {tokens === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-amber-500 text-base flex-shrink-0">⚠</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">No tokens remaining</p>
            <p className="text-xs text-amber-700 mt-0.5">You need tokens to process photos. Contact an admin to get more.</p>
          </div>
        </div>
      )}

      {tokens > 0 && tokens < 20 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-start gap-3">
          <span className="text-amber-500 text-base flex-shrink-0">⚠</span>
          <div>
            <p className="text-sm font-semibold text-amber-800">Low on tokens — {tokens} remaining</p>
            <p className="text-xs text-amber-700 mt-0.5">Each photo uses 1 token. Contact an admin to top up.</p>
          </div>
        </div>
      )}

      <FilenameFormatBuilder initialFormat={profile?.filename_format || 'reg'} />

      <UploadArea flickrConnected={flickrConnected} flickrAutoUpload={flickrAutoUpload} tokens={tokens} />

      {jobs && jobs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Recent batches</h2>
          <JobList jobs={jobs} flickrConnected={flickrConnected} />
        </div>
      )}
    </div>
  )
}
