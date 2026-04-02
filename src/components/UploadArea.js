'use client'
import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'

const MAX_FILES = 500
const SECS_PER_PHOTO = 5  // Rough estimate for time remaining

export default function UploadArea({ flickrConnected, flickrAutoUpload }) {
  const [stagedFiles, setStagedFiles]       = useState([])
  const [dragging, setDragging]             = useState(false)
  const [jobId, setJobId]                   = useState(null)
  const [stage, setStage]                   = useState('idle')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processed, setProcessed]           = useState(0)
  const [found, setFound]                   = useState(0)
  const [total, setTotal]                   = useState(0)
  const [error, setError]                   = useState('')
  const [downloadUrl, setDownloadUrl]       = useState(null)
  const [previews, setPreviews]             = useState([])
  const [flickrProgress, setFlickrProgress] = useState({ uploaded: 0, failed: 0, total: 0 })
  const fileInput = useRef()
  const pollRef = useRef(null)

  const reset = () => {
    setStagedFiles([]); setPreviews([]); setStage('idle'); setJobId(null)
    setUploadProgress(0); setProcessed(0); setFound(0); setTotal(0)
    setError(''); setDownloadUrl(null)
    if (pollRef.current) clearInterval(pollRef.current)
    if (fileInput.current) fileInput.current.value = ''
  }

  const addFiles = useCallback((newFiles) => {
    const arr = Array.from(newFiles)
    setStagedFiles(prev => [...prev, ...arr].slice(0, MAX_FILES))
    arr.forEach(file => {
      const isHeic = file.name.toLowerCase().match(/\.(heic|heif)$/)
      if (file.type.startsWith('image/') && !isHeic) {
        const url = URL.createObjectURL(file)
        setPreviews(prev => [...prev, { name: file.name, url }])
      } else {
        setPreviews(prev => [...prev, { name: file.name, url: null }])
      }
    })
    setStage('staging')
  }, [])

  const removeFile = (index) => {
    setStagedFiles(prev => prev.filter((_, i) => i !== index))
    setPreviews(prev => {
      const removed = prev[index]
      if (removed?.url) URL.revokeObjectURL(removed.url)
      return prev.filter((_, i) => i !== index)
    })
    if (stagedFiles.length <= 1) setStage('idle')
  }

  const onDragOver  = e => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)
  const onDrop      = e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }
  const onPick      = e => { addFiles(e.target.files); e.target.value = '' }

  function timeRemaining(done, tot) {
    const left = tot - done
    const secs = left * SECS_PER_PHOTO
    if (secs < 60) return `~${secs}s remaining`
    const mins = Math.ceil(secs / 60)
    return `~${mins} min${mins !== 1 ? 's' : ''} remaining`
  }

  async function startProcessing() {
    if (!stagedFiles.length) return
    setStage('uploading')
    setError('')
    setTotal(stagedFiles.length)

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      const jobRes = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ total: stagedFiles.length })
      })
      const { jobId: newJobId } = await jobRes.json()
      setJobId(newJobId)

      const CHUNK = 10
      let uploaded = 0
      for (let i = 0; i < stagedFiles.length; i += CHUNK) {
        const chunk = stagedFiles.slice(i, i + CHUNK)
        const form  = new FormData()
        form.append('jobId', newJobId)
        chunk.forEach(f => form.append('photos', f))
        await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: form
        })
        uploaded += chunk.length
        setUploadProgress(Math.round((uploaded / stagedFiles.length) * 100))
      }

      await fetch('/api/jobs/start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: newJobId })
      })

      setStage('processing')
      startPolling(newJobId, token)
    } catch (e) {
      setError(e.message)
      setStage('staging')
    }
  }

  function startPolling(id, token) {
    pollRef.current = setInterval(async () => {
      try {
        const res  = await fetch(`/api/jobs/${id}`, { headers: { 'Authorization': `Bearer ${token}` } })
        const data = await res.json()
        setProcessed(data.processed || 0)
        setFound(data.found || 0)
        if (data.status === 'complete') {
          clearInterval(pollRef.current)
          setDownloadUrl(data.zip_url)
          setStage('done')
          // Auto-upload to Flickr if enabled
          if (flickrConnected && flickrAutoUpload) {
            setTimeout(() => uploadToFlickr(false), 1000)
          }
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current)
          setError('Processing failed — please try again')
          setStage('error')
        }
      } catch {}
    }, 1000)
  }

  async function uploadToFlickr(retry = false) {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    setStage('flickr-uploading')
    setFlickrProgress({ uploaded: 0, failed: 0, total: 0 })
    try {
      const res = await fetch('/api/flickr/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId, retryFailed: retry })
      })
      if (!res.ok) throw new Error('Flickr upload failed')
      const data = await res.json()
      setFlickrProgress({ uploaded: data.uploaded, failed: data.failed, total: data.total })
      setStage('flickr-done')
    } catch (e) {
      setError(e.message)
      setStage('done')
    }
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (stage === 'done' || stage === 'flickr-uploading' || stage === 'flickr-done') return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <p className="text-sm font-semibold text-green-800">Processing complete</p>
      </div>
      <div className="flex gap-2 flex-wrap">
        <span className="bg-green-50 border border-green-200 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
          ✓ {found} plates found
        </span>
        <span className="bg-gray-50 border border-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
          {total} photos processed
        </span>
      </div>

      {/* Flickr upload progress */}
      {stage === 'flickr-uploading' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 animate-spin text-[#C8102E]">⟳</div>
            <p className="text-xs text-gray-600">Uploading to Flickr…</p>
          </div>
          <p className="text-xs text-gray-400">This may take a few minutes for large batches</p>
        </div>
      )}

      {stage === 'flickr-done' && flickrProgress.total > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 space-y-1">
          <p className="text-xs font-semibold text-[#9B0B22]">
            ✓ {flickrProgress.uploaded}/{flickrProgress.total} photos uploaded to Flickr
          </p>
          {flickrProgress.failed > 0 && (
            <p className="text-xs text-red-600">
              {flickrProgress.failed} failed —{' '}
              <button onClick={() => uploadToFlickr(true)} className="underline hover:no-underline">
                retry failed photos
              </button>
            </p>
          )}
        </div>
      )}

      <div className="flex gap-2 flex-wrap">
        {downloadUrl && (
          <a href={downloadUrl} className="btn-dark text-sm px-4 py-2 inline-flex items-center gap-2">
            💾 Download ZIP
          </a>
        )}
        {flickrConnected && stage === 'done' && (
          <button onClick={() => uploadToFlickr(false)} className="btn-red text-sm px-4 py-2 inline-flex items-center gap-2">
            📸 Upload to Flickr
          </button>
        )}
        <button onClick={reset} className="btn-ghost text-sm px-4 py-2">Start new batch</button>
      </div>
    </div>
  )

  // ── Uploading / Processing ─────────────────────────────────────────────────
  if (stage === 'uploading' || stage === 'processing') return (
    <div className="card space-y-4">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm flex-shrink-0
          ${stage === 'uploading' ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100 animate-pulse'}`}>
          {stage === 'uploading' ? '⬆' : '🔍'}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold truncate">
            {stage === 'uploading' ? `Uploading ${total} photos…` : 'Reading registration plates…'}
          </p>
          <p className="text-xs text-gray-400">
            {stage === 'uploading'
              ? `${uploadProgress}% uploaded`
              : `${processed} of ${total} done · ${found} plates found · ${timeRemaining(processed, total)}`}
          </p>
        </div>
      </div>
      <ProgressBar
        value={stage === 'uploading' ? uploadProgress : total ? Math.round((processed / total) * 100) : 0}
        color={stage === 'uploading' ? 'red' : 'amber'}
      />
      {stage === 'processing' && (
        <p className="text-xs text-gray-400 text-center">Running in the background — you can leave and come back.</p>
      )}
    </div>
  )

  // ── Error ──────────────────────────────────────────────────────────────────
  if (stage === 'error') return (
    <div className="card border-red-200 bg-red-50 space-y-3">
      <p className="text-sm font-semibold text-red-800">⚠ {error || 'Something went wrong'}</p>
      <button onClick={reset} className="btn-ghost text-sm">Try again</button>
    </div>
  )

  // ── Drop zone ──────────────────────────────────────────────────────────────
  const dropZone = (
    <div
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      onClick={() => fileInput.current.click()}
      className={`border-2 border-dashed rounded-xl text-center cursor-pointer transition-all
        ${stage === 'staging' ? 'p-4' : 'p-8 sm:p-12'}
        ${dragging ? 'border-[#C8102E] bg-red-50' : 'border-[#C8102E]/20 bg-[#C8102E]/[0.02] hover:border-[#C8102E]/40'}`}
    >
      <input ref={fileInput} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={onPick} />
      {stage === 'staging' ? (
        <p className="text-xs text-gray-400">
          📷 Drop more photos here · <span className="text-[#C8102E]">or tap to browse</span>
        </p>
      ) : (
        <>
          <div className="text-3xl sm:text-4xl mb-3">📷</div>
          <h2 className="text-sm sm:text-base font-semibold mb-1">Drop your bus photos here</h2>
          <p className="text-gray-400 text-xs sm:text-sm">or tap to browse · add more before processing</p>
          <span className="inline-block mt-3 bg-[#C8102E]/08 border border-[#C8102E]/15 text-[#9B0B22] text-xs px-3 py-1 rounded-full">
            Up to {MAX_FILES} photos · JPEG &amp; HEIC
          </span>
        </>
      )}
    </div>
  )

  if (stage === 'idle') return dropZone

  // ── Staging ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-3">
      {dropZone}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">
            {stagedFiles.length} photo{stagedFiles.length !== 1 ? 's' : ''} ready
          </p>
          <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">Clear all</button>
        </div>

        {/* Thumbnail grid — 4 cols on mobile, 6 on desktop */}
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-1.5 max-h-48 overflow-y-auto">
          {previews.map((p, i) => (
            <div key={i} className="relative group aspect-square">
              {p.url ? (
                <img src={p.url} alt={p.name} className="w-full h-full object-cover rounded-md border border-gray-200" />
              ) : (
                <div className="w-full h-full rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center text-base sm:text-lg">
                  📱
                </div>
              )}
              <button
                onClick={e => { e.stopPropagation(); removeFile(i) }}
                className="absolute -top-1 -right-1 w-4 h-4 bg-gray-700 text-white rounded-full text-[10px] hidden group-hover:flex items-center justify-center">
                ×
              </button>
            </div>
          ))}
        </div>

        {error && <p className="text-xs text-red-600">⚠ {error}</p>}

        <button onClick={startProcessing}
          className="btn-red w-full py-2.5 text-sm font-semibold flex items-center justify-center gap-2">
          🔍 Process {stagedFiles.length} photo{stagedFiles.length !== 1 ? 's' : ''}
        </button>
      </div>
    </div>
  )
}

function ProgressBar({ value, color = 'red' }) {
  const bg = color === 'amber' ? 'bg-amber-400' : 'bg-[#C8102E]'
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${bg} rounded-full transition-all duration-300`} style={{ width: `${value}%` }} />
    </div>
  )
}
