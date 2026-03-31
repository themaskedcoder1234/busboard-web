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
    .select('flickr_username, flickr_user_id, filename_format')
    .eq('id', user.id)
    .single()

  const { data: jobs } = await supabase
    .from('jobs')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(10)

  const flickrConnected = !!(profile?.flickr_username)

  return (
    <div className="space-y-5">

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upload photos</h1>
          <p className="text-gray-500 text-sm mt-0.5">Up to 500 photos per batch · JPEG & HEIC supported</p>
        </div>
        <FlickrConnect connected={flickrConnected} username={profile?.flickr_username} />
      </div>

      <FilenameFormatBuilder initialFormat={profile?.filename_format || 'reg'} />

      <UploadArea flickrConnected={flickrConnected} />

      {jobs && jobs.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Recent batches</h2>
          <JobList jobs={jobs} />
        </div>
      )}

    </div>
  )
}
