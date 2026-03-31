'use client'
import Link from 'next/link'

const STATUS_STYLES = {
  pending:    { dot: 'bg-gray-300',                      label: 'Pending',    text: 'text-gray-500'  },
  processing: { dot: 'bg-amber-400 animate-pulse',       label: 'Processing', text: 'text-amber-700' },
  complete:   { dot: 'bg-green-500',                     label: 'Complete',   text: 'text-green-700' },
  failed:     { dot: 'bg-red-500',                       label: 'Failed',     text: 'text-red-700'   },
  expired:    { dot: 'bg-gray-300',                      label: 'Expired',    text: 'text-gray-400'  },
}

export default function JobList({ jobs }) {
  return (
    <div className="space-y-2">
      {jobs.map(job => {
        const s    = STATUS_STYLES[job.status] || STATUS_STYLES.pending
        const date = new Date(job.created_at).toLocaleDateString('en-GB', {
          day: 'numeric', month: 'short', year: 'numeric',
          hour: '2-digit', minute: '2-digit'
        })
        const pct = job.total ? Math.round((job.processed / job.total) * 100) : 0

        // Show time remaining for completed jobs
        let expiryNote = null
        if (job.status === 'complete' && job.expires_at) {
          const msLeft = new Date(job.expires_at) - new Date()
          if (msLeft > 0) {
            const hoursLeft = Math.floor(msLeft / (1000 * 60 * 60))
            const minsLeft  = Math.floor((msLeft % (1000 * 60 * 60)) / (1000 * 60))
            expiryNote = hoursLeft > 0
              ? `Download expires in ${hoursLeft}h ${minsLeft}m`
              : `Download expires in ${minsLeft}m`
          }
        }

        return (
          <div key={job.id} className="card flex items-center gap-4">
            <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${s.dot}`} />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`text-xs font-semibold uppercase tracking-wide ${s.text}`}>{s.label}</span>
                <span className="text-xs text-gray-400">{date}</span>
              </div>
              <div className="text-sm text-gray-600 mt-0.5">
                {job.total} photos
                {job.status === 'processing' && ` · ${job.processed} processed (${pct}%)`}
                {job.status === 'complete'   && ` · ${job.found} plates found`}
                {job.status === 'expired'    && ' · files deleted'}
              </div>
              {job.status === 'processing' && (
                <div className="mt-1.5 h-1 bg-gray-100 rounded-full overflow-hidden w-48">
                  <div className="h-full bg-amber-400 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              )}
              {expiryNote && (
                <p className="text-xs text-amber-600 mt-0.5">⏱ {expiryNote}</p>
              )}
            </div>

            {job.status === 'complete' && (
              <div className="flex gap-2 flex-shrink-0">
                {job.zip_url && (
                  <a href={job.zip_url}
                    className="text-xs font-medium bg-gray-900 text-white px-3 py-1.5 rounded-lg hover:bg-gray-700 transition-colors">
                    ↓ ZIP
                  </a>
                )}
                <Link href={`/dashboard/jobs/${job.id}`}
                  className="text-xs font-medium border border-gray-200 text-gray-600 px-3 py-1.5 rounded-lg hover:border-gray-400 transition-colors">
                  View
                </Link>
              </div>
            )}

            {job.status === 'expired' && (
              <span className="text-xs text-gray-400 flex-shrink-0 italic">Files deleted</span>
            )}
          </div>
        )
      })}
    </div>
  )
}
