import { NextResponse } from 'next/server'
import {
  getPendingPaymongoCheckoutByToken,
  getPendingPaymongoCheckoutBySessionId,
  getLatestPendingPaymongoCheckoutByEmail,
  findRecentPaidPaymongoPayment,
  savePendingPaymongoCheckout,
} from '@/lib/paymongo-pending'
import { retrievePaymongoCheckoutSession } from '@/lib/paymongo'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token') || searchParams.get('session_token') || ''
    const sessionId = searchParams.get('sessionId') || searchParams.get('session_id') || ''
    const email = searchParams.get('email') || ''

    // 1. Try token lookup
    if (token) {
      const record = getPendingPaymongoCheckoutByToken(token)
      if (record) {
        return NextResponse.json({ ok: true, pendingCheckout: record })
      }
    }

    // 2. Try sessionId lookup
    if (sessionId) {
      const record = getPendingPaymongoCheckoutBySessionId(sessionId)
      if (record) {
        return NextResponse.json({ ok: true, pendingCheckout: record })
      }

      // If not in cache, query PayMongo directly for this session
      try {
        const session = await retrievePaymongoCheckoutSession(sessionId)
        if (session?.data?.id) {
          const meta = session.data.attributes.metadata ?? {}
          const reconstructed = {
            token: token || `rec_${Date.now()}`,
            checkoutSessionId: session.data.id,
            customerEmail: meta.customer_email || session.data.attributes.billing?.email || '',
            customerName: meta.customer_name || session.data.attributes.billing?.name || '',
            shippingAddress: meta.shipping_address || '',
            expectedAmount: meta.expected_amount ? Number(meta.expected_amount) : undefined,
            reference: meta.reference || '',
            notes: '',
            paymentMethodLabel: 'PayMongo',
            createdAt: Date.now(),
          }
          savePendingPaymongoCheckout(reconstructed)
          return NextResponse.json({ ok: true, pendingCheckout: reconstructed })
        }
      } catch (err) {
        console.warn('Direct session retrieval failed:', err)
      }
    }

    // 3. Try customer email lookup from pending cache
    if (email) {
      const record = getLatestPendingPaymongoCheckoutByEmail(email)
      if (record) {
        return NextResponse.json({ ok: true, pendingCheckout: record })
      }

      // 4. Fallback: check PayMongo recent successful payments for this email
      const recentPaid = await findRecentPaidPaymongoPayment(email)
      if (recentPaid) {
        const recovered = {
          token: `paid_${recentPaid.paymentId}`,
          checkoutSessionId: recentPaid.paymentId,
          customerEmail: recentPaid.customerEmail,
          customerName: recentPaid.customerName,
          shippingAddress: recentPaid.shippingAddress,
          expectedAmount: recentPaid.amount,
          reference: recentPaid.reference,
          notes: `Recovered PayMongo payment: ${recentPaid.paymentId}`,
          paymentMethodLabel: recentPaid.sourceType.toUpperCase(),
          createdAt: Date.now(),
        }
        savePendingPaymongoCheckout(recovered)
        return NextResponse.json({ ok: true, pendingCheckout: recovered, recovered: true })
      }
    }

    return NextResponse.json({ ok: false, message: 'No pending session found.' }, { status: 404 })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to check pending session.'
    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
