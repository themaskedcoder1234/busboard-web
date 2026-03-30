'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase-browser'

export default function FlickrConnect({ connected, username }) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus]   = useState(connected ? 'connected' : 'idle')

  async function connect() {
    setLoading(true)
    try {
      const supabase = createClient()
      const { data: { session } } = await supabase.auth.getSession()
      // Get the Flickr OAuth URL from our API
      const res  = await fetch('/api/flickr/auth-url', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      })
      const { url } = await res.json()
      // Redirect to Flickr login
      window.location.href = url
    } catch {
      setLoading(false)
    }
  }

  async function disconnect() {
    setLoading(true)
    const supabase = createClient()
    await supabase.from('profiles').update({
      flickr_token: null, flickr_token_secret: null,
      flickr_user_id: null, flickr_username: null
    }).eq('id', (await supabase.auth.getUser()).data.user.id)
    setStatus('idle')
    setLoading(false)
  }

  if (status === 'connected') return (
    <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
      <div className="w-2 h-2 rounded-full bg-[#C8102E]" />
      <span className="text-xs font-medium text-[#9B0B22]">Flickr: @{username}</span>
      <button onClick={disconnect} disabled={loading}
        className="text-xs text-gray-400 hover:text-gray-600 ml-1 transition-colors">
        {loading ? '…' : 'Disconnect'}
      </button>
    </div>
  )

  return (
    <button onClick={connect} disabled={loading}
      className="flex items-center gap-2 border border-dashed border-gray-300 hover:border-[#C8102E] text-gray-500 hover:text-[#C8102E] rounded-lg px-3 py-2 text-xs font-medium transition-all">
      📷 {loading ? 'Connecting…' : 'Connect Flickr'}
    </button>
  )
}
