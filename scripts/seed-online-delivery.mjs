import crypto from 'crypto'
import fs from 'fs'
import { createClient } from '@supabase/supabase-js'

const TAX_RATE = 0.12
const STANDARD_SHIPPING_FEE = 75
const FREE_SHIPPING_THRESHOLD = 400

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

function deterministicCode(input, length) {
  const alphabet = '0123456789ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digest = crypto.createHash('sha256').update(input).digest()
  let result = ''
  for (let i = 0; i < length; i++) {
    result += alphabet[digest[i] % alphabet.length]
  }
  return result
}

function deterministicHex(input, length) {
  return crypto.createHash('sha256').update(input).digest('hex').slice(0, length)
}

function buildAuthenticWebOrderId(createdAtDate, key) {
  const epochDigits = String(createdAtDate.getTime()).slice(-8)
  const suffix = deterministicCode(`web-order:${key}`, 4)
  return `WEB-${epochDigits}-${suffix}`
}

const DUMMY_CUSTOMER_PASSWORD =
  process.env.DUMMY_CUSTOMER_PASSWORD || 'DemoCustomer!2026'

const DUMMY_CUSTOMER_PROFILES = [
  {
    email: 'camille.mendoza@example.com',
    name: 'Camille Mendoza',
    phone: '+639175550142',
    address: 'Purok 3, San Antonio',
    city: 'Mabini, Davao de Oro',
    postal_code: '8807',
  },
  {
    email: 'rafael.santos@example.com',
    name: 'Rafael Santos',
    phone: '+639185550198',
    address: 'Rizal Street, Magugpo Poblacion',
    city: 'Tagum, Davao del Norte',
    postal_code: '8100',
  },
]

async function ensureDummyProfiles() {
  const { data: listData, error: listErr } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  })
  if (listErr) throw listErr

  const existingAuthByEmail = new Map(
    (listData?.users || [])
      .filter((u) => typeof u.email === 'string')
      .map((u) => [u.email.trim().toLowerCase(), u]),
  )

  for (const dummy of DUMMY_CUSTOMER_PROFILES) {
    const emailKey = dummy.email.toLowerCase()
    let authUser = existingAuthByEmail.get(emailKey)

    if (!authUser) {
      const { data: created, error: createErr } = await supabase.auth.admin.createUser({
        email: dummy.email,
        password: DUMMY_CUSTOMER_PASSWORD,
        email_confirm: true,
        user_metadata: {
          name: dummy.name,
          role: 'USER',
        },
      })
      if (createErr) throw createErr
      authUser = created.user
      console.log(`✓ Created dummy customer auth account: ${dummy.name} <${dummy.email}>`)
    }

    if (!authUser?.id) {
      throw new Error(`Unable to resolve auth user ID for ${dummy.email}`)
    }

    const { error: profUpsertErr } = await supabase.from('profiles').upsert(
      {
        id: authUser.id,
        email: dummy.email,
        name: dummy.name,
        role: 'USER',
        phone: dummy.phone,
        address: dummy.address,
        city: dummy.city,
        postal_code: dummy.postal_code,
      },
      { onConflict: 'id' },
    )
    if (profUpsertErr) throw profUpsertErr
  }
}

/**
 * 2 Delivered & Paid online orders within the Sep 28 – Oct 8, 2026 window,
 * using J&T Express Philippines (`j-t-express-ph`) only with zero synthetic/seed labels.
 */
const ONLINE_DELIVERY_BLUEPRINTS = [
  {
    key: 'del-03',
    profileEmail: 'camille.mendoza@example.com',
    placedAt: '2026-10-02T11:09:15.204+08:00',
    status: 'Delivered',
    paymentMethod: 'PayMongo',
    paymentStatus: 'Paid',
    paymentChannel: 'gcash',
    courier: 'J&T Express Philippines',
    courierSlug: 'j-t-express-ph',
    trackingNumber: 'JT804193112045',
    deliveryNotes: 'Delivered and signed by recipient in Mabini.',
    items: [{ key: 'butterfly', qty: 1 }],
    timeline: [
      {
        status: 'Pending',
        previousStatus: null,
        actorName: null,
        at: '2026-10-02T11:09:15.204+08:00',
        note: 'Order placed online via PayMongo (GCash).',
      },
      {
        status: 'Processing',
        previousStatus: 'Pending',
        actorName: 'Cel',
        at: '2026-10-02T14:30:00.000+08:00',
        note: 'Double-wrapped fragrance bottle and printed airwaybill.',
      },
      {
        status: 'Shipped',
        previousStatus: 'Processing',
        actorName: 'Spray & Sniff Admin',
        at: '2026-10-03T09:15:00.000+08:00',
        note: 'Picked up by J&T Express Philippines courier.',
      },
      {
        status: 'In Transit',
        previousStatus: 'Shipped',
        actorName: 'Spray & Sniff Admin',
        at: '2026-10-03T19:40:00.000+08:00',
        note: 'Arrived at J&T Davao de Oro sorting hub.',
      },
      {
        status: 'Out for Delivery',
        previousStatus: 'In Transit',
        actorName: 'Spray & Sniff Admin',
        at: '2026-10-04T08:30:00.000+08:00',
        note: 'Out for delivery with J&T Express rider in Mabini.',
      },
      {
        status: 'Delivered',
        previousStatus: 'Out for Delivery',
        actorName: 'Spray & Sniff Admin',
        at: '2026-10-04T15:12:00.000+08:00',
        note: 'Delivered safely to recipient via J&T Express Philippines.',
      },
    ],
  },
  {
    key: 'del-05',
    profileEmail: 'rafael.santos@example.com',
    placedAt: '2026-10-06T13:14:33.628+08:00',
    status: 'Delivered',
    paymentMethod: 'Cash on Delivery',
    paymentStatus: 'Paid',
    paidAt: '2026-10-08T14:35:00.000+08:00',
    courier: 'J&T Express Philippines',
    courierSlug: 'j-t-express-ph',
    trackingNumber: 'JT804193884710',
    deliveryNotes: 'Delivered and COD collected via J&T Express Philippines.',
    items: [
      { key: 'in-the-stars', qty: 1 },
      { key: 'velvet-petals', qty: 1 },
    ],
    timeline: [
      {
        status: 'Pending',
        previousStatus: null,
        actorName: null,
        at: '2026-10-06T13:14:33.628+08:00',
        note: 'Order placed online via Cash on Delivery.',
      },
      {
        status: 'Processing',
        previousStatus: 'Pending',
        actorName: 'Brader',
        at: '2026-10-06T15:40:00.000+08:00',
        note: 'Order verified and boxed for J&T courier pickup.',
      },
      {
        status: 'Shipped',
        previousStatus: 'Processing',
        actorName: 'Spray & Sniff Admin',
        at: '2026-10-07T09:10:00.000+08:00',
        note: 'Picked up by J&T Express Philippines courier.',
      },
      {
        status: 'In Transit',
        previousStatus: 'Shipped',
        actorName: 'Spray & Sniff Admin',
        at: '2026-10-07T19:15:00.000+08:00',
        note: 'Arrived at J&T Tagum Distribution Hub.',
      },
      {
        status: 'Out for Delivery',
        previousStatus: 'In Transit',
        actorName: 'Spray & Sniff Admin',
        at: '2026-10-08T08:25:00.000+08:00',
        note: 'Out for delivery with J&T rider.',
      },
      {
        status: 'Delivered',
        previousStatus: 'Out for Delivery',
        actorName: 'Spray & Sniff Admin',
        at: '2026-10-08T14:35:00.000+08:00',
        note: 'Parcel delivered via J&T Express Philippines; COD payment verified.',
      },
    ],
  },
]

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
  const primarySize =
    Array.isArray(match.sizes) && match.sizes.length > 0
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

function formatShippingAddress(profile) {
  const parts = [profile.address, profile.city, profile.postal_code]
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter(Boolean)
  const addressLine = parts.length > 0 ? parts.join(', ') : 'Davao Region, Philippines'
  return profile.phone ? `${addressLine} (${profile.phone})` : addressLine
}

function sqlString(value) {
  if (value === null || value === undefined) return 'null'
  return `'${String(value).replace(/'/g, "''")}'`
}

function sqlNumber(value) {
  if (value === null || value === undefined) return 'null'
  return String(Number(value))
}

function getManagedOrderIds() {
  return ONLINE_DELIVERY_BLUEPRINTS.map((bp) =>
    buildAuthenticWebOrderId(new Date(bp.placedAt), bp.key),
  )
}

function buildDeliveryPayload(catalogRows, profileRows) {
  const profilesByEmail = new Map(
    profileRows.map((p) => [String(p.email).trim().toLowerCase(), p]),
  )

  const orderRecords = []
  const storeOrderRows = []
  const storeOrderItemRows = []
  const timelineRows = []
  const paymentRecordRows = []

  for (const bp of ONLINE_DELIVERY_BLUEPRINTS) {
    const profile = profilesByEmail.get(bp.profileEmail.toLowerCase())
    if (!profile) {
      throw new Error(`Customer profile not found for email "${bp.profileEmail}".`)
    }

    const placedDate = new Date(bp.placedAt)
    const createdAtIso = placedDate.toISOString()
    const orderId = buildAuthenticWebOrderId(placedDate, bp.key)

    const items = bp.items.map((item) => {
      const resolved = resolveCatalogProduct(catalogRows, item.key)
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
    const shipping = subtotal < FREE_SHIPPING_THRESHOLD ? STANDARD_SHIPPING_FEE : 0
    const tax = roundCurrency(subtotal * TAX_RATE)
    const total = roundCurrency(subtotal + tax + shipping)
    const shippingAddress = formatShippingAddress(profile)

    let notes = bp.orderNotes ?? null
    let checkoutSessionId = null
    let reference = null

    if (bp.paymentMethod === 'PayMongo') {
      checkoutSessionId = `cs_${deterministicHex(`session:${bp.key}`, 24)}`
      reference = `pm_${deterministicHex(`ref:${bp.key}`, 16)}`
      const segments = [
        reference,
        `PayMongo session: ${checkoutSessionId}`,
        bp.paymentChannel ? `PayMongo channel: ${bp.paymentChannel}` : '',
      ].filter(Boolean)
      notes = segments.join(' | ')
    } else if (bp.paymentStatus === 'Paid') {
      reference = `cod_${deterministicHex(`cod:${bp.key}`, 12)}`
    }

    const timeline = bp.timeline.map((step) => ({
      status: step.status,
      createdAt: new Date(step.at).toISOString(),
      note: step.note,
      actorName: step.actorName ?? undefined,
      previousStatus: step.previousStatus ?? undefined,
    }))

    const orderRecord = {
      id: orderId,
      source: 'ONLINE',
      customerId: profile.id,
      customerName: profile.name,
      customerEmail: profile.email,
      status: bp.status,
      paymentMethod: bp.paymentMethod,
      paymentStatus: bp.paymentStatus,
      createdAt: createdAtIso,
      subtotal,
      shipping,
      tax,
      total,
      shippingAddress,
      notes: notes ?? undefined,
      courier: bp.courier ?? undefined,
      courierSlug: bp.courierSlug ?? undefined,
      trackingNumber: bp.trackingNumber ?? undefined,
      deliveryNotes: bp.deliveryNotes ?? undefined,
      items,
      timeline,
    }

    orderRecords.push(orderRecord)

    storeOrderRows.push({
      id: orderId,
      source: 'ONLINE',
      customer_id: profile.id,
      customer_name: profile.name,
      customer_email: profile.email,
      status: bp.status,
      payment_method: bp.paymentMethod,
      payment_status: bp.paymentStatus,
      created_at: createdAtIso,
      subtotal,
      tax,
      shipping,
      total,
      shipping_address: shippingAddress,
      notes,
      courier: bp.courier ?? null,
      courier_slug: bp.courierSlug ?? null,
      tracking_number: bp.trackingNumber ?? null,
      delivery_notes: bp.deliveryNotes ?? null,
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

    timeline.forEach((entry, idx) => {
      timelineRows.push({
        id: `${orderId}::timeline::${idx}`,
        order_id: orderId,
        status: entry.status,
        created_at: entry.createdAt,
        note: entry.note,
        actor_name: entry.actorName ?? null,
        previous_status: entry.previousStatus ?? null,
      })
    })

    if (bp.paymentStatus === 'Paid') {
      const paidAt = bp.paidAt ? new Date(bp.paidAt).toISOString() : createdAtIso
      paymentRecordRows.push({
        id: `${orderId}::payment`,
        order_id: orderId,
        source: 'ONLINE',
        customer_id: profile.id,
        customer_name: profile.name,
        customer_email: profile.email,
        amount: total,
        subtotal,
        tax,
        shipping,
        payment_method: bp.paymentMethod,
        payment_gateway: bp.paymentMethod === 'PayMongo' ? 'PayMongo' : null,
        payment_channel: bp.paymentChannel ?? null,
        checkout_session_id: checkoutSessionId,
        reference,
        status: 'succeeded',
        paid_at: paidAt,
      })
    }
  }

  return {
    orderRecords,
    storeOrderRows,
    storeOrderItemRows,
    timelineRows,
    paymentRecordRows,
  }
}

function buildSqlDocument(payload) {
  const {
    orderRecords,
    storeOrderRows,
    storeOrderItemRows,
    timelineRows,
    paymentRecordRows,
  } = payload

  const orderValuesSql = storeOrderRows
    .map(
      (r) =>
        `  (${sqlString(r.id)}, ${sqlString(r.source)}, ${sqlString(r.customer_id)}::uuid, ${sqlString(r.customer_name)}, ${sqlString(r.customer_email)}, ${sqlString(r.status)}, ${sqlString(r.payment_method)}, ${sqlString(r.payment_status)}, ${sqlString(r.created_at)}::timestamptz, ${sqlNumber(r.subtotal)}, ${sqlNumber(r.tax)}, ${sqlNumber(r.shipping)}, ${sqlNumber(r.total)}, ${sqlString(r.shipping_address)}, ${sqlString(r.notes)}, ${sqlString(r.courier)}, ${sqlString(r.courier_slug)}, ${sqlString(r.tracking_number)}, ${sqlString(r.delivery_notes)}, null)`,
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
        `  (${sqlString(r.id)}, ${sqlString(r.order_id)}, ${sqlString(r.status)}, ${sqlString(r.created_at)}::timestamptz, ${sqlString(r.note)}, ${sqlString(r.actor_name)}, ${sqlString(r.previous_status)})`,
    )
    .join(',\n')

  const paymentValuesSql = paymentRecordRows
    .map(
      (r) =>
        `  (${sqlString(r.id)}, ${sqlString(r.order_id)}, ${sqlString(r.source)}, ${sqlString(r.customer_id)}::uuid, ${sqlString(r.customer_name)}, ${sqlString(r.customer_email)}, ${sqlNumber(r.amount)}, ${sqlNumber(r.subtotal)}, ${sqlNumber(r.tax)}, ${sqlNumber(r.shipping)}, ${sqlString(r.payment_method)}, ${sqlString(r.payment_gateway)}, ${sqlString(r.payment_channel)}, ${sqlString(r.checkout_session_id)}, ${sqlString(r.reference)}, ${sqlString(r.status)}, ${sqlString(r.paid_at)}::timestamptz)`,
    )
    .join(',\n')

  const compactOrders = orderRecords.map((order) => ({
    ...order,
    items: order.items.map(({ image: _image, ...rest }) => rest),
  }))
  const ordersJson = JSON.stringify(compactOrders).replace(/'/g, "''")

  return `-- Migration: Online Delivery Fulfillment Orders (Sep 28 – Oct 8, 2026)
-- Orders: ${orderRecords.length} | Timeline entries: ${timelineRows.length} | Paid records: ${paymentRecordRows.length}
-- Idempotent: safe to re-run; preserves all POS & other store orders and leaves inventory_items untouched.

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
  customer_id = excluded.customer_id,
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
  shipping_address = excluded.shipping_address,
  notes = excluded.notes,
  courier = excluded.courier,
  courier_slug = excluded.courier_slug,
  tracking_number = excluded.tracking_number,
  delivery_notes = excluded.delivery_notes;

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

insert into public.payment_records (
  id, order_id, source, customer_id, customer_name, customer_email,
  amount, subtotal, tax, shipping, payment_method, payment_gateway,
  payment_channel, checkout_session_id, reference, status, paid_at
) values
${paymentValuesSql}
on conflict (id) do update set
  order_id = excluded.order_id,
  source = excluded.source,
  customer_id = excluded.customer_id,
  customer_name = excluded.customer_name,
  customer_email = excluded.customer_email,
  amount = excluded.amount,
  subtotal = excluded.subtotal,
  tax = excluded.tax,
  shipping = excluded.shipping,
  payment_method = excluded.payment_method,
  payment_gateway = excluded.payment_gateway,
  payment_channel = excluded.payment_channel,
  checkout_session_id = excluded.checkout_session_id,
  reference = excluded.reference,
  status = excluded.status,
  paid_at = excluded.paid_at;

do $$
declare
  v_delivery_orders jsonb := '${ordersJson}'::jsonb;
  v_existing_state jsonb;
  v_preserved_orders jsonb;
  v_merged_orders jsonb;
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
      select d_elem->>'id' from jsonb_array_elements(v_delivery_orders) as d_elem
    );

  select coalesce(jsonb_agg(elem order by (elem->>'createdAt')::timestamptz desc), '[]'::jsonb)
  into v_merged_orders
  from jsonb_array_elements(v_preserved_orders || v_delivery_orders) as elem;

  insert into public.app_store_snapshots (id, state)
  values (
    'default',
    jsonb_set(v_existing_state, '{orders}', v_merged_orders, true)
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

async function cleanDeliveryOrders() {
  console.log('=== CLEANING MANAGED ONLINE DELIVERY ORDERS ===')
  const managedIds = getManagedOrderIds()
  const managedSet = new Set(managedIds)

  await Promise.all([
    supabase.from('order_timeline_entries').delete().in('order_id', managedIds),
    supabase.from('store_order_items').delete().in('order_id', managedIds),
    supabase.from('payment_records').delete().in('order_id', managedIds),
  ])
  const { error: delOrdersErr } = await supabase
    .from('store_orders')
    .delete()
    .in('id', managedIds)
  if (delOrdersErr) throw delOrdersErr

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
      orders: (existingState.orders || []).filter((o) => !managedSet.has(String(o.id))),
    }
    const { error: updateSnapErr } = await supabase.from('app_store_snapshots').upsert({
      id: 'default',
      state: nextState,
    })
    if (updateSnapErr) throw updateSnapErr
  }

  await bumpStoreSyncMeta()
  console.log(`✓ Removed ${managedIds.length} managed online delivery orders cleanly.`)
}

async function emitSqlFiles() {
  await ensureDummyProfiles()

  const [{ data: catalogRows, error: catErr }, { data: profileRows, error: profErr }] =
    await Promise.all([
      supabase.from('catalog_products').select('id, name, price, sizes, images'),
      supabase.from('profiles').select('id, email, name, role, phone, address, city, postal_code'),
    ])

  if (catErr) throw catErr
  if (profErr) throw profErr

  const payload = buildDeliveryPayload(catalogRows || [], profileRows || [])
  const deliverySql = buildSqlDocument(payload)

  const migrationPath = 'supabase/migrations/20261119152500_seed_online_delivery_orders.sql'
  fs.writeFileSync(migrationPath, deliverySql, 'utf-8')
  console.log(`✓ Generated SQL migration: ${migrationPath}`)

  const posMigrationPath = 'supabase/migrations/20261119143500_seed_pos_sales_sep28_oct08.sql'
  const combinedParts = []
  if (fs.existsSync(posMigrationPath)) {
    combinedParts.push(fs.readFileSync(posMigrationPath, 'utf-8').trim())
  }
  combinedParts.push(deliverySql.trim())
  fs.writeFileSync('supabase/seed.sql', `${combinedParts.join('\n\n')}\n`, 'utf-8')
  console.log('✓ Updated combined supabase/seed.sql (POS + Online Delivery)')
}

async function seedDeliveryOrders() {
  console.log('=== SEEDING ONLINE DELIVERY ORDERS ===')

  await ensureDummyProfiles()

  const [{ data: catalogRows, error: catErr }, { data: profileRows, error: profErr }] =
    await Promise.all([
      supabase.from('catalog_products').select('id, name, price, sizes, images'),
      supabase.from('profiles').select('id, email, name, role, phone, address, city, postal_code'),
    ])

  if (catErr) throw catErr
  if (profErr) throw profErr

  const {
    orderRecords,
    storeOrderRows,
    storeOrderItemRows,
    timelineRows,
    paymentRecordRows,
  } = buildDeliveryPayload(catalogRows || [], profileRows || [])

  const managedSet = new Set(orderRecords.map((o) => o.id))

  const { error: ordersErr } = await supabase
    .from('store_orders')
    .upsert(storeOrderRows, { onConflict: 'id' })
  if (ordersErr) throw ordersErr

  // Replace timeline/items per managed order cleanly in case step count changed
  await Promise.all([
    supabase.from('store_order_items').delete().in('order_id', [...managedSet]),
    supabase.from('order_timeline_entries').delete().in('order_id', [...managedSet]),
    supabase.from('payment_records').delete().in('order_id', [...managedSet]),
  ])

  const [itemsRes, timelineRes, payRes] = await Promise.all([
    supabase.from('store_order_items').upsert(storeOrderItemRows, { onConflict: 'id' }),
    supabase.from('order_timeline_entries').upsert(timelineRows, { onConflict: 'id' }),
    paymentRecordRows.length > 0
      ? supabase.from('payment_records').upsert(paymentRecordRows, { onConflict: 'id' })
      : Promise.resolve({ error: null }),
  ])

  if (itemsRes.error) throw itemsRes.error
  if (timelineRes.error) throw timelineRes.error
  if (payRes.error) throw payRes.error

  const { data: snapData, error: snapFetchErr } = await supabase
    .from('app_store_snapshots')
    .select('id, state')
    .eq('id', 'default')
    .maybeSingle()
  if (snapFetchErr) throw snapFetchErr

  const existingState = snapData?.state || {}
  const preservedOrders = (existingState.orders || []).filter(
    (o) => !String(o.id).startsWith('POS-SEED-') && !managedSet.has(String(o.id)),
  )
  const preservedPosTx = (existingState.posTransactions || []).filter(
    (tx) => !String(tx.id).startsWith('TX-SEED-'),
  )
  const mergedOrders = [...preservedOrders, ...orderRecords].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )

  const { error: snapUpsertErr } = await supabase.from('app_store_snapshots').upsert({
    id: 'default',
    state: {
      ...existingState,
      orders: mergedOrders,
      posTransactions: preservedPosTx,
    },
  })
  if (snapUpsertErr) throw snapUpsertErr

  await bumpStoreSyncMeta()

  for (const order of orderRecords) {
    console.log(
      `  • ${order.id} | ${order.status.padEnd(16)} | ${order.paymentMethod} (${order.paymentStatus}) | ${order.courier || 'Unassigned'} | ₱${order.total}`,
    )
  }

  console.log('\n=== ONLINE DELIVERY SEED COMPLETE ===')
  console.log(`Online orders seeded: ${orderRecords.length}`)
  console.log(`Timeline checkpoints: ${timelineRows.length}`)
}

const isCleanMode = process.argv.includes('--clean')
const isEmitSqlMode = process.argv.includes('--emit-sql')
;(isEmitSqlMode ? emitSqlFiles() : isCleanMode ? cleanDeliveryOrders() : seedDeliveryOrders())
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Online delivery seed failed:', err)
    process.exit(1)
  })
