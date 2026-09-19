import { NextResponse } from 'next/server'
import {
  assertPaymongoConfigured,
  getPaymongoCheckoutPaidAmount,
  getPaymongoCheckoutPaidCurrency,
  getPaymongoPaidPayment,
  isPaymongoCheckoutPaid,
  retrievePaymongoCheckoutSession,
  retrievePaymongoPayment,
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

    if (sessionId.startsWith('pay_')) {
      const paymentRes = await retrievePaymongoPayment(sessionId)
      const p = paymentRes.data
      const isPaid = p.attributes.status === 'paid'
      return NextResponse.json({
        checkoutSessionId: p.id,
        paid: isPaid,
        isPaid,
        status: p.attributes.status ?? null,
        billingEmail: p.attributes.billing?.email ?? null,
        billingName: p.attributes.billing?.name ?? null,
        metadata: p.attributes.metadata ?? {},
        paymentMethodTypes: [p.attributes.source?.type ?? 'qrph'],
        paymentIntentStatus: null,
        paidAmount: p.attributes.amount,
        paidCurrency: p.attributes.currency,
        paidPaymentId: p.id,
        paidSourceType: p.attributes.source?.type ?? null,
        paymentStatuses: [{ id: p.id, status: p.attributes.status, sourceType: p.attributes.source?.type ?? null }],
      })
    }

    const session = await retrievePaymongoCheckoutSession(sessionId)
    const paid = isPaymongoCheckoutPaid(session)
    const paidPayment = getPaymongoPaidPayment(session)

    return NextResponse.json({
      checkoutSessionId: session.data.id,
      paid,
      isPaid: paid,
      status: session.data.attributes.status ?? null,
      billingEmail: session.data.attributes.billing?.email ?? null,
      billingName: session.data.attributes.billing?.name ?? null,
      metadata: session.data.attributes.metadata ?? {},
      paymentMethodTypes: session.data.attributes.payment_method_types ?? [],
      paymentIntentStatus: session.data.attributes.payment_intent?.attributes?.status ?? null,
      paidAmount: getPaymongoCheckoutPaidAmount(session),
      paidCurrency: getPaymongoCheckoutPaidCurrency(session),
      paidPaymentId: paidPayment?.id ?? null,
      paidSourceType: paidPayment?.attributes?.source?.type ?? null,
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
