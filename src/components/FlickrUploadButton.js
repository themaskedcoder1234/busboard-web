'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function FlickrUploadButton({ jobId, hasFlickr }) {
  const [state, setState]     = useState('idle') // idle | uploading | done | error
  const [result, setResult]   = useState(null)
  const [error, setError]     = useState('')

  if (!hasFlickr) return null

  async function upload(retry = false) {
    setState('uploading')
    setError('')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/flickr/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ jobId, retryFailed: retry })
      })
      if (!res.ok) throw new Error('Upload failed')
      const data = await res.json()
      setResult(data)
      setState('done')
    } catch (e) {
      setError(e.message)
      setState('error')
    }
  }

  if (state === 'idle') return (
    <button onClick={() => upload(false)}
      className="text-xs font-medium bg-[#C8102E] text-white px-3 py-1.5 rounded-lg hover:bg-[#9B0B22] transition-colors">
      📸 Flickr
    </button>
  )

  if (state === 'uploading') return (
    <span className="text-xs text-gray-400 px-3 py-1.5">Uploading…</span>
  )

  if (state === 'done') return (
    <div className="flex items-center gap-2 flex-shrink-0">
      <span className="text-xs text-[#9B0B22] font-medium">
        ✓ {result?.uploaded}/{result?.total} on Flickr
      </span>
      {result?.failed > 0 && (
        <button onClick={() => upload(true)}
          className="text-xs text-amber-600 underline hover:no-underline">
          retry {result.failed} failed
        </button>
      )}
    </div>
  )

  if (state === 'error') return (
    <button onClick={() => upload(false)}
      className="text-xs text-red-600 underline hover:no-underline">
      ⚠ Retry Flickr
    </button>
  )
}
