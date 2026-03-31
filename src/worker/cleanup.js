// ── BusBoard Cleanup Job ──────────────────────────────────────────────────────
// Deletes photos and ZIPs older than 24 hours from Supabase Storage
// Run with: node src/worker/cleanup.js
// Schedule on Railway as a cron job: 0 * * * * (every hour)

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

async function cleanup() {
  console.log('🧹 Starting cleanup at', new Date().toISOString())

  // Find all jobs that have expired (older than 24 hours) and not yet cleaned up
  const { data: expiredJobs, error } = await supabase
    .from('jobs')
    .select('id, user_id, status')
    .lt('expires_at', new Date().toISOString())
    .neq('status', 'expired')

  if (error) {
    console.error('Failed to fetch expired jobs:', error.message)
    process.exit(1)
  }

  if (!expiredJobs || expiredJobs.length === 0) {
    console.log('No expired jobs to clean up')
    process.exit(0)
  }

  console.log(`Found ${expiredJobs.length} expired job(s) to clean up`)

  for (const job of expiredJobs) {
    try {
      console.log(`Cleaning job ${job.id} (user ${job.user_id})`)

      // Get all photos for this job to find their storage paths
      const { data: photos } = await supabase
        .from('photos')
        .select('storage_path')
        .eq('job_id', job.id)

      // Delete all photo files from storage
      if (photos && photos.length > 0) {
        const paths = photos
          .map(p => p.storage_path)
          .filter(Boolean)

        if (paths.length > 0) {
          const { error: delError } = await supabase.storage
            .from('photos')
            .remove(paths)

          if (delError) {
            console.warn(`Storage delete error for job ${job.id}:`, delError.message)
          } else {
            console.log(`Deleted ${paths.length} photo file(s) for job ${job.id}`)
          }
        }
      }

      // Delete the ZIP file
      const zipPath = `${job.user_id}/${job.id}/busboard-renamed.zip`
      await supabase.storage.from('photos').remove([zipPath])
      console.log(`Deleted ZIP for job ${job.id}`)

      // Mark job as expired and clear the zip_url
      await supabase
        .from('jobs')
        .update({ status: 'expired', zip_url: null })
        .eq('id', job.id)

      console.log(`✓ Job ${job.id} marked as expired`)
    } catch (e) {
      console.error(`Failed to clean job ${job.id}:`, e.message)
    }
  }

  console.log('🧹 Cleanup complete')
  process.exit(0)
}

cleanup()
