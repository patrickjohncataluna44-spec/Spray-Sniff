import { NextResponse } from 'next/server'
import {
  assertPaymongoConfigured,
  PAYMONGO_ORDER_CHECKOUT_DESCRIPTION,
  createPaymongoCheckoutSession,
} from '@/lib/paymongo'
import { savePendingPaymongoCheckout } from '@/lib/paymongo-pending'
import crypto from 'crypto'

function getBaseUrl(request: Request) {
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  return new URL(request.url).origin
}

export async function POST(request: Request) {
  try {
    assertPaymongoConfigured()

    const body = await request.json()
    const {
      customerEmail,
      customerName,
      lineItems,
      expectedAmount,
      reference,
      shippingAddress,
      notes,
      cartItems,
      clientToken,
    } = body ?? {}

    if (!customerEmail || !customerName || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'Customer details and at least one checkout line item are required.' },
        { status: 400 },
      )
    }

    const checkoutToken = clientToken || crypto.randomUUID()
    const baseUrl = getBaseUrl(request)
    const successUrl = `${baseUrl}/checkout?paymongo=success&session_token=${checkoutToken}`

    const payload = await createPaymongoCheckoutSession({
      customerEmail,
      customerName,
      description: PAYMONGO_ORDER_CHECKOUT_DESCRIPTION,
      lineItems,
      successUrl,
      metadata: {
        customer_email: customerEmail,
        customer_name: customerName,
        expected_amount: typeof expectedAmount === 'number' ? String(expectedAmount) : '',
        reference: reference || '',
        shipping_address: shippingAddress || '',
        checkout_token: checkoutToken,
      },
    })

    savePendingPaymongoCheckout({
      token: checkoutToken,
      checkoutSessionId: payload.data.id,
      customerEmail,
      customerName,
      shippingAddress: shippingAddress || '',
      expectedAmount: typeof expectedAmount === 'number' ? expectedAmount : undefined,
      reference: reference || '',
      notes: notes || '',
      paymentMethodLabel: payload.paymentMethodLabel,
      cartItems: Array.isArray(cartItems) ? cartItems : undefined,
      createdAt: Date.now(),
    })

    return NextResponse.json({
      checkoutSessionId: payload.data.id,
      checkoutToken,
      checkoutUrl: payload.data.attributes.checkout_url,
      status: payload.data.attributes.status,
      paymentMethodType: payload.paymentMethodType,
      paymentMethodLabel: payload.paymentMethodLabel,
      availablePaymentMethods: payload.availablePaymentMethods,
      environment: payload.environment,
      requiresManualPaymentConfirmation: payload.requiresManualPaymentConfirmation,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to create the PayMongo checkout session.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
