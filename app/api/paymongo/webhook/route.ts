import { NextRequest, NextResponse } from 'next/server'
import { syncPaymongoOrdersToDatabase } from '@/lib/paymongo-sync'

export async function POST(request: NextRequest) {
  try {
    const payload = await request.json().catch(() => ({}))
    const eventType = payload?.data?.attributes?.type

    console.log(`[paymongo-webhook] Received event: ${eventType}`)

    // If payment.paid or checkout_session.payment.paid, sync immediately
    if (
      eventType === 'payment.paid' ||
      eventType === 'checkout_session.payment.paid' ||
      !eventType
    ) {
      const syncResult = await syncPaymongoOrdersToDatabase()
      return NextResponse.json({ received: true, syncResult })
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('[paymongo-webhook] Webhook handler error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Webhook error' },
      { status: 500 },
    )
  }
}
