import { NextRequest, NextResponse } from 'next/server'
import {
  assertPaymongoConfigured,
  createPaymongoRefund,
  retrievePaymongoCheckoutSession,
} from '@/lib/paymongo'
import { getRequestActor } from '@/lib/server-auth'

// PayMongo does NOT support API refunds for QR Ph or GCash.
// These must be processed manually via the PayMongo Dashboard.
const NON_REFUNDABLE_SOURCE_TYPES = ['qrph', 'gcash']

export async function POST(request: NextRequest) {
  try {
    assertPaymongoConfigured()

    // Auth — must be ADMIN or STAFF
    const actor = await getRequestActor(request)
    if (!actor || (actor.role !== 'ADMIN' && actor.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 })
    }

    const body = (await request.json().catch(() => null)) as {
      checkoutSessionId?: string
      amount?: number
      reason?: string
      notes?: string
    } | null

    if (!body?.checkoutSessionId) {
      return NextResponse.json(
        { error: 'checkoutSessionId is required.' },
        { status: 400 },
      )
    }

    // 1. Retrieve the checkout session to find the paid payment
    const session = await retrievePaymongoCheckoutSession(body.checkoutSessionId)
    const payments = session.data.attributes.payments ?? []
    const paidPayment = payments.find((p) => p.attributes?.status === 'paid')

    if (!paidPayment) {
      return NextResponse.json(
        { error: 'No paid payment found for this checkout session. The payment may still be pending or was already refunded.' },
        { status: 400 },
      )
    }

    const paymentId = paidPayment.id
    const sourceType = paidPayment.attributes?.source?.type ?? ''
    const originalAmount = paidPayment.attributes?.amount

    // 2. Check if the payment method supports API refunds
    if (NON_REFUNDABLE_SOURCE_TYPES.includes(sourceType)) {
      return NextResponse.json(
        {
          error: `PayMongo does not support automatic API refunds for ${sourceType.toUpperCase()} payments. Please process this refund manually via the PayMongo Dashboard.`,
          manualRefundRequired: true,
          paymentId,
          sourceType,
          dashboardUrl: 'https://dashboard.paymongo.com/payments',
        },
        { status: 422 },
      )
    }

    if (!originalAmount) {
      return NextResponse.json(
        { error: 'Could not read the payment amount from PayMongo.' },
        { status: 400 },
      )
    }

    const refundAmount = body.amount ?? originalAmount

    // 3. Issue the refund via PayMongo Refunds API (cards only)
    const refund = await createPaymongoRefund({
      paymentId,
      amount: refundAmount,
      reason: (body.reason as 'duplicate' | 'fraudulent' | 'others') ?? 'others',
      notes: body.notes ?? 'Admin-issued refund via store dashboard.',
    })

    return NextResponse.json({
      ok: true,
      refundId: refund.data.id,
      status: refund.data.attributes.status,
      amount: refund.data.attributes.amount,
      message: `Refund of ₱${(refundAmount / 100).toFixed(2)} issued successfully. PayMongo Refund ID: ${refund.data.id}`,
    })
  } catch (error) {
    console.error('[/api/paymongo/refund] error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to process the refund.' },
      { status: 500 },
    )
  }
}
