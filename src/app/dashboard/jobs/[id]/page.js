import { notFound, redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase-server'
import Link from 'next/link'

export default async function JobPage({ params }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: job } = await supabase
    .from('jobs')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (!job) notFound()

  const { data: photos } = await supabase
    .from('photos')
    .select('*')
    .eq('job_id', params.id)
    .order('created_at', { ascending: true })

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/dashboard" className="text-gray-400 hover:text-gray-600 text-sm transition-colors">
          ← Dashboard
        </Link>
      </div>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Batch results</h1>
          <p className="text-gray-500 text-sm mt-0.5">
            {new Date(job.created_at).toLocaleDateString('en-GB', { day:'numeric', month:'long', year:'numeric' })}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {job.zip_url && (
            <a href={job.zip_url} className="btn-dark text-sm px-4 py-2 inline-flex items-center gap-2">
              💾 Download ZIP
            </a>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total photos', value: job.total },
          { label: 'Plates found', value: job.found, accent: true },
          { label: 'Not found', value: (job.total || 0) - (job.found || 0) },
        ].map(s => (
          <div key={s.label} className="card text-center">
            <p className={`text-2xl font-bold ${s.accent ? 'text-[#C8102E]' : 'text-charcoal'}`}>{s.value ?? '—'}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Photo grid */}
      <div className="space-y-2">
        {photos?.map(photo => (
          <div key={photo.id} className={`card flex items-start gap-3 ${photo.status === 'done' ? 'border-green-200' : photo.status === 'failed' ? 'border-red-100' : ''}`}>
            <div className="w-12 h-12 rounded-lg bg-gray-100 flex items-center justify-center text-lg flex-shrink-0">
              {photo.status === 'done' ? '🚌' : photo.status === 'failed' ? '⚠️' : '⏳'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs text-gray-400 line-through truncate">{photo.original_name}</p>
              {photo.reg ? (
                <div className="inline-flex items-center gap-1 bg-[#F5C518] border-2 border-yellow-600 rounded px-2 py-0.5 mt-1">
                  <span className="bg-[#003399] text-[#FFD700] text-[6px] font-bold px-1 py-0.5 rounded-sm leading-tight">GB</span>
                  <span className="font-mono font-bold text-sm tracking-widest text-charcoal">{formatReg(photo.reg)}</span>
                </div>
              ) : (
                <p className="text-xs text-red-600 mt-1">{photo.error || 'Plate not found'}</p>
              )}
              {(photo.date_str || photo.address) && (
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {photo.date_str && <Chip color="amber">{photo.date_str}</Chip>}
                  {photo.address && <Chip color="green">{photo.address}</Chip>}
                  {photo.lat && <Chip color="blue">{Number(photo.lat).toFixed(4)}°, {Number(photo.lon).toFixed(4)}°</Chip>}
                  {photo.flickr_id && <Chip color="red">On Flickr</Chip>}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function Chip({ color, children }) {
  const styles = {
    amber: 'bg-amber-50 border-amber-200 text-amber-800',
    green: 'bg-green-50 border-green-200 text-green-800',
    blue:  'bg-blue-50 border-blue-200 text-blue-800',
    red:   'bg-red-50 border-red-200 text-[#9B0B22]',
  }
  return (
    <span className={`inline-block border text-xs px-2 py-0.5 rounded ${styles[color]}`}>
      {children}
    </span>
  )
}

function formatReg(reg) {
  if (/^[A-Z]{2}\d{2}[A-Z]{3}$/.test(reg)) return `${reg.slice(0,4)} ${reg.slice(4)}`
  return reg
}
