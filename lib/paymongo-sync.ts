import { createSupabaseAdminClient } from './supabase-server'
import { getPaymongoSecretKey } from './paymongo'
import { PAYMENT_TEST_PRODUCT_ID } from './store-engine'

interface PaymongoSyncResult {
  ok: boolean
  syncedCount: number
  recoveredOrders: string[]
  message: string
}

function generateWebOrderId(seed?: string): string {
  const randomSuffix = Math.random().toString(36).slice(2, 6).toUpperCase()
  if (seed && seed.length >= 8) {
    const cleanSeed = seed.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase()
    return `WEB-${cleanSeed}-${randomSuffix}`
  }
  const randomNum = Math.floor(10000000 + Math.random() * 90000000)
  return `WEB-${randomNum}-${randomSuffix}`
}

export async function syncPaymongoOrdersToDatabase(): Promise<PaymongoSyncResult> {
  const secretKey = getPaymongoSecretKey()
  if (!secretKey) {
    return { ok: false, syncedCount: 0, recoveredOrders: [], message: 'PayMongo secret key is not configured.' }
  }

  const auth = Buffer.from(`${secretKey}:`).toString('base64')
  const supabase = createSupabaseAdminClient()

  // 1. Fetch recent paid payments from PayMongo
  let paymongoPayments: any[] = []
  try {
    const res = await fetch('https://api.paymongo.com/v1/payments?limit=50', {
      headers: {
        Authorization: `Basic ${auth}`,
        'User-Agent': 'sprayandsniff/1.0',
      },
      cache: 'no-store',
    })
    if (!res.ok) {
      const errText = await res.text()
      return { ok: false, syncedCount: 0, recoveredOrders: [], message: `Failed to fetch PayMongo payments: ${errText}` }
    }
    const json = await res.json()
    paymongoPayments = Array.isArray(json.data) ? json.data.filter((p: any) => p.attributes?.status === 'paid') : []
  } catch (error) {
    return {
      ok: false,
      syncedCount: 0,
      recoveredOrders: [],
      message: error instanceof Error ? error.message : 'Error connecting to PayMongo',
    }
  }

  if (paymongoPayments.length === 0) {
    return { ok: true, syncedCount: 0, recoveredOrders: [], message: 'No paid payments found on PayMongo.' }
  }

  // 2. Fetch existing payment records & orders in Supabase to avoid duplicates
  const [{ data: existingPaymentRecords }, { data: existingOrders }, { data: profiles }] = await Promise.all([
    supabase.from('payment_records').select('id, order_id, checkout_session_id, reference'),
    supabase.from('store_orders').select('id, notes, customer_email'),
    supabase.from('profiles').select('id, email, full_name, phone'),
  ])

  const knownPaymentIds = new Set<string>()
  const knownSessionIds = new Set<string>()

  for (const r of existingPaymentRecords ?? []) {
    if (r.reference) knownPaymentIds.add(r.reference.trim())
    if (r.checkout_session_id) knownSessionIds.add(r.checkout_session_id.trim())
    if (r.id) knownPaymentIds.add(r.id.replace('::payment', ''))
  }

  for (const o of existingOrders ?? []) {
    if (o.notes) {
      const parts = o.notes.split('|').map((s: string) => s.trim())
      for (const p of parts) {
        if (p.startsWith('PayMongo payment:')) {
          knownPaymentIds.add(p.replace('PayMongo payment:', '').trim())
        }
        if (p.startsWith('PayMongo session:')) {
          knownSessionIds.add(p.replace('PayMongo session:', '').trim())
        }
        if (p.startsWith('pay_')) {
          knownPaymentIds.add(p)
        }
      }
    }
  }

  const recoveredOrders: string[] = []

  // 3. Process unrecorded paid payments
  for (const payment of paymongoPayments) {
    const payId = payment.id
    if (knownPaymentIds.has(payId)) {
      continue
    }

    const attr = payment.attributes ?? {}
    const billing = attr.billing ?? {}
    const meta = attr.metadata ?? {}
    const piId = attr.payment_intent_id

    const customerEmail = (meta.customer_email || billing.email || '').trim()
    const customerName = (meta.customer_name || billing.name || 'Valued Customer').trim()
    const shippingAddress = (meta.shipping_address || '').trim()
    const amount = typeof attr.amount === 'number' ? attr.amount / 100 : 1
    const paidAt = attr.paid_at
      ? new Date(attr.paid_at * 1000).toISOString()
      : attr.created_at
        ? new Date(attr.created_at * 1000).toISOString()
        : new Date().toISOString()
    const channel = attr.source?.type ? String(attr.source.type).toUpperCase() : 'QRPH'
    const checkoutToken = meta.checkout_token || ''

    // Check if session ID can be discovered
    let checkoutSessionId: string | null = null
    let sessionLineItems: any[] = []

    if (piId) {
      try {
        const sessRes = await fetch(`https://api.paymongo.com/v1/checkout_sessions?payment_intent_id=${piId}`, {
          headers: { Authorization: `Basic ${auth}` },
          cache: 'no-store',
        })
        if (sessRes.ok) {
          const sessJson = await sessRes.json()
          const firstSession = Array.isArray(sessJson.data) ? sessJson.data[0] : null
          if (firstSession) {
            checkoutSessionId = firstSession.id
            if (knownSessionIds.has(firstSession.id)) {
              // Already recorded via checkoutSessionId
              continue
            }
            if (Array.isArray(firstSession.attributes?.line_items)) {
              sessionLineItems = firstSession.attributes.line_items
            }
          }
        }
      } catch (err) {
        console.warn(`[paymongo-sync] Could not retrieve checkout session for ${piId}:`, err)
      }
    }

    // Match customer in profiles
    let matchedProfile = (profiles ?? []).find(
      (p) => p.email && p.email.toLowerCase().trim() === customerEmail.toLowerCase(),
    )

    // Secondary match: check if name matches if email is missing or alternate
    if (!matchedProfile && customerName && customerName !== 'Valued Customer') {
      matchedProfile = (profiles ?? []).find(
        (p) => p.full_name && p.full_name.toLowerCase().trim() === customerName.toLowerCase(),
      )
    }

    const orderId = generateWebOrderId(payId)

    // Build items
    const orderItems: Array<{
      id: string
      order_id: string
      product_id: string
      product_name: string
      size_ml: number
      quantity: number
      unit_price: number
    }> = []

    if (sessionLineItems.length > 0) {
      sessionLineItems.forEach((item: any, idx: number) => {
        const itemAmount = typeof item.amount === 'number' ? item.amount / 100 : amount
        orderItems.push({
          id: `${orderId}-item-${idx + 1}`,
          order_id: orderId,
          product_id: PAYMENT_TEST_PRODUCT_ID,
          product_name: item.name || 'Perfume Order Item',
          size_ml: 50,
          quantity: item.quantity || 1,
          unit_price: itemAmount,
        })
      })
    } else {
      orderItems.push({
        id: `${orderId}-item-1`,
        order_id: orderId,
        product_id: PAYMENT_TEST_PRODUCT_ID,
        product_name: 'Payment Test Item - 50ml',
        size_ml: 50,
        quantity: 1,
        unit_price: amount,
      })
    }

    const notes = [
      `PayMongo payment: ${payId}`,
      checkoutSessionId ? `PayMongo session: ${checkoutSessionId}` : '',
      checkoutToken ? `checkout_token: ${checkoutToken}` : '',
      `PayMongo channel: ${channel}`,
    ]
      .filter(Boolean)
      .join(' | ')

    // Insert order into Supabase
    const { error: orderInsertErr } = await supabase.from('store_orders').insert({
      id: orderId,
      source: 'ONLINE',
      customer_id: matchedProfile?.id ?? null,
      customer_name: customerName,
      customer_email: customerEmail || (matchedProfile?.email ?? 'customer@sprayandsniff.com'),
      status: 'Pending',
      payment_method: 'PayMongo',
      payment_status: 'Paid',
      created_at: paidAt,
      updated_at: new Date().toISOString(),
      subtotal: amount,
      tax: 0,
      shipping: 0,
      total: amount,
      shipping_address: shippingAddress || 'Customer shipping address',
      notes,
    })

    if (orderInsertErr) {
      console.error(`[paymongo-sync] Failed to insert order ${orderId}:`, orderInsertErr)
      continue
    }

    // Insert order items
    if (orderItems.length > 0) {
      await supabase.from('store_order_items').insert(orderItems)
    }

    // Insert timeline entry
    await supabase.from('order_timeline_entries').insert({
      id: `${orderId}-timeline-1`,
      order_id: orderId,
      status: 'Pending',
      created_at: paidAt,
      note: `Online order created & payment of ₱${amount.toFixed(2)} confirmed via PayMongo (${channel}).`,
      actor_name: 'PayMongo Gateway',
    })

    // Insert payment record
    await supabase.from('payment_records').insert({
      id: `${orderId}::payment`,
      order_id: orderId,
      source: 'ONLINE',
      customer_id: matchedProfile?.id ?? null,
      customer_name: customerName,
      customer_email: customerEmail || (matchedProfile?.email ?? 'customer@sprayandsniff.com'),
      amount,
      subtotal: amount,
      tax: 0,
      shipping: 0,
      payment_method: 'PayMongo',
      payment_gateway: 'PayMongo',
      payment_channel: channel,
      checkout_session_id: checkoutSessionId,
      reference: payId,
      status: 'succeeded',
      paid_at: paidAt,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })

    knownPaymentIds.add(payId)
    if (checkoutSessionId) knownSessionIds.add(checkoutSessionId)
    recoveredOrders.push(`${orderId} (${customerEmail} - ₱${amount})`)
  }

  return {
    ok: true,
    syncedCount: recoveredOrders.length,
    recoveredOrders,
    message:
      recoveredOrders.length > 0
        ? `Successfully synced and recovered ${recoveredOrders.length} orders from PayMongo!`
        : 'All PayMongo payments are already recorded and up to date.',
  }
}
