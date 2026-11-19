import crypto from 'crypto'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const LEGACY_SEED_ORDER_PREFIX = 'POS-SEED-'
const LEGACY_SEED_TX_PREFIX = 'TX-SEED-'
const TAX_RATE = 0.12

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
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1)
        }
        return [key, val]
      }),
  )
}

const envConfig = loadEnv()
const supabase = createClient(
  envConfig.NEXT_PUBLIC_SUPABASE_URL,
  envConfig.SUPABASE_SERVICE_ROLE_KEY,
)

function roundCurrency(value) {
  return Math.round(value * 100) / 100
}

function computeCashTendered(total) {
  if (total <= 1500) return Math.ceil(total / 100) * 100
  if (total <= 3000) return Math.ceil(total / 500) * 500
  return Math.ceil(total / 1000) * 1000
}

/**
 * 3 POS sales records within the Sep 28 – Oct 8, 2026 window.
 */
const STAGGERED_POS_SCHEDULE = [
  {
    date: '2026-10-01',
    sales: [
      {
        time: '13:14:38+08:00',
        cashier: 'Cel',
        method: 'Cash',
        customerName: 'Walk-in Customer',
        items: [
          { key: 'apple-honey', qty: 1 },
          { key: 'velvet-petals', qty: 1 },
        ],
      },
    ],
  },
  {
    date: '2026-10-04',
    sales: [
      {
        time: '15:27:23+08:00',
        cashier: 'Spray & Sniff Admin',
        method: 'QR Pay',
        customerName: 'Mikaela',
        items: [{ key: 'butterfly', qty: 1 }],
      },
    ],
  },
  {
    date: '2026-10-08',
    sales: [
      {
        time: '11:22:31+08:00',
        cashier: 'Brader',
        method: 'Cash',
        customerName: 'Denise',
        items: [
          { key: 'rush', qty: 1 },
          { key: 'velvet-petals', qty: 1 },
        ],
      },
    ],
  },
]

function deterministicCode(input, length) {
  const alphabet = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digest = crypto.createHash('sha256').update(input).digest()
  let result = ''
  for (let i = 0; i < length; i++) {
    result += alphabet[digest[i] % alphabet.length]
  }
  return result
}

function buildAuthenticPosIds(createdAtDate, dateStr, saleIdx) {
  const epochDigits = String(createdAtDate.getTime()).slice(-8)
  const orderSuffix = deterministicCode(`order:${dateStr}:${saleIdx}`, 4)
  const txSuffix = deterministicCode(`tx:${dateStr}:${saleIdx}`, 4)
  const refSuffix = deterministicCode(`ref:${dateStr}:${saleIdx}`, 7).toLowerCase()
  return {
    orderId: `POS-${epochDigits}-${orderSuffix}`,
    txId: `TX-${epochDigits}-${txSuffix}`,
    clientSaleRef: `pos_${createdAtDate.getTime()}_${refSuffix}`,
  }
}

function getManagedIds() {
  const orderIds = []
  const txIds = []
  for (const dayEntry of STAGGERED_POS_SCHEDULE) {
    dayEntry.sales.forEach((sale, saleIdx) => {
      const createdAtDate = new Date(`${dayEntry.date}T${sale.time}`)
      const { orderId, txId } = buildAuthenticPosIds(createdAtDate, dayEntry.date, saleIdx)
      orderIds.push(orderId)
      txIds.push(txId)
    })
  }
  return { orderIds, txIds }
}

function resolveCatalogProduct(catalog, key) {
  const normalizedKey = key.toLowerCase()
  const match = catalog.find(
    (product) =>
      product.id.toLowerCase().startsWith(normalizedKey) ||
      product.name.toLowerCase().includes(normalizedKey.replace(/-/g, ' ')),
  )
  if (!match) {
    throw new Error(`Catalog product not found for key "${key}".`)
  }
  const primarySize = Array.isArray(match.sizes) && match.sizes.length > 0
    ? match.sizes[0]
    : { ml: 100, price: Number(match.price) }

  return {
    productId: match.id,
    productName: match.name,
    size: Number(primarySize.ml),
    unitPrice: roundCurrency(Number(primarySize.price ?? match.price)),
    image: Array.isArray(match.images) ? match.images[0] || '' : '',
  }
}

async function bumpStoreSyncMeta() {
  const { data: metaData } = await supabase
    .from('store_sync_meta')
    .select('*')
    .eq('id', 'default')
    .maybeSingle()

  const nextBackoffice = (metaData?.backoffice_state_version || 0) + 1
  const nextPublic = (metaData?.public_state_version || 0) + 1

  const { error } = await supabase.from('store_sync_meta').upsert({
    id: 'default',
    backoffice_state_version: nextBackoffice,
    public_state_version: nextPublic,
    backoffice_snapshot_version: nextBackoffice,
    public_snapshot_version: nextPublic,
    updated_at: new Date().toISOString(),
  })

  if (error) {
    console.warn(`Warning bumping store_sync_meta: ${error.message}`)
  } else {
    console.log(`✓ store_sync_meta bumped to version ${nextBackoffice}`)
  }
}

async function cleanSeededPosSales() {
  console.log('=== CLEANING MANAGED POS HISTORY ===')

  const { orderIds, txIds } = getManagedIds()
  const managedOrderSet = new Set(orderIds)
  const managedTxSet = new Set(txIds)

  await Promise.all([
    supabase.from('order_timeline_entries').delete().like('order_id', `${LEGACY_SEED_ORDER_PREFIX}%`),
    supabase.from('store_order_items').delete().like('order_id', `${LEGACY_SEED_ORDER_PREFIX}%`),
    supabase.from('payment_records').delete().like('order_id', `${LEGACY_SEED_ORDER_PREFIX}%`),
    supabase.from('pos_transactions').delete().like('id', `${LEGACY_SEED_TX_PREFIX}%`),
    supabase.from('store_orders').delete().like('id', `${LEGACY_SEED_ORDER_PREFIX}%`),
  ])

  if (orderIds.length > 0) {
    await supabase.from('order_timeline_entries').delete().in('order_id', orderIds)
    await supabase.from('store_order_items').delete().in('order_id', orderIds)
    await supabase.from('payment_records').delete().in('order_id', orderIds)
    await supabase.from('store_orders').delete().in('id', orderIds)
  }
  if (txIds.length > 0) {
    await supabase.from('pos_transactions').delete().in('id', txIds)
  }

  const { data: snapData, error: snapErr } = await supabase
    .from('app_store_snapshots')
    .select('id, state')
    .eq('id', 'default')
    .maybeSingle()
  if (snapErr) throw snapErr

  if (snapData?.state) {
    const existingState = snapData.state
    const nextState = {
      ...existingState,
      orders: (existingState.orders || []).filter(
        (o) => !String(o.id).startsWith(LEGACY_SEED_ORDER_PREFIX) && !managedOrderSet.has(String(o.id)),
      ),
      posTransactions: (existingState.posTransactions || []).filter(
        (tx) => !String(tx.id).startsWith(LEGACY_SEED_TX_PREFIX) && !managedTxSet.has(String(tx.id)),
      ),
    }

    const { error: updateSnapErr } = await supabase.from('app_store_snapshots').upsert({
      id: 'default',
      state: nextState,
    })
    if (updateSnapErr) throw updateSnapErr
  }

  await bumpStoreSyncMeta()
  console.log('✓ Managed POS records removed cleanly (other orders preserved).')
}

function sqlString(value) {
  if (value === null || value === undefined) return 'null'
  return `'${String(value).replace(/'/g, "''")}'`
}

function sqlNumber(value) {
  if (value === null || value === undefined) return 'null'
  return String(Number(value))
}

function buildSeedPayload(catalogRows) {
  const orderRecords = []
  const storeOrderRows = []
  const storeOrderItemRows = []
  const timelineRows = []
  const posTransactionRecords = []
  const posTransactionRows = []
  const paymentRecordRows = []

  let totalUnitsSold = 0

  for (const dayEntry of STAGGERED_POS_SCHEDULE) {
    const dateCompact = dayEntry.date.replace(/-/g, '')
    let dayUnits = 0

    dayEntry.sales.forEach((sale, saleIdx) => {
      const createdAtDate = new Date(`${dayEntry.date}T${sale.time}`)
      const createdAtIso = createdAtDate.toISOString()
      const { orderId, txId, clientSaleRef } = buildAuthenticPosIds(
        createdAtDate,
        dayEntry.date,
        saleIdx,
      )

      const items = sale.items.map((item) => {
        const resolved = resolveCatalogProduct(catalogRows, item.key)
        dayUnits += item.qty
        return {
          productId: resolved.productId,
          productName: resolved.productName,
          size: resolved.size,
          quantity: item.qty,
          unitPrice: resolved.unitPrice,
          image: resolved.image,
        }
      })

      const subtotal = roundCurrency(
        items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0),
      )
      const tax = roundCurrency(subtotal * TAX_RATE)
      const total = roundCurrency(subtotal + tax)
      const itemsCount = items.reduce((sum, item) => sum + item.quantity, 0)

      let notes = `[POS-REF:${clientSaleRef}]`
      if (sale.method === 'Cash') {
        const tendered = computeCashTendered(total)
        const change = roundCurrency(Math.max(0, tendered - total))
        notes = `[POS-CASH:${tendered.toFixed(2)}:${change.toFixed(2)}] ${notes}`
      } else if (sale.method === 'QR Pay') {
        notes = `PayMongo channel: qrph | ${notes}`
      }

      const timelineEntry = {
        status: 'Completed',
        createdAt: createdAtIso,
        note: 'POS transaction completed.',
        actorName: sale.cashier,
      }

      const orderRecord = {
        id: orderId,
        source: 'POS',
        customerName: sale.customerName,
        customerEmail: 'walk-in@sprayandsniff.local',
        status: 'Completed',
        paymentMethod: sale.method,
        paymentStatus: 'Paid',
        createdAt: createdAtIso,
        subtotal,
        shipping: 0,
        tax,
        total,
        notes,
        items,
        timeline: [timelineEntry],
      }

      orderRecords.push(orderRecord)

      storeOrderRows.push({
        id: orderId,
        source: 'POS',
        customer_id: null,
        customer_name: sale.customerName,
        customer_email: 'walk-in@sprayandsniff.local',
        status: 'Completed',
        payment_method: sale.method,
        payment_status: 'Paid',
        created_at: createdAtIso,
        subtotal,
        tax,
        shipping: 0,
        total,
        shipping_address: null,
        notes,
        courier: null,
        courier_slug: null,
        tracking_number: null,
        delivery_notes: null,
        parcels_last_synced_at: null,
      })

      items.forEach((item, idx) => {
        storeOrderItemRows.push({
          id: `${orderId}::item::${idx}`,
          order_id: orderId,
          product_id: item.productId,
          product_name: item.productName,
          size_ml: item.size,
          quantity: item.quantity,
          unit_price: item.unitPrice,
        })
      })

      timelineRows.push({
        id: `${orderId}::timeline::0`,
        order_id: orderId,
        status: 'Completed',
        created_at: createdAtIso,
        note: 'POS transaction completed.',
        actor_name: sale.cashier,
        previous_status: null,
      })

      const posTx = {
        id: txId,
        orderId,
        cashierName: sale.cashier,
        paymentMethod: sale.method,
        createdAt: createdAtIso,
        subtotal,
        tax,
        total,
        itemsCount,
      }
      posTransactionRecords.push(posTx)

      posTransactionRows.push({
        id: txId,
        order_id: orderId,
        cashier_name: sale.cashier,
        payment_method: sale.method,
        created_at: createdAtIso,
        subtotal,
        tax,
        total,
        items_count: itemsCount,
      })

      paymentRecordRows.push({
        id: `${orderId}::payment`,
        order_id: orderId,
        source: 'POS',
        customer_id: null,
        customer_name: sale.customerName,
        customer_email: 'walk-in@sprayandsniff.local',
        amount: total,
        subtotal,
        tax,
        shipping: 0,
        payment_method: sale.method,
        payment_gateway: sale.method === 'QR Pay' ? 'PayMongo' : null,
        payment_channel: sale.method === 'QR Pay' ? 'qrph' : null,
        checkout_session_id: null,
        reference: clientSaleRef,
        status: 'succeeded',
        paid_at: createdAtIso,
      })
    })

    totalUnitsSold += dayUnits
  }

  return {
    orderRecords,
    storeOrderRows,
    storeOrderItemRows,
    timelineRows,
    posTransactionRecords,
    posTransactionRows,
    paymentRecordRows,
    totalUnitsSold,
  }
}

function buildSqlSeedDocument(payload) {
  const {
    orderRecords,
    storeOrderRows,
    storeOrderItemRows,
    timelineRows,
    posTransactionRecords,
    posTransactionRows,
    paymentRecordRows,
    totalUnitsSold,
  } = payload

  const orderValuesSql = storeOrderRows
    .map(
      (r) =>
        `  (${sqlString(r.id)}, ${sqlString(r.source)}, null, ${sqlString(r.customer_name)}, ${sqlString(r.customer_email)}, ${sqlString(r.status)}, ${sqlString(r.payment_method)}, ${sqlString(r.payment_status)}, ${sqlString(r.created_at)}::timestamptz, ${sqlNumber(r.subtotal)}, ${sqlNumber(r.tax)}, ${sqlNumber(r.shipping)}, ${sqlNumber(r.total)}, null, ${sqlString(r.notes)}, null, null, null, null, null)`,
    )
    .join(',\n')

  const itemValuesSql = storeOrderItemRows
    .map(
      (r) =>
        `  (${sqlString(r.id)}, ${sqlString(r.order_id)}, ${sqlString(r.product_id)}, ${sqlString(r.product_name)}, ${sqlNumber(r.size_ml)}, ${sqlNumber(r.quantity)}, ${sqlNumber(r.unit_price)})`,
    )
    .join(',\n')

  const timelineValuesSql = timelineRows
    .map(
      (r) =>
        `  (${sqlString(r.id)}, ${sqlString(r.order_id)}, ${sqlString(r.status)}, ${sqlString(r.created_at)}::timestamptz, ${sqlString(r.note)}, ${sqlString(r.actor_name)}, null)`,
    )
    .join(',\n')

  const posTxValuesSql = posTransactionRows
    .map(
      (r) =>
        `  (${sqlString(r.id)}, ${sqlString(r.order_id)}, ${sqlString(r.cashier_name)}, ${sqlString(r.payment_method)}, ${sqlString(r.created_at)}::timestamptz, ${sqlNumber(r.subtotal)}, ${sqlNumber(r.tax)}, ${sqlNumber(r.total)}, ${sqlNumber(r.items_count)})`,
    )
    .join(',\n')

  const paymentValuesSql = paymentRecordRows
    .map(
      (r) =>
        `  (${sqlString(r.id)}, ${sqlString(r.order_id)}, ${sqlString(r.source)}, null, ${sqlString(r.customer_name)}, ${sqlString(r.customer_email)}, ${sqlNumber(r.amount)}, ${sqlNumber(r.subtotal)}, ${sqlNumber(r.tax)}, ${sqlNumber(r.shipping)}, ${sqlString(r.payment_method)}, ${sqlString(r.payment_gateway)}, ${sqlString(r.payment_channel)}, null, ${sqlString(r.reference)}, ${sqlString(r.status)}, ${sqlString(r.paid_at)}::timestamptz)`,
    )
    .join(',\n')

  const compactSeedOrders = orderRecords.map((order) => ({
    ...order,
    items: order.items.map(({ image: _image, ...rest }) => rest),
  }))
  const seedOrdersJson = JSON.stringify(compactSeedOrders).replace(/'/g, "''")
  const seedPosTxJson = JSON.stringify(posTransactionRecords).replace(/'/g, "''")

  return `-- Migration / Seed: Staggered POS Deployment Sales (Sep 28 – Oct 8, 2026)
-- Active days: ${STAGGERED_POS_SCHEDULE.length} | POS orders: ${orderRecords.length} | Total units sold: ${totalUnitsSold}
-- Idempotent: safe to re-run; preserves all non-seed orders and leaves inventory_items untouched.

begin;

insert into public.store_orders (
  id, source, customer_id, customer_name, customer_email, status,
  payment_method, payment_status, created_at, subtotal, tax, shipping,
  total, shipping_address, notes, courier, courier_slug, tracking_number,
  delivery_notes, parcels_last_synced_at
) values
${orderValuesSql}
on conflict (id) do update set
  source = excluded.source,
  customer_name = excluded.customer_name,
  customer_email = excluded.customer_email,
  status = excluded.status,
  payment_method = excluded.payment_method,
  payment_status = excluded.payment_status,
  created_at = excluded.created_at,
  subtotal = excluded.subtotal,
  tax = excluded.tax,
  shipping = excluded.shipping,
  total = excluded.total,
  notes = excluded.notes;

insert into public.store_order_items (
  id, order_id, product_id, product_name, size_ml, quantity, unit_price
) values
${itemValuesSql}
on conflict (id) do update set
  order_id = excluded.order_id,
  product_id = excluded.product_id,
  product_name = excluded.product_name,
  size_ml = excluded.size_ml,
  quantity = excluded.quantity,
  unit_price = excluded.unit_price;

insert into public.order_timeline_entries (
  id, order_id, status, created_at, note, actor_name, previous_status
) values
${timelineValuesSql}
on conflict (id) do update set
  order_id = excluded.order_id,
  status = excluded.status,
  created_at = excluded.created_at,
  note = excluded.note,
  actor_name = excluded.actor_name,
  previous_status = excluded.previous_status;

insert into public.pos_transactions (
  id, order_id, cashier_name, payment_method, created_at, subtotal, tax, total, items_count
) values
${posTxValuesSql}
on conflict (id) do update set
  order_id = excluded.order_id,
  cashier_name = excluded.cashier_name,
  payment_method = excluded.payment_method,
  created_at = excluded.created_at,
  subtotal = excluded.subtotal,
  tax = excluded.tax,
  total = excluded.total,
  items_count = excluded.items_count;

insert into public.payment_records (
  id, order_id, source, customer_id, customer_name, customer_email,
  amount, subtotal, tax, shipping, payment_method, payment_gateway,
  payment_channel, checkout_session_id, reference, status, paid_at
) values
${paymentValuesSql}
on conflict (id) do update set
  order_id = excluded.order_id,
  source = excluded.source,
  customer_name = excluded.customer_name,
  customer_email = excluded.customer_email,
  amount = excluded.amount,
  subtotal = excluded.subtotal,
  tax = excluded.tax,
  shipping = excluded.shipping,
  payment_method = excluded.payment_method,
  payment_gateway = excluded.payment_gateway,
  payment_channel = excluded.payment_channel,
  reference = excluded.reference,
  status = excluded.status,
  paid_at = excluded.paid_at;

do $$
declare
  v_seed_orders jsonb := '${seedOrdersJson}'::jsonb;
  v_seed_pos_tx jsonb := '${seedPosTxJson}'::jsonb;
  v_existing_state jsonb;
  v_preserved_orders jsonb;
  v_preserved_pos_tx jsonb;
  v_merged_orders jsonb;
  v_merged_pos_tx jsonb;
begin
  select state into v_existing_state
  from public.app_store_snapshots
  where id = 'default';

  if v_existing_state is null then
    v_existing_state := '{}'::jsonb;
  end if;

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_preserved_orders
  from jsonb_array_elements(coalesce(v_existing_state->'orders', '[]'::jsonb)) as elem
  where coalesce(elem->>'id', '') not like 'POS-SEED-%'
    and coalesce(elem->>'id', '') not in (
      select s_elem->>'id' from jsonb_array_elements(v_seed_orders) as s_elem
    );

  select coalesce(jsonb_agg(elem), '[]'::jsonb) into v_preserved_pos_tx
  from jsonb_array_elements(coalesce(v_existing_state->'posTransactions', '[]'::jsonb)) as elem
  where coalesce(elem->>'id', '') not like 'TX-SEED-%'
    and coalesce(elem->>'id', '') not in (
      select t_elem->>'id' from jsonb_array_elements(v_seed_pos_tx) as t_elem
    );

  select coalesce(jsonb_agg(elem order by (elem->>'createdAt')::timestamptz desc), '[]'::jsonb)
  into v_merged_orders
  from jsonb_array_elements(v_preserved_orders || v_seed_orders) as elem;

  select coalesce(jsonb_agg(elem order by (elem->>'createdAt')::timestamptz desc), '[]'::jsonb)
  into v_merged_pos_tx
  from jsonb_array_elements(v_preserved_pos_tx || v_seed_pos_tx) as elem;

  insert into public.app_store_snapshots (id, state)
  values (
    'default',
    jsonb_set(
      jsonb_set(v_existing_state, '{orders}', v_merged_orders, true),
      '{posTransactions}',
      v_merged_pos_tx,
      true
    )
  )
  on conflict (id) do update set
    state = excluded.state,
    updated_at = timezone('utc', now());

  insert into public.store_sync_meta (
    id, backoffice_state_version, public_state_version,
    backoffice_snapshot_version, public_snapshot_version, updated_at
  ) values (
    'default', 1, 1, 1, 1, timezone('utc', now())
  )
  on conflict (id) do update set
    backoffice_state_version = public.store_sync_meta.backoffice_state_version + 1,
    public_state_version = public.store_sync_meta.public_state_version + 1,
    backoffice_snapshot_version = public.store_sync_meta.backoffice_snapshot_version + 1,
    public_snapshot_version = public.store_sync_meta.public_snapshot_version + 1,
    updated_at = timezone('utc', now());
end $$;

commit;
`
}

async function emitSqlFiles() {
  const { data: catalogRows, error: catalogErr } = await supabase
    .from('catalog_products')
    .select('id, name, price, sizes, images')

  if (catalogErr) throw catalogErr
  if (!catalogRows || catalogRows.length === 0) {
    throw new Error('No catalog_products found in Supabase. Seed catalog first.')
  }

  const payload = buildSeedPayload(catalogRows)
  const sqlContent = buildSqlSeedDocument(payload)

  const migrationPath = 'supabase/migrations/20261119143500_seed_pos_sales_sep28_oct08.sql'
  const legacyMigrationPath = 'supabase/migrations/20261119143500_seed_pos_sales_sep28_nov08.sql'
  const seedPath = 'supabase/seed.sql'

  if (fs.existsSync(legacyMigrationPath)) {
    fs.unlinkSync(legacyMigrationPath)
  }
  fs.writeFileSync(migrationPath, sqlContent, 'utf-8')
  fs.writeFileSync(seedPath, sqlContent, 'utf-8')

  console.log(`✓ Generated SQL migration: ${migrationPath}`)
  console.log(`✓ Updated Supabase seed file: ${seedPath}`)
}

async function seedPosSales() {
  console.log('=== SEEDING STAGGERED POS SALES (SEP 28 – OCT 8, 2026) ===')

  const { data: catalogRows, error: catalogErr } = await supabase
    .from('catalog_products')
    .select('id, name, price, sizes, images')

  if (catalogErr) throw catalogErr
  if (!catalogRows || catalogRows.length === 0) {
    throw new Error('No catalog_products found in Supabase. Seed catalog first.')
  }

  const {
    orderRecords,
    storeOrderRows,
    storeOrderItemRows,
    timelineRows,
    posTransactionRecords,
    posTransactionRows,
    paymentRecordRows,
    totalUnitsSold,
  } = buildSeedPayload(catalogRows)

  for (const dayEntry of STAGGERED_POS_SCHEDULE) {
    const dayUnits = dayEntry.sales.reduce(
      (sum, s) => sum + s.items.reduce((itemSum, i) => itemSum + i.qty, 0),
      0,
    )
    console.log(`  • ${dayEntry.date}: ${dayEntry.sales.length} receipt(s), ${dayUnits} unit(s) sold`)
  }

  // Upsert seeded rows first, then prune only obsolete POS-SEED-* / TX-SEED-* IDs
  const nextOrderIds = new Set(storeOrderRows.map((r) => r.id))
  const nextTxIds = new Set(posTransactionRows.map((r) => r.id))

  const { error: ordersErr } = await supabase
    .from('store_orders')
    .upsert(storeOrderRows, { onConflict: 'id' })
  if (ordersErr) throw ordersErr

  const [itemsRes, timelineRes, posRes, payRes] = await Promise.all([
    supabase.from('store_order_items').upsert(storeOrderItemRows, { onConflict: 'id' }),
    supabase.from('order_timeline_entries').upsert(timelineRows, { onConflict: 'id' }),
    supabase.from('pos_transactions').upsert(posTransactionRows, { onConflict: 'id' }),
    supabase.from('payment_records').upsert(paymentRecordRows, { onConflict: 'id' }),
  ])

  if (itemsRes.error) throw itemsRes.error
  if (timelineRes.error) throw timelineRes.error
  if (posRes.error) throw posRes.error
  if (payRes.error) throw payRes.error

  const [{ data: existingLegacyOrders }, { data: existingLegacyTx }] = await Promise.all([
    supabase.from('store_orders').select('id').like('id', `${LEGACY_SEED_ORDER_PREFIX}%`),
    supabase.from('pos_transactions').select('id').like('id', `${LEGACY_SEED_TX_PREFIX}%`),
  ])

  const staleOrderIds = (existingLegacyOrders || [])
    .map((r) => r.id)
    .filter((id) => !nextOrderIds.has(id))
  const staleTxIds = (existingLegacyTx || [])
    .map((r) => r.id)
    .filter((id) => !nextTxIds.has(id))

  if (staleOrderIds.length > 0) {
    await supabase.from('order_timeline_entries').delete().in('order_id', staleOrderIds)
    await supabase.from('store_order_items').delete().in('order_id', staleOrderIds)
    await supabase.from('payment_records').delete().in('order_id', staleOrderIds)
    await supabase.from('store_orders').delete().in('id', staleOrderIds)
  }
  if (staleTxIds.length > 0) {
    await supabase.from('pos_transactions').delete().in('id', staleTxIds)
  }

  // Merge into app_store_snapshots
  const { data: snapData, error: snapFetchErr } = await supabase
    .from('app_store_snapshots')
    .select('id, state')
    .eq('id', 'default')
    .maybeSingle()
  if (snapFetchErr) throw snapFetchErr

  const existingState = snapData?.state || {}
  const existingOrders = (existingState.orders || []).filter(
    (o) =>
      !String(o.id).startsWith(LEGACY_SEED_ORDER_PREFIX) &&
      !nextOrderIds.has(String(o.id)),
  )
  const existingPosTx = (existingState.posTransactions || []).filter(
    (tx) =>
      !String(tx.id).startsWith(LEGACY_SEED_TX_PREFIX) &&
      !nextTxIds.has(String(tx.id)),
  )

  const mergedOrders = [...existingOrders, ...orderRecords].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
  const mergedPosTx = [...existingPosTx, ...posTransactionRecords].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const { error: snapUpsertErr } = await supabase.from('app_store_snapshots').upsert({
    id: 'default',
    state: {
      ...existingState,
      orders: mergedOrders,
      posTransactions: mergedPosTx,
    },
  })
  if (snapUpsertErr) throw snapUpsertErr

  await bumpStoreSyncMeta()

  console.log('\n=== POS SEED COMPLETE ===')
  console.log(`Active days seeded: ${STAGGERED_POS_SCHEDULE.length}`)
  console.log(`POS orders seeded: ${orderRecords.length}`)
  console.log(`Total units sold: ${totalUnitsSold}`)
}

const isCleanMode = process.argv.includes('--clean')
const isEmitSqlMode = process.argv.includes('--emit-sql')
;(isEmitSqlMode ? emitSqlFiles() : isCleanMode ? cleanSeededPosSales() : seedPosSales())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('POS seed failed:', err)
    process.exit(1)
  })
