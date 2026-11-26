import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { paymentsEnabled, recordCompletedCheckout, verifyWebhook } from '@/lib/payments'

export const dynamic = 'force-dynamic'

/**
 * Stripe calls this endpoint. It is public (no session cookie) because Stripe cannot log in;
 * the request is trusted only if its signature verifies against STRIPE_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  if (!paymentsEnabled()) return new NextResponse('Not found', { status: 404 })

  const rawBody = await req.text()
  const event = verifyWebhook(rawBody, req.headers.get('stripe-signature'))
  if (!event) return new NextResponse('Invalid signature', { status: 400 })

  if (event.type === 'checkout.session.completed') {
    // Throws on a database error, so Stripe retries the delivery
    await recordCompletedCheckout(event.data.object as Stripe.Checkout.Session)
  }

  return NextResponse.json({ received: true })
}
