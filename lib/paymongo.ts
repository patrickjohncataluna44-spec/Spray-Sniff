const PAYMONGO_API_BASE_URL = 'https://api.paymongo.com/v1'
const PAYMONGO_GCASH_METHOD = 'gcash'
const PAYMONGO_QRPH_METHOD = 'qrph'
// Prefer QR Ph when it is available, then fall back to GCash.
const PAYMONGO_SUPPORTED_CHECKOUT_METHODS = [PAYMONGO_QRPH_METHOD, PAYMONGO_GCASH_METHOD] as const

export type PaymongoHostedCheckoutMethod = (typeof PAYMONGO_SUPPORTED_CHECKOUT_METHODS)[number]
export type PaymongoEnvironment = 'live' | 'test'

export interface PaymongoCheckoutLineItem {
  name: string
  amount: number
  quantity: number
  currency?: 'PHP'
  description?: string
  images?: string[]
}

export interface PaymongoCheckoutSessionRequest {
  description: string
  lineItems: PaymongoCheckoutLineItem[]
  customerName: string
  customerEmail: string
  successUrl: string
  metadata?: Record<string, string>
}

interface PaymongoRequestOptions {
  method?: 'GET' | 'POST'
  body?: unknown
}

interface PaymongoMerchantPaymentMethodsPayload {
  data?: string[] | { attributes?: { payment_methods?: string[] } }
}

export function getPaymongoSecretKey() {
  return process.env.PAYMONGO_SECRET_KEY?.trim() ?? ''
}

export function getPaymongoPublicKey() {
  return process.env.NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY?.trim() ?? ''
}

export function isPaymongoConfigured() {
  return Boolean(getPaymongoSecretKey())
}

function getPaymongoKeyEnvironment(key: string, keyType: 'secret' | 'public'): PaymongoEnvironment | null {
  const livePrefix = keyType === 'secret' ? 'sk_live_' : 'pk_live_'
  const testPrefix = keyType === 'secret' ? 'sk_test_' : 'pk_test_'

  if (key.startsWith(livePrefix)) {
    return 'live'
  }

  if (key.startsWith(testPrefix)) {
    return 'test'
  }

  return null
}

export function getPaymongoEnvironment() {
  const secretKey = getPaymongoSecretKey()
  const publicKey = getPaymongoPublicKey()

  if (!secretKey) {
    throw new Error('PayMongo secret key is missing. Set PAYMONGO_SECRET_KEY in your environment.')
  }

  const secretEnvironment = getPaymongoKeyEnvironment(secretKey, 'secret')

  if (!secretEnvironment) {
    throw new Error('PAYMONGO_SECRET_KEY must start with sk_live_ or sk_test_.')
  }

  if (publicKey) {
    const publicEnvironment = getPaymongoKeyEnvironment(publicKey, 'public')

    if (!publicEnvironment) {
      throw new Error('NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY must start with pk_live_ or pk_test_.')
    }

    if (publicEnvironment !== secretEnvironment) {
      throw new Error('PayMongo secret and public keys must both use the same environment.')
    }
  }

  return secretEnvironment
}

export function assertPaymongoConfigured() {
  const secretKey = getPaymongoSecretKey()

  getPaymongoEnvironment()

  return secretKey
}

function getPaymongoAuthHeader() {
  const secretKey = assertPaymongoConfigured()

  return `Basic ${Buffer.from(`${secretKey}:`).toString('base64')}`
}

async function paymongoRequest<T>(path: string, options: PaymongoRequestOptions = {}) {
  const response = await fetch(`${PAYMONGO_API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Authorization: getPaymongoAuthHeader(),
      Accept: 'application/json',
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    const detail =
      payload?.errors?.[0]?.detail ??
      payload?.errors?.[0]?.code ??
      payload?.message ??
      'PayMongo request failed.'

    throw new Error(detail)
  }

  return payload as T
}

export async function getMerchantPaymentMethods() {
  return paymongoRequest<PaymongoMerchantPaymentMethodsPayload | string[]>(
    '/merchants/capabilities/payment_methods',
  )
}

function normalizeMerchantPaymentMethods(payload: PaymongoMerchantPaymentMethodsPayload | string[]) {
  if (Array.isArray(payload)) {
    return payload
  }

  if (Array.isArray(payload.data)) {
    return payload.data
  }

  return payload.data?.attributes?.payment_methods ?? []
}

function getPaymongoPaymentMethodLabel(method: string) {
  if (method === PAYMONGO_GCASH_METHOD) {
    return 'GCash'
  }

  if (method === PAYMONGO_QRPH_METHOD) {
    return 'QR Ph'
  }

  return method.toUpperCase()
}

export async function resolvePaymongoCheckoutMethod() {
  const environment = getPaymongoEnvironment()
  const payload = await getMerchantPaymentMethods()
  const methods = normalizeMerchantPaymentMethods(payload)
  const paymentMethodType = PAYMONGO_SUPPORTED_CHECKOUT_METHODS.find((method) => methods.includes(method))

  if (!paymentMethodType) {
    throw new Error(
      `This PayMongo ${environment} account does not have a supported checkout method enabled yet. Enable QR Ph or GCash in PayMongo Dashboard > Settings > Payment Methods. Currently available: ${methods.join(', ') || 'none'}.`,
    )
  }

  return {
    paymentMethodType,
    paymentMethodLabel: getPaymongoPaymentMethodLabel(paymentMethodType),
    availablePaymentMethods: methods,
    environment,
    requiresManualPaymentConfirmation:
      environment === 'test' && paymentMethodType === PAYMONGO_QRPH_METHOD,
  }
}

export async function createPaymongoCheckoutSession(input: PaymongoCheckoutSessionRequest) {
  const checkoutMethod = await resolvePaymongoCheckoutMethod()

  const payload = await paymongoRequest<{
    data: {
      id: string
      attributes: {
        checkout_url: string
        payment_method_types: string[]
        status: string
      }
    }
  }>('/checkout_sessions', {
    method: 'POST',
    body: {
      data: {
        attributes: {
          billing: {
            name: input.customerName,
            email: input.customerEmail,
          },
          description: input.description,
          line_items: input.lineItems.map((item) => ({
            name: item.name,
            amount: item.amount,
            quantity: item.quantity,
            currency: item.currency ?? 'PHP',
            description: item.description,
            images: item.images,
          })),
          payment_method_types: [checkoutMethod.paymentMethodType],
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          success_url: input.successUrl,
          metadata: input.metadata ?? {},
        },
      },
    },
  })

  return {
    ...payload,
    ...checkoutMethod,
  }
}

export async function retrievePaymongoCheckoutSession(sessionId: string) {
  return paymongoRequest<{
    data: {
      id: string
      attributes: {
        billing?: {
          name?: string
          email?: string
        }
        description?: string
        metadata?: Record<string, string>
        payment_method_types?: string[]
        payments?: Array<{
          id: string
          attributes?: {
            amount?: number
            currency?: string
            status?: string
            source?: {
              type?: string
            }
          }
        }>
        payment_intent?: {
          id: string
          attributes?: {
            status?: string
          }
        }
        status?: string
      }
    }
  }>(`/checkout_sessions/${sessionId}`)
}

export function isPaymongoCheckoutPaid(session: Awaited<ReturnType<typeof retrievePaymongoCheckoutSession>>) {
  const paymentStatuses =
    session.data.attributes.payments?.map((payment) => payment.attributes?.status).filter(Boolean) ?? []
  const intentStatus = session.data.attributes.payment_intent?.attributes?.status

  return paymentStatuses.includes('paid') || intentStatus === 'succeeded'
}
