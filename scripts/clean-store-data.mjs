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
const ADMIN_EMAIL = 'sprayandsniff@gmail.com'.toLowerCase().trim()

async function cleanStoreData() {
  console.log('=== STARTING DATABASE CLEANUP ===')

  // 1. Delete Support chat messages & cases
  console.log('\n1. Cleaning support chat messages & cases...')
  const { error: msgErr } = await supabase.from('support_messages').delete().neq('id', '___none___')
  if (msgErr) console.warn('Error deleting support_messages:', msgErr.message)
  else console.log('✓ support_messages cleared')

  const { error: caseErr } = await supabase.from('support_cases').delete().neq('id', '___none___')
  if (caseErr) console.warn('Error deleting support_cases:', caseErr.message)
  else console.log('✓ support_cases cleared')

  // 2. Delete Product reviews
  console.log('\n2. Cleaning product reviews...')
  const { error: revErr } = await supabase.from('product_reviews').delete().neq('id', '___none___')
  if (revErr) console.warn('Error deleting product_reviews:', revErr.message)
  else console.log('✓ product_reviews cleared')

  // 3. Delete Orders & transactions
  console.log('\n3. Cleaning orders, items, timeline, POS, and payments...')
  const { error: timelineErr } = await supabase.from('order_timeline_entries').delete().neq('id', '___none___')
  if (timelineErr) console.warn('Error deleting order_timeline_entries:', timelineErr.message)
  else console.log('✓ order_timeline_entries cleared')

  const { error: itemsErr } = await supabase.from('store_order_items').delete().neq('id', '___none___')
  if (itemsErr) console.warn('Error deleting store_order_items:', itemsErr.message)
  else console.log('✓ store_order_items cleared')

  const { error: posErr } = await supabase.from('pos_transactions').delete().neq('id', '___none___')
  if (posErr) console.warn('Error deleting pos_transactions:', posErr.message)
  else console.log('✓ pos_transactions cleared')

  const { error: payErr } = await supabase.from('payment_records').delete().neq('id', '___none___')
  if (payErr) console.warn('Error deleting payment_records:', payErr.message)
  else console.log('✓ payment_records cleared')

  const { error: ordersErr } = await supabase.from('store_orders').delete().neq('id', '___none___')
  if (ordersErr) console.warn('Error deleting store_orders:', ordersErr.message)
  else console.log('✓ store_orders cleared')

  // 4. Delete Stock movements
  console.log('\n4. Cleaning stock movements...')
  const { error: stockErr } = await supabase.from('stock_movements').delete().neq('id', '___none___')
  if (stockErr) console.warn('Error deleting stock_movements:', stockErr.message)
  else console.log('✓ stock_movements cleared')

  // 5. Delete User carts and wishlists
  console.log('\n5. Cleaning carts and wishlists...')
  const { error: cartErr } = await supabase.from('user_carts').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
  if (cartErr) console.warn('Error deleting user_carts:', cartErr.message)
  else console.log('✓ user_carts cleared')

  const { error: wishErr } = await supabase.from('user_wishlists').delete().neq('user_id', '00000000-0000-0000-0000-000000000000')
  if (wishErr) console.warn('Error deleting user_wishlists:', wishErr.message)
  else console.log('✓ user_wishlists cleared')

  // 6. Delete Inventory items and Catalog products
  console.log('\n6. Cleaning inventory items and catalog products...')
  const { error: invErr } = await supabase.from('inventory_items').delete().neq('product_id', '___none___')
  if (invErr) console.warn('Error deleting inventory_items:', invErr.message)
  else console.log('✓ inventory_items cleared')

  const { error: prodErr } = await supabase.from('catalog_products').delete().neq('id', '___none___')
  if (prodErr) console.warn('Error deleting catalog_products:', prodErr.message)
  else console.log('✓ catalog_products cleared')

  // 7. Reset Promotions usage counter
  console.log('\n7. Resetting promotion used counts to 0...')
  const { error: promoErr } = await supabase.from('promotions').update({ used_count: 0 }).neq('id', '___none___')
  if (promoErr) console.warn('Error updating promotions:', promoErr.message)
  else console.log('✓ promotions used_count reset to 0')

  // 8. Delete Customer & Staff accounts, keeping ONLY Admin
  console.log('\n8. Cleaning accounts (keeping only ADMIN)...')
  const { data: usersData, error: listErr } = await supabase.auth.admin.listUsers()
  if (listErr) {
    console.error('Error listing auth users:', listErr.message)
  } else {
    const users = usersData?.users || []
    let deletedCount = 0
    let adminUserId = null

    for (const u of users) {
      const email = u.email?.toLowerCase().trim()
      if (email === ADMIN_EMAIL) {
        adminUserId = u.id
        console.log(`- KEEPING ADMIN: ${u.email} (${u.id})`)
      } else {
        const { error: delErr } = await supabase.auth.admin.deleteUser(u.id)
        if (delErr) {
          console.warn(`Error deleting auth user ${u.email}:`, delErr.message)
        } else {
          deletedCount++
          console.log(`- Deleted user: ${u.email}`)
        }
      }
    }
    console.log(`✓ Deleted ${deletedCount} auth users`)

    // Clean any orphaned profiles that aren't the admin
    const { error: profDelErr } = await supabase.from('profiles').delete().neq('email', ADMIN_EMAIL)
    if (profDelErr) {
      console.warn('Error deleting non-admin profiles:', profDelErr.message)
    } else {
      console.log('✓ Non-admin profiles removed')
    }

    // Ensure the admin profile has role 'ADMIN'
    if (adminUserId) {
      const { error: upsertAdminErr } = await supabase.from('profiles').upsert({
        id: adminUserId,
        email: ADMIN_EMAIL,
        name: 'Spray & Sniff Admin',
        role: 'ADMIN',
      })
      if (upsertAdminErr) {
        console.warn('Error ensuring admin profile:', upsertAdminErr.message)
      } else {
        console.log('✓ Verified admin profile role = ADMIN')
      }
    }
  }

  // 9. Reset snapshots in app_store_snapshots and public_store_snapshots
  console.log('\n9. Resetting store snapshots to clean empty state...')
  const cleanBackofficeState = {
    catalog: [],
    inventory: [],
    cart: [],
    orders: [],
    posTransactions: [],
    stockMovements: [],
  }

  const cleanPublicState = {
    catalog: [],
    inventory: [],
    cart: [],
    orders: [],
    posTransactions: [],
    stockMovements: [],
  }

  const { error: snapErr } = await supabase.from('app_store_snapshots').upsert({
    id: 'default',
    state: cleanBackofficeState,
  })
  if (snapErr) console.warn('Error updating app_store_snapshots:', snapErr.message)
  else console.log('✓ app_store_snapshots reset to clean empty state')

  const { error: pubSnapErr } = await supabase.from('public_store_snapshots').upsert({
    id: 'default',
    state: cleanPublicState,
  })
  if (pubSnapErr) console.warn('Error updating public_store_snapshots:', pubSnapErr.message)
  else console.log('✓ public_store_snapshots reset to clean empty state')

  // 10. Update store_sync_meta to force-invalidate all caches
  const { data: currentMeta } = await supabase.from('store_sync_meta').select('*').eq('id', 'default').maybeSingle()
  const nextVer = Math.max(10, ((currentMeta?.backoffice_state_version || 0) + 10))
  await supabase.from('store_sync_meta').upsert({
    id: 'default',
    backoffice_state_version: nextVer,
    public_state_version: nextVer,
    backoffice_snapshot_version: nextVer,
    public_snapshot_version: nextVer,
  })
  console.log(`✓ store_sync_meta updated to version ${nextVer} (cache invalidated)`)

  console.log('\n=== CLEANUP COMPLETED SUCCESSFULLY ===')
}

cleanStoreData().catch((err) => {
  console.error('Cleanup script encountered error:', err)
  process.exit(1)
})
