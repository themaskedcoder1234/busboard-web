import Link from 'next/link'
import PricingCTA from './PricingCTA'

const TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '£0',
    period: 'forever',
    photos: '50',
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
    photos: '500',
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
    photos: '5,000',
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
    photos: 'Unlimited',
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

export default function PricingPage() {
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
        <Link href="/login" className="text-white/80 hover:text-white text-sm font-medium transition-colors hidden sm:block">
          Log in
        </Link>
        <Link href="/signup" className="bg-white text-[#C8102E] font-bold text-sm px-4 py-1.5 rounded-lg hover:bg-[#FDF6EE] transition-colors">
          Sign up free
        </Link>
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
          {TIERS.map(tier => (
            <div key={tier.id} className={`rounded-2xl border-2 flex flex-col overflow-hidden
              ${tier.highlight
                ? 'border-[#C8102E] shadow-lg shadow-[#C8102E]/10'
                : 'border-[#E8DDD8] bg-white'}`}>

              {tier.highlight && (
                <div className="bg-[#C8102E] text-white text-[10px] font-black tracking-widest uppercase text-center py-1.5 font-mono">
                  Most popular
                </div>
              )}

              <div className={`p-5 flex flex-col flex-1 ${tier.highlight ? 'bg-white' : ''}`}>
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
                  <Link href={tier.ctaHref}
                    className="block text-center text-sm font-bold py-2.5 rounded-xl transition-all bg-[#1A1A1A] text-white hover:bg-[#333]">
                    {tier.cta}
                  </Link>
                ) : (
                  <PricingCTA tier={tier.id} label={tier.cta} highlight={tier.highlight} />
                )}
              </div>
            </div>
          ))}
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
              a: 'Uploads of 200+ photos are automatically sent to the Anthropic Batch API, which is 50% cheaper to run. Processing takes up to an hour and you\'ll get an email when done. Available on Pro and Fleet.',
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
            <Link href="/login" className="text-[#F5F0E8]/50 hover:text-[#F5F0E8] text-xs transition-colors">Log in</Link>
            <Link href="/signup" className="text-[#F5F0E8]/50 hover:text-[#F5F0E8] text-xs transition-colors">Sign up</Link>
          </div>
        </div>
      </footer>

    </div>
  )
}
