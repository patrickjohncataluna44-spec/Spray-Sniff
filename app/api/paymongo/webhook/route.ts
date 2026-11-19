import { NextRequest, NextResponse } from 'next/server'
import { verifyPaymongoWebhookSignature } from '@/lib/paymongo'
import { syncPaymongoOrdersToDatabase } from '@/lib/paymongo-sync'
import { getOptionalServerEnv } from '@/lib/server-runtime-env'

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const webhookSecret = getOptionalServerEnv('PAYMONGO_WEBHOOK_SECRET')

    if (webhookSecret) {
      const signatureHeader = request.headers.get('paymongo-signature')
      const verification = verifyPaymongoWebhookSignature(rawBody, signatureHeader, webhookSecret)
      if (!verification.valid) {
        return NextResponse.json(
          { error: verification.reason || 'Unauthorized webhook signature.' },
          { status: 401 },
        )
      }
    }

    const payload = (() => {
      try {
        return rawBody ? JSON.parse(rawBody) : {}
      } catch {
        return {}
      }
    })()
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
