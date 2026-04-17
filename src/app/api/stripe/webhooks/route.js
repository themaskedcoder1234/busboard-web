import { NextResponse } from 'next/server'
import { getStripe, TIER_FROM_PRICE } from '@/lib/stripe'
import { createAdminClient } from '@/lib/supabase-server'

export async function POST(request) {
  const body = await request.text()
  const sig = request.headers.get('stripe-signature')

  let event
  try {
    event = getStripe().webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET)
  } catch (err) {
    console.error('Stripe webhook signature error:', err.message)
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 })
  }

  const admin = createAdminClient()

  try {
    switch (event.type) {

      case 'checkout.session.completed': {
        const session = event.data.object
        if (session.mode !== 'subscription') break
        const userId = session.metadata?.user_id
        const tier   = session.metadata?.tier
        if (userId && tier) {
          await admin.from('profiles').update({
            subscription_tier:       tier,
            stripe_subscription_id:  session.subscription,
            tokens_used:             0,
            tokens_reset_at:         new Date().toISOString(),
            subscription_started_at: new Date().toISOString(),
          }).eq('id', userId)
        }
        break
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object
        const { data: profile } = await admin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', sub.customer)
          .single()
        if (!profile) break

        const priceId = sub.items.data[0]?.price?.id
        const newTier = TIER_FROM_PRICE[priceId]

        if (sub.status === 'active' && newTier) {
          await admin.from('profiles').update({
            subscription_tier:      newTier,
            stripe_subscription_id: sub.id,
          }).eq('id', profile.id)
        } else if (['canceled', 'unpaid', 'past_due'].includes(sub.status)) {
          await admin.from('profiles').update({
            subscription_tier:      'free',
            stripe_subscription_id: null,
          }).eq('id', profile.id)
        }
        break
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object
        const { data: profile } = await admin
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', sub.customer)
          .single()
        if (!profile) break
        await admin.from('profiles').update({
          subscription_tier:      'free',
          stripe_subscription_id: null,
        }).eq('id', profile.id)
        break
      }
    }
  } catch (err) {
    console.error('Webhook handler error:', err)
    return NextResponse.json({ error: 'Webhook handler failed' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
