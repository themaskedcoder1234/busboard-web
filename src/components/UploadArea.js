'use client'
import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'

const MAX_FILES = 500

export default function UploadArea({ flickrConnected }) {
  const [stagedFiles, setStagedFiles]   = useState([])  // Files waiting to be processed
  const [dragging, setDragging]         = useState(false)
  const [jobId, setJobId]               = useState(null)
  const [stage, setStage]               = useState('idle')  // idle | staging | uploading | processing | done | error
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processed, setProcessed]       = useState(0)
  const [found, setFound]               = useState(0)
  const [error, setError]               = useState('')
  const [downloadUrl, setDownloadUrl]   = useState(null)
  const [previews, setPreviews]         = useState([])  // thumbnail URLs
  const pollRef  = useRef(null)
  const fileInput = useRef()

  const reset = () => {
    setStagedFiles([])
    setPreviews([])
    setStage('idle')
    setJobId(null)
    setUploadProgress(0)
    setProcessed(0)
    setFound(0)
    setError('')
    setDownloadUrl(null)
    if (pollRef.current) clearInterval(pollRef.current)
    fileInput.current && (fileInput.current.value = '')
  }

  const addFiles = useCallback((newFiles) => {
    const arr = Array.from(newFiles)
    setStagedFiles(prev => {
      const combined = [...prev, ...arr].slice(0, MAX_FILES)
      return combined
    })
    // Generate previews
    arr.forEach(file => {
      if (file.type.startsWith('image/') && !file.name.toLowerCase().match(/\.(heic|heif)$/)) {
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

  // Drag handlers
  const onDragOver  = e => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)
  const onDrop      = e => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files) }
  const onPick      = e => { addFiles(e.target.files); e.target.value = '' }

  async function startProcessing() {
    if (!stagedFiles.length) return
    setStage('uploading')
    setError('')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      // Create job
      const jobRes = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ total: stagedFiles.length })
      })
      const { jobId: newJobId } = await jobRes.json()
      setJobId(newJobId)

      // Upload in chunks of 10
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

      // Start processing
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
        const res  = await fetch(`/api/jobs/${id}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        })
        const data = await res.json()
        setProcessed(data.processed || 0)
        setFound(data.found || 0)
        if (data.status === 'complete') {
          clearInterval(pollRef.current)
          setDownloadUrl(data.zip_url)
          setStage('done')
        } else if (data.status === 'failed') {
          clearInterval(pollRef.current)
          setError('Processing failed — please try again')
          setStage('error')
        }
      } catch {}
    }, 500)
  }

  async function uploadToFlickr() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    setStage('flickr-uploading')
    try {
      const res = await fetch('/api/flickr/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId })
      })
      if (!res.ok) throw new Error('Flickr upload failed')
      setStage('flickr-done')
    } catch (e) {
      setError(e.message)
      setStage('done')
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  // Done state
  if (stage === 'done' || stage === 'flickr-uploading' || stage === 'flickr-done') return (
    <div className="space-y-4">
      <div className="card space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <p className="text-sm font-semibold text-green-800">Processing complete</p>
        </div>
        <div className="flex gap-3 text-sm flex-wrap">
          <span className="bg-green-50 border border-green-200 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
            ✓ {found} plates found
          </span>
          <span className="bg-gray-50 border border-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
            {stagedFiles.length} photos processed
          </span>
        </div>
        <div className="flex gap-3 flex-wrap">
          {downloadUrl && (
            <a href={downloadUrl} className="btn-dark text-sm px-5 py-2 inline-flex items-center gap-2">
              💾 Download ZIP
            </a>
          )}
          {flickrConnected && stage !== 'flickr-done' && (
            <button onClick={uploadToFlickr} disabled={stage === 'flickr-uploading'}
              className="btn-red text-sm px-5 py-2 inline-flex items-center gap-2">
              {stage === 'flickr-uploading' ? '⏳ Uploading to Flickr…' : '📸 Upload to Flickr'}
            </button>
          )}
          {stage === 'flickr-done' && (
            <span className="bg-red-50 border border-red-200 text-[#9B0B22] text-sm px-4 py-2 rounded-lg font-medium">
              ✓ Uploaded to Flickr
            </span>
          )}
          <button onClick={reset} className="btn-ghost text-sm px-4 py-2">
            Start new batch
          </button>
        </div>
      </div>
    </div>
  )

  // Uploading / processing state
  if (stage === 'uploading' || stage === 'processing') return (
    <div className="card space-y-4">
      <div className="flex items-center gap-3">
        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm
          ${stage === 'uploading' ? 'bg-red-50 border border-red-100' : 'bg-amber-50 border border-amber-100 animate-pulse'}`}>
          {stage === 'uploading' ? '⬆' : '🔍'}
        </div>
        <div>
          <p className="text-sm font-semibold">
            {stage === 'uploading' ? `Uploading ${stagedFiles.length} photos…` : 'Reading registration plates…'}
          </p>
          <p className="text-xs text-gray-400">
            {stage === 'uploading'
              ? `${uploadProgress}% uploaded`
              : `${processed} of ${stagedFiles.length} done · ${found} plates found`}
          </p>
        </div>
      </div>
      <ProgressBar value={stage === 'uploading' ? uploadProgress : stagedFiles.length ? Math.round((processed / stagedFiles.length) * 100) : 0}
        color={stage === 'uploading' ? 'red' : 'amber'} />
      {stage === 'processing' && (
        <p className="text-xs text-gray-400 text-center">Running in the background — you can leave and come back.</p>
      )}
    </div>
  )

  // Error state
  if (stage === 'error') return (
    <div className="card border-red-200 bg-red-50 space-y-3">
      <p className="text-sm font-semibold text-red-800">⚠ {error || 'Something went wrong'}</p>
      <button onClick={reset} className="btn-ghost text-sm">Try again</button>
    </div>
  )

  // Idle state — drop zone
  const dropZone = (
    <div
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      onClick={() => fileInput.current.click()}
      className={`relative border-2 border-dashed rounded-xl text-center cursor-pointer transition-all
        ${stage === 'staging' ? 'p-4' : 'p-12'}
        ${dragging ? 'border-[#C8102E] bg-red-50' : 'border-[#C8102E]/20 bg-[#C8102E]/[0.02] hover:border-[#C8102E]/40 hover:bg-[#C8102E]/[0.03]'}`}
    >
      <input ref={fileInput} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={onPick} />
      {stage === 'staging' ? (
        <p className="text-xs text-gray-400">
          📷 Drop more photos here to add them · <span className="text-[#C8102E]">click to browse</span>
        </p>
      ) : (
        <>
          <div className="text-4xl mb-3">📷</div>
          <h2 className="text-base font-semibold mb-1">Drop your bus photos here</h2>
          <p className="text-gray-400 text-sm">or click to browse · you can add more before processing</p>
          <span className="inline-block mt-3 bg-[#C8102E]/08 border border-[#C8102E]/15 text-[#9B0B22] text-xs px-3 py-1 rounded-full">
            Up to {MAX_FILES} photos · JPEG &amp; HEIC supported
          </span>
        </>
      )}
    </div>
  )

  if (stage === 'idle') return dropZone

  // Staging state — show thumbnails + process button
  return (
    <div className="space-y-3">
      {dropZone}

      {/* Thumbnail grid */}
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-700">
            {stagedFiles.length} photo{stagedFiles.length !== 1 ? 's' : ''} ready to process
          </p>
          <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600 transition-colors">
            Clear all
          </button>
        </div>

        <div className="grid grid-cols-6 gap-1.5 max-h-48 overflow-y-auto">
          {previews.map((p, i) => (
            <div key={i} className="relative group aspect-square">
              {p.url ? (
                <img src={p.url} alt={p.name}
                  className="w-full h-full object-cover rounded-md border border-gray-200" />
              ) : (
                <div className="w-full h-full rounded-md border border-gray-200 bg-gray-50 flex items-center justify-center text-lg">
                  📱
                </div>
              )}
              <button
                onClick={() => removeFile(i)}
                className="absolute -top-1 -right-1 w-4 h-4 bg-gray-700 text-white rounded-full text-[10px] hidden group-hover:flex items-center justify-center leading-none">
                ×
              </button>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-xs text-red-600">⚠ {error}</p>
        )}

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
