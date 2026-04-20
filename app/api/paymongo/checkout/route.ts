import { NextResponse } from 'next/server'
import {
  assertPaymongoConfigured,
  createPaymongoCheckoutSession,
} from '@/lib/paymongo'

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
      reference,
      shippingAddress,
    } = body ?? {}

    if (!customerEmail || !customerName || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'Customer details and at least one checkout line item are required.' },
        { status: 400 },
      )
    }

    const payload = await createPaymongoCheckoutSession({
      customerEmail,
      customerName,
      description: 'SPRAY & SNIFF order checkout',
      lineItems,
      successUrl: `${getBaseUrl(request)}/checkout?paymongo=success`,
      metadata: {
        customer_email: customerEmail,
        customer_name: customerName,
        reference: reference || '',
        shipping_address: shippingAddress || '',
      },
    })

    return NextResponse.json({
      checkoutSessionId: payload.data.id,
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
