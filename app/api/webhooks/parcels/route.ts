import { NextResponse } from 'next/server'
import { getOptionalServerEnv } from '@/lib/server-runtime-env'

/**
 * ParcelsApp Webhook Endpoint
 *
 * Delivery progress is admin-managed: this endpoint never writes an order's
 * stage on its own. It only acknowledges checkpoints so the courier integration
 * has somewhere to post, and it requires a shared secret so the route cannot be
 * used to inject arbitrary delivery data.
 */
export async function POST(req: Request) {
  const expectedSecret = getOptionalServerEnv('PARCELS_WEBHOOK_SECRET')

  if (!expectedSecret) {
    return NextResponse.json(
      { error: 'Webhook is not configured for this environment.' },
      { status: 503 },
    )
  }

  const providedSecret =
    req.headers.get('x-webhook-secret')?.trim() ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim()

  if (providedSecret !== expectedSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const payload = await req.json().catch(() => null)

    if (!payload) {
      return NextResponse.json({ error: 'Empty payload' }, { status: 400 })
    }

    console.log('[ParcelsApp Webhook Received]:', {
      trackingNumber: payload?.tracking_number,
      status: payload?.status,
      timestamp: new Date().toISOString(),
    })

    // Delivery stages are set by an admin from Admin -> Orders. If this
    // integration is ever wired up to advance stages automatically, it must go
    // through the same validated, admin-audited path rather than writing here.

    return NextResponse.json({
      received: true,
      status: 'acknowledged',
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Webhook processing error', details: String(error) },
      { status: 500 },
    )
  }
}
