import { NextResponse } from 'next/server'
import {
  assertPaymongoConfigured,
  isPaymongoCheckoutPaid,
  retrievePaymongoCheckoutSession,
} from '@/lib/paymongo'

export async function GET(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> },
) {
  try {
    assertPaymongoConfigured()

    const { sessionId } = await context.params

    if (!sessionId) {
      return NextResponse.json({ error: 'Checkout session id is required.' }, { status: 400 })
    }

    const session = await retrievePaymongoCheckoutSession(sessionId)
    const paid = isPaymongoCheckoutPaid(session)

    return NextResponse.json({
      checkoutSessionId: session.data.id,
      paid,
      status: session.data.attributes.status ?? null,
      paymentMethodTypes: session.data.attributes.payment_method_types ?? [],
      paymentIntentStatus: session.data.attributes.payment_intent?.attributes?.status ?? null,
      paymentStatuses:
        session.data.attributes.payments?.map((payment) => ({
          id: payment.id,
          status: payment.attributes?.status ?? null,
          sourceType: payment.attributes?.source?.type ?? null,
        })) ?? [],
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to verify the PayMongo checkout session.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
