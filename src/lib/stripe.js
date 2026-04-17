import Stripe from 'stripe'

// Lazy singleton — not instantiated at module load so the build succeeds
// without STRIPE_SECRET_KEY being set at build time.
let _stripe

export function getStripe() {
  if (!_stripe) {
    _stripe = new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2024-06-20' })
  }
  return _stripe
}

export const STRIPE_PRICE_IDS = {
  basic: process.env.STRIPE_PRICE_BASIC,
  pro:   process.env.STRIPE_PRICE_PRO,
  fleet: process.env.STRIPE_PRICE_FLEET,
}

// Reverse map: Stripe price ID → tier name (used in webhook handler)
export const TIER_FROM_PRICE = Object.fromEntries(
  Object.entries(STRIPE_PRICE_IDS)
    .filter(([, priceId]) => priceId)
    .map(([tier, priceId]) => [priceId, tier])
)
