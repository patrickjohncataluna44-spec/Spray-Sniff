import { NextRequest, NextResponse } from 'next/server'
import {
  assertPaymongoConfigured,
  PAYMONGO_ORDER_CHECKOUT_DESCRIPTION,
  createPaymongoCheckoutSession,
} from '@/lib/paymongo'
import { savePendingPaymongoCheckout } from '@/lib/paymongo-pending'
import { getRequestActor } from '@/lib/server-auth'
import crypto from 'crypto'

function getBaseUrl(request: Request) {
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  return new URL(request.url).origin
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getRequestActor(request)
    if (!actor) {
      return NextResponse.json(
        { error: 'Please sign in before creating a checkout session.' },
        { status: 401 },
      )
    }

    assertPaymongoConfigured()

    const body = await request.json()
    const {
      customerName,
      lineItems,
      expectedAmount,
      reference,
      shippingAddress,
      notes,
      cartItems,
      clientToken,
    } = body ?? {}

    const customerEmail = actor.email.trim().toLowerCase()
    const resolvedCustomerName = (typeof customerName === 'string' && customerName.trim()) || actor.name

    if (!customerEmail || !resolvedCustomerName || !Array.isArray(lineItems) || lineItems.length === 0) {
      return NextResponse.json(
        { error: 'Customer details and at least one checkout line item are required.' },
        { status: 400 },
      )
    }

    const sanitizedLineItems = lineItems.map((item: { name?: unknown; amount?: unknown; quantity?: unknown; currency?: unknown; description?: unknown }) => {
      const amount = Math.round(Number(item?.amount))
      const quantity = Math.round(Number(item?.quantity))
      if (!Number.isFinite(amount) || amount < 100 || !Number.isFinite(quantity) || quantity < 1) {
        throw new Error('Checkout line items must have valid positive amounts and quantities.')
      }
      return {
        name: String(item?.name || 'Fragrance Item').slice(0, 120),
        amount,
        quantity,
        currency: 'PHP' as const,
        description: typeof item?.description === 'string' ? item.description.slice(0, 200) : undefined,
      }
    })

    const computedSum = sanitizedLineItems.reduce((sum, li) => sum + li.amount * li.quantity, 0)
    if (computedSum < 100) {
      return NextResponse.json(
        { error: 'Checkout total must be at least ₱1.00.' },
        { status: 400 },
      )
    }

    const checkoutToken = clientToken || crypto.randomUUID()
    const baseUrl = getBaseUrl(request)
    const successUrl = `${baseUrl}/checkout?paymongo=success&session_token=${checkoutToken}`

    const payload = await createPaymongoCheckoutSession({
      customerEmail,
      customerName: resolvedCustomerName,
      description: PAYMONGO_ORDER_CHECKOUT_DESCRIPTION,
      lineItems: sanitizedLineItems,
      successUrl,
      metadata: {
        customer_id: actor.id,
        customer_email: customerEmail,
        customer_name: resolvedCustomerName,
        expected_amount: String(typeof expectedAmount === 'number' && expectedAmount >= 100 ? Math.round(expectedAmount) : computedSum),
        reference: reference || '',
        shipping_address: shippingAddress || '',
        checkout_token: checkoutToken,
      },
    })

    savePendingPaymongoCheckout({
      token: checkoutToken,
      checkoutSessionId: payload.data.id,
      customerEmail,
      customerName: resolvedCustomerName,
      shippingAddress: shippingAddress || '',
      expectedAmount: typeof expectedAmount === 'number' && expectedAmount >= 100 ? Math.round(expectedAmount) : computedSum,
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
