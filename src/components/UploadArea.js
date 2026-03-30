'use client'
import { useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase-browser'

const MAX_FILES = 500
const CHUNK_SIZE = 10  // Upload 10 files at a time to the server

export default function UploadArea({ flickrConnected }) {
  const [dragging, setDragging] = useState(false)
  const [jobId, setJobId]     = useState(null)
  const [stage, setStage]     = useState('idle')  // idle | uploading | processing | done | error
  const [uploadProgress, setUploadProgress] = useState(0)
  const [processed, setProcessed] = useState(0)
  const [total, setTotal]     = useState(0)
  const [found, setFound]     = useState(0)
  const [error, setError]     = useState('')
  const [downloadUrl, setDownloadUrl] = useState(null)
  const pollRef = useRef(null)
  const fileInput = useRef()

  const reset = () => {
    setStage('idle')
    setJobId(null)
    setUploadProgress(0)
    setProcessed(0)
    setTotal(0)
    setFound(0)
    setError('')
    setDownloadUrl(null)
    if (pollRef.current) clearInterval(pollRef.current)
  }

  const handleFiles = useCallback(async (files) => {
    const arr = Array.from(files).slice(0, MAX_FILES)
    if (!arr.length) return
    setTotal(arr.length)
    setStage('uploading')
    setError('')

    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const token = session?.access_token

      // Step 1: Create a job
      const jobRes = await fetch('/api/jobs/create', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ total: arr.length })
      })
      const { jobId: newJobId } = await jobRes.json()
      setJobId(newJobId)

      // Step 2: Upload files in chunks
      let uploaded = 0
      for (let i = 0; i < arr.length; i += CHUNK_SIZE) {
        const chunk = arr.slice(i, i + CHUNK_SIZE)
        const form  = new FormData()
        form.append('jobId', newJobId)
        chunk.forEach(f => form.append('photos', f))

        await fetch('/api/upload', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
          body: form
        })

        uploaded += chunk.length
        setUploadProgress(Math.round((uploaded / arr.length) * 100))
      }

      // Step 3: Kick off processing
      await fetch('/api/jobs/start', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: newJobId })
      })

      setStage('processing')
      startPolling(newJobId, token)

    } catch (e) {
      setError(e.message)
      setStage('error')
    }
  }, [])

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
    }, 2000)
  }

  async function uploadToFlickr() {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    setStage('flickr-uploading')
    try {
      const res = await fetch(`/api/flickr/upload`, {
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

  // Drag handlers
  const onDragOver  = e => { e.preventDefault(); setDragging(true) }
  const onDragLeave = () => setDragging(false)
  const onDrop      = e => { e.preventDefault(); setDragging(false); handleFiles(e.dataTransfer.files) }
  const onPick      = e => handleFiles(e.target.files)

  // ── Render ──────────────────────────────────────────────────────────────────

  if (stage === 'idle') return (
    <div
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      onClick={() => fileInput.current.click()}
      className={`relative border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all
        ${dragging ? 'border-[#C8102E] bg-red-50' : 'border-[#C8102E]/20 bg-[#C8102E]/[0.02] hover:border-[#C8102E]/40 hover:bg-[#C8102E]/[0.03]'}`}
    >
      <input ref={fileInput} type="file" accept="image/*,.heic,.heif" multiple className="hidden" onChange={onPick} />
      <div className="text-4xl mb-3">📷</div>
      <h2 className="text-base font-semibold mb-1">Drop your bus photos here</h2>
      <p className="text-gray-400 text-sm">or click to browse</p>
      <span className="inline-block mt-3 bg-[#C8102E]/08 border border-[#C8102E]/15 text-[#9B0B22] text-xs px-3 py-1 rounded-full">
        Up to 500 photos · JPEG &amp; HEIC supported
      </span>
    </div>
  )

  if (stage === 'uploading') return (
    <div className="card space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-red-50 border border-red-100 flex items-center justify-center text-sm">⬆</div>
        <div>
          <p className="text-sm font-semibold">Uploading {total} photos…</p>
          <p className="text-xs text-gray-400">{uploadProgress}% uploaded</p>
        </div>
      </div>
      <ProgressBar value={uploadProgress} />
    </div>
  )

  if (stage === 'processing') return (
    <div className="card space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-full bg-amber-50 border border-amber-100 flex items-center justify-center text-sm animate-pulse">🔍</div>
        <div>
          <p className="text-sm font-semibold">Reading registration plates…</p>
          <p className="text-xs text-gray-400">{processed} of {total} done · {found} plates found</p>
        </div>
      </div>
      <ProgressBar value={total ? Math.round((processed / total) * 100) : 0} color="amber" />
      <p className="text-xs text-gray-400 text-center">This runs in the background — you can leave and come back.</p>
    </div>
  )

  if (stage === 'done' || stage === 'flickr-uploading' || stage === 'flickr-done') return (
    <div className="card space-y-4">
      <div className="flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-green-500" />
        <p className="text-sm font-semibold text-green-800">Processing complete</p>
      </div>
      <div className="flex gap-3 text-sm">
        <span className="bg-green-50 border border-green-200 text-green-800 px-3 py-1 rounded-full text-xs font-medium">
          ✓ {found} plates found
        </span>
        <span className="bg-gray-50 border border-gray-200 text-gray-600 px-3 py-1 rounded-full text-xs font-medium">
          {total} photos processed
        </span>
      </div>
      <div className="flex gap-3 flex-wrap">
        {downloadUrl && (
          <a href={downloadUrl} className="btn-dark text-sm px-5 py-2 inline-flex items-center gap-2">
            💾 Download ZIP
          </a>
        )}
        {flickrConnected && stage !== 'flickr-done' && (
          <button onClick={uploadToFlickr} disabled={stage === 'flickr-uploading'} className="btn-red text-sm px-5 py-2 inline-flex items-center gap-2">
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
  )

  if (stage === 'error') return (
    <div className="card border-red-200 bg-red-50 space-y-3">
      <p className="text-sm font-semibold text-red-800">⚠ {error || 'Something went wrong'}</p>
      <button onClick={reset} className="btn-ghost text-sm">Try again</button>
    </div>
  )

  return null
}

function ProgressBar({ value, color = 'red' }) {
  const bg = color === 'amber' ? 'bg-amber-400' : 'bg-[#C8102E]'
  return (
    <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
      <div className={`h-full ${bg} rounded-full transition-all duration-300`} style={{ width: `${value}%` }} />
    </div>
  )
}
