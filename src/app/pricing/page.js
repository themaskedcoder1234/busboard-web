import Link from 'next/link'
import PricingCTA from './PricingCTA'
import { createClient } from '@/lib/supabase-server'

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '£0',
    period: 'forever',
    photosLabel: '50 photos/month',
    model: 'Haiku',
    escalation: false,
    cta: 'Get started',
    ctaHref: '/signup',
    highlight: false,
    features: [
      '50 photos per month',
      'Plate recognition (Haiku AI)',
      'EXIF tagging & GPS',
      'Custom filename formats',
      'Flickr direct upload',
      'ZIP download',
    ],
  },
  {
    id: 'basic',
    name: 'Basic',
    price: '£8',
    period: 'per month',
    photosLabel: '500 photos/month',
    model: 'Haiku',
    escalation: false,
    cta: 'Subscribe',
    highlight: false,
    features: [
      '500 photos per month',
      'Plate recognition (Haiku AI)',
      'EXIF tagging & GPS',
      'Custom filename formats',
      'Flickr direct upload',
      'ZIP download',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '£19',
    period: 'per month',
    photosLabel: '5,000 photos/month',
    model: 'Haiku + Sonnet',
    escalation: true,
    cta: 'Subscribe',
    highlight: true,
    features: [
      '5,000 photos per month',
      'Haiku AI + Sonnet escalation',
      'Higher accuracy on hard plates',
      'EXIF tagging & GPS',
      'Custom filename formats',
      'Flickr direct upload',
      'ZIP download',
      'Batch processing (200+ photos)',
    ],
  },
  {
    id: 'fleet',
    name: 'Fleet',
    price: '£49',
    period: 'per month',
    photosLabel: 'Unlimited photos',
    model: 'Haiku + Sonnet',
    escalation: true,
    cta: 'Subscribe',
    highlight: false,
    features: [
      'Unlimited photos per month',
      'Haiku AI + Sonnet escalation',
      'Highest accuracy reads',
      'EXIF tagging & GPS',
      'Custom filename formats',
      'Flickr direct upload',
      'ZIP download',
      'Batch processing (200+ photos)',
      'Priority support',
    ],
  },
]

function Check() {
  return (
    <svg className="w-4 h-4 text-[#C8102E] flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
    </svg>
  )
}

export default async function PricingPage({ searchParams }) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const TIER_ORDER = { free: 0, basic: 1, pro: 2, fleet: 3 }

  let currentTier = null
  let hasStripeCustomer = false
  if (user) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_tier, stripe_customer_id')
      .eq('id', user.id)
      .single()
    currentTier        = profile?.subscription_tier  || 'free'
    hasStripeCustomer  = !!profile?.stripe_customer_id
  }

  // ?tier=pro from login redirect triggers auto-checkout on mount
  const autoTriggerTier = searchParams?.tier || null

  return (
    <div className="min-h-screen flex flex-col bg-[#FDF6EE]">

      {/* Nav */}
      <nav className="bg-[#C8102E] px-4 sm:px-8 h-14 flex items-center gap-3 sticky top-0 z-50">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
            <span className="text-white text-base">🚌</span>
          </div>
          <span className="text-white font-black tracking-widest text-base sm:text-lg font-mono">BUSBOARD</span>
        </Link>
        <span className="flex-1" />
        {user ? (
          <Link href="/dashboard" className="text-white/80 hover:text-white text-sm font-medium transition-colors">
            Dashboard →
          </Link>
        ) : (
          <>
            <Link href="/login" className="text-white/80 hover:text-white text-sm font-medium transition-colors hidden sm:block">
              Log in
            </Link>
            <Link href="/signup" className="bg-white text-[#C8102E] font-bold text-sm px-4 py-1.5 rounded-lg hover:bg-[#FDF6EE] transition-colors">
              Sign up free
            </Link>
          </>
        )}
      </nav>

      {/* Destination strip */}
      <div className="bg-[#1A1A1A] px-4 sm:px-8 py-2 flex items-center gap-3">
        <div className="bg-[#F5C518] text-[#1A1A1A] font-black text-xs px-2 py-0.5 rounded font-mono tracking-wider border border-[#D4A800]">
          BB£
        </div>
        <span className="text-[#F5F0E8]/50 text-xs tracking-widest uppercase font-mono">
          <strong className="text-[#F5F0E8]/90">Pricing</strong>&nbsp;·&nbsp;Simple, transparent plans
        </span>
      </div>

      <div className="flex-1 max-w-5xl mx-auto w-full px-4 sm:px-8 py-12 sm:py-16">

        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-black text-[#1A1A1A] mb-3">
            Plans for every spotter
          </h1>
          <p className="text-[#7A7068] text-base max-w-lg mx-auto">
            All plans include plate recognition, EXIF tagging, GPS, custom filenames and Flickr upload. Tokens reset on the 1st of every month.
          </p>
        </div>

        {/* Tier grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {TIERS.map(tier => {
            const isCurrentPlan = currentTier === tier.id
            const autoTrigger   = autoTriggerTier === tier.id
            // Existing Stripe subscribers use the portal to change plan
            const openPortal = hasStripeCustomer && !isCurrentPlan && tier.id !== 'free'
            const ctaLabel = openPortal
              ? (TIER_ORDER[tier.id] > TIER_ORDER[currentTier] ? 'Upgrade' : 'Downgrade')
              : tier.cta

            return (
              <div key={tier.id} className={`rounded-2xl border-2 flex flex-col overflow-hidden
                ${isCurrentPlan
                  ? 'border-green-400 shadow-lg shadow-green-100'
                  : tier.highlight
                    ? 'border-[#C8102E] shadow-lg shadow-[#C8102E]/10'
                    : 'border-[#E8DDD8] bg-white'}`}>

                {isCurrentPlan ? (
                  <div className="bg-green-500 text-white text-[10px] font-black tracking-widest uppercase text-center py-1.5 font-mono">
                    Your current plan
                  </div>
                ) : tier.highlight ? (
                  <div className="bg-[#C8102E] text-white text-[10px] font-black tracking-widest uppercase text-center py-1.5 font-mono">
                    Most popular
                  </div>
                ) : null}

                <div className="p-5 flex flex-col flex-1 bg-white">
                  {/* Header */}
                  <div className="mb-5">
                    <div className="flex items-center gap-2 mb-3">
                      <span className={`text-xs font-black tracking-widest uppercase font-mono px-2 py-0.5 rounded
                        ${tier.id === 'free'  ? 'bg-gray-100 text-gray-600' :
                          tier.id === 'basic' ? 'bg-blue-50 text-blue-700' :
                          tier.id === 'pro'   ? 'bg-[#C8102E]/10 text-[#C8102E]' :
                                                'bg-[#1A1A1A] text-[#F5C518]'}`}>
                        {tier.name}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-1">
                      <span className="text-3xl font-black text-[#1A1A1A]">{tier.price}</span>
                      <span className="text-[#7A7068] text-xs">{tier.period}</span>
                    </div>
                    <p className="text-xs text-[#7A7068] mt-1">{tier.photosLabel}</p>
                  </div>

                  {/* AI model badge */}
                  <div className="mb-4">
                    <div className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg border
                      ${tier.escalation
                        ? 'bg-[#F5C518]/20 border-[#D4A800]/30 text-[#7A5800]'
                        : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                      <span>{tier.escalation ? '⚡' : '🤖'}</span>
                      <span className="font-medium">{tier.model}</span>
                      {tier.escalation && <span className="text-[#7A5800]/60">escalation</span>}
                    </div>
                  </div>

                  {/* Features */}
                  <ul className="space-y-2 mb-6 flex-1">
                    {tier.features.map(f => (
                      <li key={f} className="flex items-start gap-2">
                        <Check />
                        <span className="text-xs text-[#3A3228] leading-relaxed">{f}</span>
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  {tier.id === 'free' ? (
                    currentTier === 'free' ? (
                      <div className="block text-center text-sm font-bold py-2.5 rounded-xl bg-green-50 border-2 border-green-200 text-green-700">
                        ✓ Current plan
                      </div>
                    ) : (
                      <Link href={tier.ctaHref}
                        className="block text-center text-sm font-bold py-2.5 rounded-xl transition-all bg-[#1A1A1A] text-white hover:bg-[#333]">
                        {tier.cta}
                      </Link>
                    )
                  ) : (
                    <PricingCTA
                      tier={tier.id}
                      label={ctaLabel}
                      highlight={tier.highlight}
                      isCurrentPlan={isCurrentPlan}
                      autoTrigger={autoTrigger}
                      openPortal={openPortal}
                    />
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* Stripe trust badge */}
        <div className="flex items-center justify-center gap-2 mb-10 text-xs text-[#7A7068]">
          <svg className="w-4 h-4 text-[#635BFF]" viewBox="0 0 24 24" fill="currentColor">
            <path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.992 3.757 7.218c0 4.039 2.467 5.76 6.476 7.219 2.585.92 3.445 1.574 3.445 2.583 0 .98-.84 1.545-2.354 1.545-1.875 0-4.965-.921-6.99-2.109l-.9 5.555C5.175 22.99 8.385 24 11.714 24c2.641 0 4.843-.624 6.328-1.813 1.664-1.305 2.525-3.236 2.525-5.732 0-4.128-2.524-5.851-6.591-7.305z"/>
          </svg>
          <span>Secure payments powered by Stripe · Cancel anytime</span>
        </div>

        {/* AI model explainer */}
        <div className="bg-white border border-[#E8DDD8] rounded-2xl p-6 mb-8">
          <h2 className="font-bold text-[#1A1A1A] mb-1 text-sm">How the AI models work</h2>
          <p className="text-xs text-[#7A7068] leading-relaxed mb-4">
            All plans use Claude Haiku for fast, cost-efficient plate reading. Pro and Fleet plans automatically escalate difficult reads to Claude Sonnet — a more powerful model — when Haiku returns a low-confidence result. This happens transparently and counts as 1 photo regardless.
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-xl p-3 border border-gray-100">
              <p className="text-xs font-bold text-gray-700 mb-1">🤖 Haiku (all plans)</p>
              <p className="text-xs text-gray-500">Fast and economical. Handles most clear, well-lit plates with high accuracy.</p>
            </div>
            <div className="bg-[#F5C518]/10 rounded-xl p-3 border border-[#D4A800]/20">
              <p className="text-xs font-bold text-[#7A5800] mb-1">⚡ Sonnet escalation (Pro & Fleet)</p>
              <p className="text-xs text-[#7A5800]/80">Triggered automatically for obscured, angled or low-light plates. Significantly higher accuracy on difficult reads.</p>
            </div>
          </div>
        </div>

        {/* FAQ */}
        <div className="space-y-3">
          <h2 className="font-bold text-[#1A1A1A] text-sm mb-4">Common questions</h2>
          {[
            {
              q: 'What counts as a photo?',
              a: '1 photo = 1 token. Each image you submit for plate recognition uses one token, whether it succeeds or not. Tokens reset on the 1st of each month.',
            },
            {
              q: 'What happens if I run out of tokens?',
              a: "You'll see a warning when you're running low. If you reach zero you won't be able to start new processing jobs until your tokens reset or your plan is upgraded.",
            },
            {
              q: 'Can I upgrade or downgrade?',
              a: 'You can change or cancel your plan at any time from Account Settings → Manage subscription. Upgrades take effect immediately; downgrades apply at the end of your billing period.',
            },
            {
              q: 'What is batch processing?',
              a: "Uploads of 200+ photos are automatically sent to the Anthropic Batch API, which is 50% cheaper to run. Processing takes up to an hour and you'll get an email when done. Available on Pro and Fleet.",
            },
          ].map(item => (
            <div key={item.q} className="bg-white border border-[#E8DDD8] rounded-xl p-4">
              <p className="text-sm font-semibold text-[#1A1A1A] mb-1">{item.q}</p>
              <p className="text-xs text-[#7A7068] leading-relaxed">{item.a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-[#1A1A1A] px-4 sm:px-8 py-6 mt-8">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-4">
          <span className="text-[#F5F0E8]/40 text-xs font-mono">BUSBOARD</span>
          <div className="flex gap-6">
            <Link href="/" className="text-[#F5F0E8]/50 hover:text-[#F5F0E8] text-xs transition-colors">Home</Link>
            {user ? (
              <Link href="/dashboard" className="text-[#F5F0E8]/50 hover:text-[#F5F0E8] text-xs transition-colors">Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className="text-[#F5F0E8]/50 hover:text-[#F5F0E8] text-xs transition-colors">Log in</Link>
                <Link href="/signup" className="text-[#F5F0E8]/50 hover:text-[#F5F0E8] text-xs transition-colors">Sign up</Link>
              </>
            )}
          </div>
        </div>
      </footer>

    </div>
  )
}
