import Stripe from 'stripe'

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20',
})

// Create these prices in your Stripe dashboard (recurring, monthly, GBP)
// then set the price IDs as environment variables
export const STRIPE_PRICE_IDS = {
  basic: process.env.STRIPE_PRICE_BASIC,   // £8/mo
  pro:   process.env.STRIPE_PRICE_PRO,     // £19/mo
  fleet: process.env.STRIPE_PRICE_FLEET,   // £49/mo
}

// Reverse map used in webhook handler: Stripe price ID → tier name
export const TIER_FROM_PRICE = Object.fromEntries(
  Object.entries(STRIPE_PRICE_IDS)
    .filter(([, priceId]) => priceId)
    .map(([tier, priceId]) => [priceId, tier])
)
