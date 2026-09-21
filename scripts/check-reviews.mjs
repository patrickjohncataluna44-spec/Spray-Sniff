import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

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
  console.log('\n=== Catalog Products ===')
  const { data: prods } = await supabase.from('catalog_products').select('id, name, scent_family')
  console.log(prods)

  console.log('\n=== Checking orders with status Delivered ===')
  const { data: deliveredOrders, error: delErr } = await supabase
    .from('store_orders')
    .select('id, customer_email, customer_name, customer_id, status')
    .eq('status', 'Delivered')

  console.log('Delivered orders in DB:', deliveredOrders?.length)
  console.log(deliveredOrders)

  console.log('\n=== Checking orders for patrick dela cruz ===')
  const { data: patrickOrders } = await supabase
    .from('store_orders')
    .select('id, customer_email, customer_name, customer_id, status')
    .or('customer_email.ilike.%patrick%,customer_name.ilike.%patrick%,customer_email.ilike.%patweak%')

  console.log('\n=== Checking items for WEB-76256849-7UZP ===')
  const { data: items } = await supabase.from('store_order_items').select('*').eq('order_id', 'WEB-76256849-7UZP')
  console.log('Items in WEB-76256849-7UZP:', items)

  console.log('\n=== Checking all order items for Patrick ===')
  const { data: allItems } = await supabase.from('store_order_items').select('*')
  console.log('Total store_order_items:', allItems?.length)
  for (const it of (allItems || [])) {
    console.log(`- Order: ${it.order_id} | Product: ${it.product_id} (${it.product_name})`)
  }
  process.exit(0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
