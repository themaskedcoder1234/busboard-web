'use client'
import { useState, useEffect } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase-browser'

export default function FlickrConnect({ connected, username }) {
  const [loading, setLoading]   = useState(false)
  const [status, setStatus]     = useState(connected ? 'connected' : 'idle')
  const [message, setMessage]   = useState('')
  const searchParams            = useSearchParams()
  const router                  = useRouter()

  useEffect(() => {
    const flickrParam = searchParams.get('flickr')
    if (flickrParam === 'connected') {
      setStatus('connected')
      setMessage('Flickr connected successfully!')
      // Clean up the URL
      router.replace('/dashboard')
    } else if (flickrParam === 'error') {
      setMessage('Flickr connection failed — please try again.')
      router.replace('/dashboard')
    }
  }, [searchParams])

  async function connect() {
    setLoading(true)
    setMessage('')
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/flickr/auth-url', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      window.location.href = data.url
    } catch (e) {
      setMessage('Could not connect to Flickr — check your API keys in Railway.')
      setLoading(false)
    }
  }

  async function disconnect() {
    setLoading(true)
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    await supabase.from('profiles').update({
      flickr_token: null, flickr_token_secret: null,
      flickr_user_id: null, flickr_username: null
    }).eq('id', user.id)
    setStatus('idle')
    setMessage('')
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-end gap-1">
      {status === 'connected' ? (
        <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          <div className="w-2 h-2 rounded-full bg-[#C8102E]" />
          <span className="text-xs font-medium text-[#9B0B22]">
            Flickr: @{username}
          </span>
          <button onClick={disconnect} disabled={loading}
            className="text-xs text-gray-400 hover:text-gray-600 ml-1 transition-colors">
            {loading ? '…' : 'Disconnect'}
          </button>
        </div>
      ) : (
        <button onClick={connect} disabled={loading}
          className="flex items-center gap-2 border border-dashed border-gray-300 hover:border-[#C8102E] text-gray-500 hover:text-[#C8102E] rounded-lg px-3 py-2 text-xs font-medium transition-all">
          📷 {loading ? 'Connecting…' : 'Connect Flickr'}
        </button>
      )}
      {message && (
        <p className={`text-xs ${message.includes('success') ? 'text-green-600' : 'text-red-600'}`}>
          {message}
        </p>
      )}
    </div>
  )
}
