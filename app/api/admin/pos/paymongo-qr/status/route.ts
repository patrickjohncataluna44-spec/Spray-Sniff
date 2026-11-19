import { NextRequest, NextResponse } from 'next/server'
import {
  assertPaymongoConfigured,
  getPaymongoPaidPayment,
  isPaymongoCheckoutPaid,
  isPaymongoPaymentIntentPaid,
  retrievePaymongoCheckoutSession,
  retrievePaymongoPaymentIntent,
} from '@/lib/paymongo'
import { getRequestActor } from '@/lib/server-auth'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const paymentIntentId = searchParams.get('paymentIntentId')
    const sessionId = searchParams.get('sessionId')

    if (!paymentIntentId && !sessionId) {
      return NextResponse.json(
        { ok: false, error: 'Payment Intent ID or Session ID is required.' },
        { status: 400 },
      )
    }

    const actor = await getRequestActor(request)

    if (!actor || (actor.role !== 'ADMIN' && actor.role !== 'STAFF')) {
      return NextResponse.json(
        { ok: false, error: 'Only staff and admins can check POS payment status.' },
        { status: 403 },
      )
    }

    assertPaymongoConfigured()

    if (paymentIntentId) {
      const intent = await retrievePaymongoPaymentIntent(paymentIntentId)
      const isPaid = isPaymongoPaymentIntentPaid(intent)
      const paidPayment = intent.data.attributes.payments?.find((p) => p.attributes?.status === 'paid')

      return NextResponse.json({
        ok: true,
        paymentIntentId,
        isPaid,
        status: isPaid ? 'paid' : intent.data.attributes.status,
        paymentId: paidPayment?.id ?? intent.data.attributes.payments?.[0]?.id ?? null,
        paidAmount: paidPayment?.attributes?.amount ? paidPayment.attributes.amount / 100 : null,
        paidCurrency: intent.data.attributes.currency ?? 'PHP',
        paymentChannel: paidPayment?.attributes?.source?.type ?? 'qrph',
      })
    }

    if (sessionId) {
      const session = await retrievePaymongoCheckoutSession(sessionId)
      const isPaid = isPaymongoCheckoutPaid(session)
      const paidPayment = getPaymongoPaidPayment(session)

      return NextResponse.json({
        ok: true,
        sessionId,
        isPaid,
        status: isPaid ? 'paid' : session.data.attributes.status || 'pending',
        paymentId: paidPayment?.id ?? null,
        paidAmount: paidPayment?.attributes?.amount ? paidPayment.attributes.amount / 100 : null,
        paidCurrency: paidPayment?.attributes?.currency ?? 'PHP',
        paymentChannel: paidPayment?.attributes?.source?.type ?? null,
      })
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to check PayMongo payment status.'

    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
