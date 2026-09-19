import { getPaymongoSecretKey } from './paymongo'

export interface PendingPaymongoRecord {
  token: string
  checkoutSessionId: string
  customerEmail: string
  customerName: string
  shippingAddress: string
  expectedAmount?: number
  reference?: string
  notes?: string
  paymentMethodLabel?: string
  cartItems?: any[]
  createdAt: number
}

declare global {
  var __paymongoPendingMap: Map<string, PendingPaymongoRecord> | undefined
}

const pendingStore = globalThis.__paymongoPendingMap ?? new Map<string, PendingPaymongoRecord>()
globalThis.__paymongoPendingMap = pendingStore

const MAX_AGE_MS = 24 * 60 * 60 * 1000 // 24 hours

export function savePendingPaymongoCheckout(record: PendingPaymongoRecord) {
  cleanOldPendingRecords()
  pendingStore.set(`tok:${record.token}`, record)
  pendingStore.set(`sess:${record.checkoutSessionId}`, record)
  pendingStore.set(`email:${record.customerEmail.toLowerCase()}`, record)
}

export function getPendingPaymongoCheckoutByToken(token: string): PendingPaymongoRecord | null {
  if (!token) return null
  cleanOldPendingRecords()
  return pendingStore.get(`tok:${token}`) ?? null
}

export function getPendingPaymongoCheckoutBySessionId(sessionId: string): PendingPaymongoRecord | null {
  if (!sessionId) return null
  cleanOldPendingRecords()
  return pendingStore.get(`sess:${sessionId}`) ?? null
}

export function getLatestPendingPaymongoCheckoutByEmail(email: string): PendingPaymongoRecord | null {
  if (!email) return null
  cleanOldPendingRecords()
  return pendingStore.get(`email:${email.toLowerCase()}`) ?? null
}

export function deletePendingPaymongoCheckout(tokenOrSessionId: string) {
  const existing =
    pendingStore.get(`tok:${tokenOrSessionId}`) ??
    pendingStore.get(`sess:${tokenOrSessionId}`)
  if (existing) {
    pendingStore.delete(`tok:${existing.token}`)
    pendingStore.delete(`sess:${existing.checkoutSessionId}`)
    pendingStore.delete(`email:${existing.customerEmail.toLowerCase()}`)
  }
}

function cleanOldPendingRecords() {
  const now = Date.now()
  for (const [key, val] of pendingStore.entries()) {
    if (now - val.createdAt > MAX_AGE_MS) {
      pendingStore.delete(key)
    }
  }
}

/**
 * Searches PayMongo API for recent successful payments for a given customer email.
 * This acts as a bulletproof safety net if client storage was lost and server cache was purged.
 */
export async function findRecentPaidPaymongoPayment(email: string) {
  const secretKey = getPaymongoSecretKey()
  if (!secretKey || !email) return null

  const targetEmail = email.trim().toLowerCase()
  const auth = Buffer.from(`${secretKey}:`).toString('base64')

  try {
    const res = await fetch('https://api.paymongo.com/v1/payments?limit=10', {
      headers: {
        Authorization: `Basic ${auth}`,
        'User-Agent': 'sprayandsniff/1.0',
      },
      cache: 'no-store',
    })

    if (!res.ok) return null
    const json = await res.json()
    const payments = Array.isArray(json.data) ? json.data : []

    const matchingPayment = payments.find((p: any) => {
      const status = p.attributes?.status
      if (status !== 'paid') return false
      const billingEmail = String(p.attributes?.billing?.email || '').toLowerCase().trim()
      const metaEmail = String(p.attributes?.metadata?.customer_email || '').toLowerCase().trim()
      return billingEmail === targetEmail || metaEmail === targetEmail
    })

    if (!matchingPayment) return null

    const attrs = matchingPayment.attributes ?? {}
    const meta = attrs.metadata ?? {}

    return {
      paymentId: matchingPayment.id as string,
      amount: Number(attrs.amount ?? 0),
      currency: String(attrs.currency ?? 'PHP'),
      status: String(attrs.status),
      customerEmail: meta.customer_email || attrs.billing?.email || targetEmail,
      customerName: meta.customer_name || attrs.billing?.name || 'Customer',
      shippingAddress: meta.shipping_address || '',
      reference: meta.reference || '',
      paidAt: attrs.paid_at ? new Date(attrs.paid_at * 1000).toISOString() : new Date().toISOString(),
      sourceType: attrs.source?.type || 'qrph',
    }
  } catch (err) {
    console.error('Failed to query PayMongo recent payments:', err)
    return null
  }
}
