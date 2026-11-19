import assert from 'node:assert/strict'
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'

function loadEnv() {
  const envText = fs.readFileSync('.env', 'utf-8')
  return Object.fromEntries(
    envText
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const idx = line.indexOf('=')
        const key = line.slice(0, idx).trim()
        let val = line.slice(idx + 1).trim()
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1)
        }
        return [key, val]
      }),
  )
}

function roundCurrency(value) {
  return Math.round(value * 100) / 100
}

function getManilaMonthKey(dateIso) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
  }).formatToParts(new Date(dateIso))
  const year = parts.find((p) => p.type === 'year')?.value
  const month = parts.find((p) => p.type === 'month')?.value
  return `${year}-${month}`
}

async function main() {
  const env = loadEnv()
  const supabase = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY,
  )

  const [{ data: orders, error: oErr }, { data: payments, error: pErr }, { data: snap, error: sErr }] =
    await Promise.all([
      supabase
        .from('store_orders')
        .select('id, source, status, payment_method, payment_status, subtotal, tax, shipping, total, created_at'),
      supabase
        .from('payment_records')
        .select('id, order_id, amount, status'),
      supabase
        .from('app_store_snapshots')
        .select('state')
        .eq('id', 'default')
        .maybeSingle(),
    ])

  if (oErr) throw oErr
  if (pErr) throw pErr
  if (sErr) throw sErr

  const paidOrders = (orders || []).filter(
    (o) => o.payment_status === 'Paid' && o.status !== 'Cancelled',
  )

  const totalRevenue = roundCurrency(paidOrders.reduce((s, o) => s + Number(o.total), 0))
  const onlineRevenue = roundCurrency(
    paidOrders.filter((o) => o.source === 'ONLINE').reduce((s, o) => s + Number(o.total), 0),
  )
  const posRevenue = roundCurrency(
    paidOrders.filter((o) => o.source === 'POS').reduce((s, o) => s + Number(o.total), 0),
  )
  const totalSubtotal = roundCurrency(paidOrders.reduce((s, o) => s + Number(o.subtotal), 0))
  const totalTax = roundCurrency(paidOrders.reduce((s, o) => s + Number(o.tax), 0))
  const totalShipping = roundCurrency(paidOrders.reduce((s, o) => s + Number(o.shipping), 0))

  assert.equal(
    roundCurrency(onlineRevenue + posRevenue),
    totalRevenue,
    'Online + POS must equal Paid Revenue',
  )
  assert.equal(
    roundCurrency(totalSubtotal + totalTax + totalShipping),
    totalRevenue,
    'Subtotal + Tax + Shipping must equal Paid Revenue',
  )

  const paidIds = new Set(paidOrders.map((o) => o.id))
  const matchedPaymentsSum = roundCurrency(
    (payments || [])
      .filter((p) => p.status === 'succeeded' && paidIds.has(p.order_id))
      .reduce((s, p) => s + Number(p.amount), 0),
  )
  assert.equal(
    matchedPaymentsSum,
    totalRevenue,
    'payment_records for active paid orders must equal Paid Revenue',
  )

  const monthlyTotals = new Map()
  for (const order of paidOrders) {
    const key = getManilaMonthKey(order.created_at)
    const entry = monthlyTotals.get(key) ?? { orders: 0, online: 0, pos: 0, total: 0 }
    entry.orders += 1
    entry.total = roundCurrency(entry.total + Number(order.total))
    if (order.source === 'ONLINE') {
      entry.online = roundCurrency(entry.online + Number(order.total))
    } else {
      entry.pos = roundCurrency(entry.pos + Number(order.total))
    }
    monthlyTotals.set(key, entry)
  }

  const monthlySum = roundCurrency(
    Array.from(monthlyTotals.values()).reduce((s, m) => s + m.total, 0),
  )
  assert.equal(monthlySum, totalRevenue, 'Monthly sums must equal Paid Revenue')

  const snapPaidOrders = (snap?.state?.orders || []).filter(
    (o) => o.paymentStatus === 'Paid' && o.status !== 'Cancelled',
  )
  const snapTotal = roundCurrency(
    snapPaidOrders.reduce((s, o) => s + Number(o.total), 0),
  )
  assert.equal(snapPaidOrders.length, paidOrders.length, 'Snapshot paid order count must match store_orders')
  assert.equal(snapTotal, totalRevenue, 'Snapshot paid revenue must match store_orders')

  console.log('=== SALES RECONCILIATION PASSED ===')
  console.log({
    paidOrdersCount: paidOrders.length,
    totalRevenue,
    onlineRevenue,
    posRevenue,
    totalSubtotal,
    totalTax,
    monthlyBreakdown: Object.fromEntries(Array.from(monthlyTotals.entries()).sort()),
  })
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Sales reconciliation failed:', err)
    process.exit(1)
  })
