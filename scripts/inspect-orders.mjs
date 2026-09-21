import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envText = fs.readFileSync('.env', 'utf-8')
const envConfig = Object.fromEntries(
  envText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#') && l.includes('='))
    .map((l) => {
      const idx = l.indexOf('=')
      const k = l.slice(0, idx).trim()
      let v = l.slice(idx + 1).trim()
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1)
      }
      return [k, v]
    }),
)

const supabase = createClient(envConfig.NEXT_PUBLIC_SUPABASE_URL, envConfig.SUPABASE_SERVICE_ROLE_KEY)

async function run() {
  const { data: orders, error: ordersErr } = await supabase
    .from('store_orders')
    .select('id, customer_email, customer_name, total, payment_status, payment_method, created_at, source')
    .order('created_at', { ascending: false })

  if (ordersErr) {
    console.error('Error fetching orders:', ordersErr)
    return
  }

  console.log(`Total orders in DB now: ${orders.length}`)
  for (const o of orders.slice(0, 15)) {
    console.log(`- ${o.id} | ${o.source} | ${o.customer_email} (${o.customer_name}) | Total: ₱${o.total} | Status: ${o.payment_status} | Method: ${o.payment_method}`)
  }

  const { data: payments } = await supabase.from('payment_records').select('id, order_id, customer_email, amount, reference')
  console.log(`Total payment_records in DB now: ${payments?.length}`)
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
