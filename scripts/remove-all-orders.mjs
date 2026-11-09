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

async function removeAllOrders() {
  console.log('=== STARTING PERMANENT ORDERS REMOVAL ===')

  // 1. Delete order timeline entries
  console.log('1. Deleting order_timeline_entries...')
  const { error: timelineErr } = await supabase
    .from('order_timeline_entries')
    .delete()
    .neq('id', '___none___')
  if (timelineErr) {
    throw new Error(`Failed to delete order_timeline_entries: ${timelineErr.message}`)
  }
  console.log('✓ order_timeline_entries deleted')

  // 2. Delete store order items
  console.log('2. Deleting store_order_items...')
  const { error: itemsErr } = await supabase
    .from('store_order_items')
    .delete()
    .neq('id', '___none___')
  if (itemsErr) {
    throw new Error(`Failed to delete store_order_items: ${itemsErr.message}`)
  }
  console.log('✓ store_order_items deleted')

  // 3. Delete payment records
  console.log('3. Deleting payment_records...')
  const { error: payErr } = await supabase
    .from('payment_records')
    .delete()
    .neq('id', '___none___')
  if (payErr) {
    throw new Error(`Failed to delete payment_records: ${payErr.message}`)
  }
  console.log('✓ payment_records deleted')

  // 4. Delete stock movements
  console.log('4. Deleting stock_movements...')
  const { error: stockErr } = await supabase
    .from('stock_movements')
    .delete()
    .neq('id', '___none___')
  if (stockErr) {
    console.warn(`Warning deleting stock_movements: ${stockErr.message}`)
  } else {
    console.log('✓ stock_movements deleted')
  }

  // 5. Delete store orders
  console.log('5. Deleting store_orders...')
  const { error: ordersErr } = await supabase
    .from('store_orders')
    .delete()
    .neq('id', '___none___')
  if (ordersErr) {
    throw new Error(`Failed to delete store_orders: ${ordersErr.message}`)
  }
  console.log('✓ store_orders deleted')

  // 6. Update app_store_snapshots
  console.log('6. Updating app_store_snapshots...')
  const { data: snapData, error: snapFetchErr } = await supabase
    .from('app_store_snapshots')
    .select('id, state')
    .eq('id', 'default')
    .maybeSingle()

  if (snapFetchErr) {
    throw new Error(`Failed to fetch app_store_snapshots: ${snapFetchErr.message}`)
  }

  const existingState = snapData?.state || {}
  const nextBackofficeState = {
    ...existingState,
    orders: [],
    posTransactions: [],
    stockMovements: [],
  }

  const { error: snapUpdateErr } = await supabase
    .from('app_store_snapshots')
    .upsert({
      id: 'default',
      state: nextBackofficeState,
    })
  if (snapUpdateErr) {
    throw new Error(`Failed to update app_store_snapshots: ${snapUpdateErr.message}`)
  }
  console.log('✓ app_store_snapshots updated with 0 orders')

  // 7. Update public_store_snapshots
  console.log('7. Updating public_store_snapshots...')
  const { data: pubData, error: pubFetchErr } = await supabase
    .from('public_store_snapshots')
    .select('id, state')
    .eq('id', 'default')
    .maybeSingle()

  if (pubFetchErr) {
    throw new Error(`Failed to fetch public_store_snapshots: ${pubFetchErr.message}`)
  }

  const existingPublicState = pubData?.state || {}
  const nextPublicState = {
    ...existingPublicState,
    orders: [],
    posTransactions: [],
    stockMovements: [],
  }

  const { error: pubUpdateErr } = await supabase
    .from('public_store_snapshots')
    .upsert({
      id: 'default',
      state: nextPublicState,
    })
  if (pubUpdateErr) {
    throw new Error(`Failed to update public_store_snapshots: ${pubUpdateErr.message}`)
  }
  console.log('✓ public_store_snapshots updated with 0 orders')

  // 8. Bump store_sync_meta
  console.log('8. Bumping store_sync_meta versions...')
  const { data: metaData } = await supabase
    .from('store_sync_meta')
    .select('*')
    .eq('id', 'default')
    .maybeSingle()

  const nextVer = (metaData?.backoffice_state_version || 0) + 1
  const { error: metaUpdateErr } = await supabase
    .from('store_sync_meta')
    .upsert({
      id: 'default',
      backoffice_state_version: nextVer,
      public_state_version: nextVer,
      backoffice_snapshot_version: nextVer,
      public_snapshot_version: nextVer,
      updated_at: new Date().toISOString(),
    })

  if (metaUpdateErr) {
    console.warn(`Warning updating store_sync_meta: ${metaUpdateErr.message}`)
  } else {
    console.log(`✓ store_sync_meta bumped to version ${nextVer}`)
  }

  // 9. Verify counts
  console.log('\n=== VERIFICATION ===')
  const { count: finalOrdersCount } = await supabase
    .from('store_orders')
    .select('*', { count: 'exact', head: true })
  const { count: finalItemsCount } = await supabase
    .from('store_order_items')
    .select('*', { count: 'exact', head: true })
  const { count: finalTimelineCount } = await supabase
    .from('order_timeline_entries')
    .select('*', { count: 'exact', head: true })
  const { count: finalPayCount } = await supabase
    .from('payment_records')
    .select('*', { count: 'exact', head: true })
  const { count: catalogCount } = await supabase
    .from('catalog_products')
    .select('*', { count: 'exact', head: true })
  const { count: profilesCount } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  console.log(`Remaining store_orders: ${finalOrdersCount}`)
  console.log(`Remaining store_order_items: ${finalItemsCount}`)
  console.log(`Remaining order_timeline_entries: ${finalTimelineCount}`)
  console.log(`Remaining payment_records: ${finalPayCount}`)
  console.log(`Preserved catalog_products: ${catalogCount}`)
  console.log(`Preserved user profiles: ${profilesCount}`)

  console.log('\n=== COMPLETE: ALL ORDERS PERMANENTLY REMOVED ===')
}

removeAllOrders().catch((err) => {
  console.error('Fatal error during removal:', err)
  process.exit(1)
})

