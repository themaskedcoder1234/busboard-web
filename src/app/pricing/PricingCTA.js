'use client'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'

export default function PricingCTA({
  tier,
  label,
  highlight,
  isCurrentPlan = false,
  autoTrigger   = false,
  openPortal    = false,   // true for existing Stripe subscribers changing plan
}) {
  const [loading, setLoading] = useState(autoTrigger)
  const router = useRouter()

  useEffect(() => {
    if (autoTrigger) handleClick()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleClick() {
    setLoading(true)
    try {
      if (openPortal) {
        const res  = await fetch('/api/stripe/portal', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) { alert(data.error || 'Could not open billing portal. Please try again.'); setLoading(false); return }
        window.location.href = data.url
        return
      }

      const res = await fetch('/api/stripe/checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ tier }),
      })

      if (res.status === 401) {
        router.push(`/login?redirect=${encodeURIComponent(`/pricing?tier=${tier}`)}`)
        return
      }

      const data = await res.json()
      if (!res.ok) { alert(data.error || 'Something went wrong. Please try again.'); setLoading(false); return }
      window.location.href = data.url
    } catch {
      alert('Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  if (isCurrentPlan) {
    return (
      <div className="w-full text-center text-sm font-bold py-2.5 rounded-xl bg-green-50 border-2 border-green-200 text-green-700">
        ✓ Current plan
      </div>
    )
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`w-full text-center text-sm font-bold py-2.5 rounded-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed
        ${highlight
          ? 'bg-[#C8102E] text-white hover:bg-[#9B0B22]'
          : 'bg-[#1A1A1A] text-white hover:bg-[#333]'}`}>
      {loading ? 'Redirecting…' : label}
    </button>
  )
}
