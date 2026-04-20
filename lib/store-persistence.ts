import { seedPromotions, type StoredPromotion } from '@/lib/admin-promotions'
import { products, type Product } from '@/lib/products'
import {
  createSampleState,
  ensureInventoryRecordsForCatalog,
  normalizeState,
  PAYMENT_TEST_PRODUCT_ID,
  type CartItem,
  type InventoryRecord,
  type OrderRecord,
  type PosTransaction,
  type StockMovement,
  type StoreActor,
  type StoreState,
} from '@/lib/store-engine'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

const DEFAULT_STORE_ID = 'default'

interface EnsureSupabaseStoreSeededOptions {
  syncNormalizedTables?: boolean
}

function isBackofficeActor(actor?: StoreActor | null) {
  return actor?.role === 'ADMIN' || actor?.role === 'STAFF'
}

function ensurePaymentTestProduct(state: StoreState): StoreState {
  if (state.catalog.some((product) => product.id === PAYMENT_TEST_PRODUCT_ID)) {
    return state
  }

  const testProduct = products.find((product) => product.id === PAYMENT_TEST_PRODUCT_ID)
  if (!testProduct) {
    return state
  }

  const nextCatalog = [testProduct, ...state.catalog]
  const nextInventory = ensureInventoryRecordsForCatalog(nextCatalog, state.inventory)

  return {
    ...state,
    catalog: nextCatalog,
    inventory: nextInventory,
  }
}

type CatalogProductRow = {
  id: string
  name: string
  brand: string
  description: string
  price: number
  category: string
  scent_family: string[]
  gender: Product['gender']
  top_notes: string[]
  middle_notes: string[]
  base_notes: string[]
  longevity: number
  intensity: number
  sizes: Product['sizes']
  images: string[]
  rating: number
  review_count: number
  in_stock: boolean
  featured: boolean
  is_new_arrival: boolean
  occasions: string[]
  seasons: string[]
  related_products: string[]
}

type InventoryItemRow = {
  product_id: string
  sku: string
  stock: number
  reorder_point: number
  location: string
  last_updated: string
  last_updated_by: string | null
  is_archived: boolean
  archived_at: string | null
  archived_by: string | null
}

type StoreOrderRow = {
  id: string
  source: OrderRecord['source']
  customer_id: string | null
  customer_name: string
  customer_email: string
  status: OrderRecord['status']
  payment_method: OrderRecord['paymentMethod']
  payment_status: OrderRecord['paymentStatus']
  created_at: string
  subtotal: number
  tax: number
  shipping: number
  total: number
  shipping_address: string | null
  notes: string | null
}

type StoreOrderItemRow = {
  order_id: string
  product_id: string
  product_name: string
  size_ml: number
  quantity: number
  unit_price: number
}

type OrderTimelineEntryRow = {
  order_id: string
  status: OrderRecord['status']
  created_at: string
  note: string
}

type PosTransactionRow = {
  id: string
  order_id: string
  cashier_name: string
  payment_method: PosTransaction['paymentMethod']
  created_at: string
  subtotal: number
  tax: number
  total: number
  items_count: number
}

type StockMovementRow = {
  id: string
  product_id: string
  product_name: string
  change_quantity: number
  reason: StockMovement['reason']
  actor: string
  created_at: string
  resulting_stock: number
  note: string | null
}

export function createPublicStoreState(state: StoreState): StoreState {
  return {
    catalog: state.catalog,
    inventory: state.inventory,
    cart: [],
    orders: [],
    posTransactions: [],
    stockMovements: [],
  }
}

export function getVisibleStoreState(
  state: StoreState,
  actor?: StoreActor | null,
  cart: CartItem[] = [],
): StoreState {
  if (isBackofficeActor(actor)) {
    return {
      ...state,
      cart,
    }
  }

  const customerOrders =
    actor?.role === 'USER'
      ? state.orders.filter(
          (order) =>
            order.source === 'ONLINE' &&
            order.customerEmail.trim().toLowerCase() === actor.email.trim().toLowerCase(),
        )
      : []

  return {
    ...createPublicStoreState(state),
    cart,
    orders: customerOrders,
  }
}

async function syncPublicStoreSnapshot(state: StoreState) {
  const supabase = createSupabaseAdminClient()

  await supabase.from('public_store_snapshots').upsert({
    id: DEFAULT_STORE_ID,
    state: createPublicStoreState(state),
  })
}

function getOrderUpdatedAt(order: OrderRecord) {
  return order.timeline[order.timeline.length - 1]?.createdAt ?? order.createdAt
}

function getOrderPaidAt(order: OrderRecord) {
  const paymentTimelineEntry = [...order.timeline]
    .reverse()
    .find((entry) => entry.note.toLowerCase().includes('payment'))

  return paymentTimelineEntry?.createdAt ?? order.createdAt
}

function mapCatalogProductStateRow(
  row: CatalogProductRow,
  inventoryRecord?: InventoryRecord,
): Product {
  return {
    id: row.id,
    name: row.name,
    brand: row.brand,
    description: row.description,
    price: Number(row.price),
    category: row.category,
    scentFamily: Array.isArray(row.scent_family) ? row.scent_family : [],
    gender: row.gender,
    topNotes: Array.isArray(row.top_notes) ? row.top_notes : [],
    middleNotes: Array.isArray(row.middle_notes) ? row.middle_notes : [],
    baseNotes: Array.isArray(row.base_notes) ? row.base_notes : [],
    longevity: Number(row.longevity),
    intensity: Number(row.intensity),
    sizes: Array.isArray(row.sizes) ? row.sizes : [],
    images: Array.isArray(row.images) ? row.images : [],
    rating: Number(row.rating),
    reviewCount: Number(row.review_count),
    inStock: inventoryRecord ? inventoryRecord.stock > 0 && !inventoryRecord.isArchived : row.in_stock,
    featured: Boolean(row.featured),
    isNewArrival: Boolean(row.is_new_arrival),
    occasions: Array.isArray(row.occasions) ? row.occasions : [],
    seasons: Array.isArray(row.seasons) ? row.seasons : [],
    relatedProducts: Array.isArray(row.related_products) ? row.related_products : [],
  }
}

function mapInventoryStateRow(row: InventoryItemRow): InventoryRecord {
  return {
    productId: row.product_id,
    sku: row.sku,
    stock: Number(row.stock),
    reorderPoint: Number(row.reorder_point),
    location: row.location,
    lastUpdated: row.last_updated,
    lastUpdatedBy: row.last_updated_by ?? undefined,
    isArchived: Boolean(row.is_archived),
    archivedAt: row.archived_at ?? undefined,
    archivedBy: row.archived_by ?? undefined,
  }
}

function mapPosTransactionStateRow(row: PosTransactionRow): PosTransaction {
  return {
    id: row.id,
    orderId: row.order_id,
    cashierName: row.cashier_name,
    paymentMethod: row.payment_method,
    createdAt: row.created_at,
    subtotal: Number(row.subtotal),
    tax: Number(row.tax),
    total: Number(row.total),
    itemsCount: Number(row.items_count),
  }
}

function mapStockMovementStateRow(row: StockMovementRow): StockMovement {
  return {
    id: row.id,
    productId: row.product_id,
    productName: row.product_name,
    change: Number(row.change_quantity),
    reason: row.reason,
    actor: row.actor,
    createdAt: row.created_at,
    resultingStock: Number(row.resulting_stock),
    note: row.note ?? undefined,
  }
}

async function loadBackofficeStoreState() {
  await ensureSupabaseStoreSeeded({ syncNormalizedTables: true })

  const supabase = createSupabaseAdminClient()
  const [
    { data: catalogRows, error: catalogError },
    { data: inventoryRows, error: inventoryError },
    { data: orderRows, error: ordersError },
    { data: orderItemRows, error: orderItemsError },
    { data: orderTimelineRows, error: timelineError },
    { data: posRows, error: posError },
    { data: stockMovementRows, error: stockError },
  ] = await Promise.all([
    supabase.from('catalog_products').select(
      'id, name, brand, description, price, category, scent_family, gender, top_notes, middle_notes, base_notes, longevity, intensity, sizes, images, rating, review_count, in_stock, featured, is_new_arrival, occasions, seasons, related_products',
    ),
    supabase.from('inventory_items').select(
      'product_id, sku, stock, reorder_point, location, last_updated, last_updated_by, is_archived, archived_at, archived_by',
    ),
    supabase.from('store_orders').select(
      'id, source, customer_id, customer_name, customer_email, status, payment_method, payment_status, created_at, subtotal, tax, shipping, total, shipping_address, notes',
    ),
    supabase.from('store_order_items').select(
      'order_id, product_id, product_name, size_ml, quantity, unit_price',
    ),
    supabase.from('order_timeline_entries').select(
      'order_id, status, created_at, note',
    ),
    supabase.from('pos_transactions').select(
      'id, order_id, cashier_name, payment_method, created_at, subtotal, tax, total, items_count',
    ),
    supabase.from('stock_movements').select(
      'id, product_id, product_name, change_quantity, reason, actor, created_at, resulting_stock, note',
    ),
  ])

  if (catalogError) throw catalogError
  if (inventoryError) throw inventoryError
  if (ordersError) throw ordersError
  if (orderItemsError) throw orderItemsError
  if (timelineError) throw timelineError
  if (posError) throw posError
  if (stockError) throw stockError

  const inventory = ((inventoryRows ?? []) as InventoryItemRow[])
    .map(mapInventoryStateRow)
    .sort((left, right) => left.productId.localeCompare(right.productId))
  const inventoryByProductId = new Map(inventory.map((record) => [record.productId, record]))

  const catalog = ((catalogRows ?? []) as CatalogProductRow[])
    .map((row) => mapCatalogProductStateRow(row, inventoryByProductId.get(row.id)))
    .sort((left, right) => left.name.localeCompare(right.name))

  const orderItemsByOrderId = new Map<string, OrderRecord['items']>()
  for (const row of (orderItemRows ?? []) as StoreOrderItemRow[]) {
    const items = orderItemsByOrderId.get(row.order_id) ?? []
    items.push({
      productId: row.product_id,
      productName: row.product_name,
      size: Number(row.size_ml),
      quantity: Number(row.quantity),
      unitPrice: Number(row.unit_price),
    })
    orderItemsByOrderId.set(row.order_id, items)
  }

  const timelineByOrderId = new Map<string, OrderRecord['timeline']>()
  for (const row of (orderTimelineRows ?? []) as OrderTimelineEntryRow[]) {
    const timeline = timelineByOrderId.get(row.order_id) ?? []
    timeline.push({
      status: row.status,
      createdAt: row.created_at,
      note: row.note,
    })
    timelineByOrderId.set(row.order_id, timeline)
  }

  const orders = ((orderRows ?? []) as StoreOrderRow[])
    .map((row) => ({
      id: row.id,
      source: row.source,
      customerId: row.customer_id,
      customerName: row.customer_name,
      customerEmail: row.customer_email,
      status: row.status,
      paymentMethod: row.payment_method,
      paymentStatus: row.payment_status,
      createdAt: row.created_at,
      subtotal: Number(row.subtotal),
      tax: Number(row.tax),
      shipping: Number(row.shipping),
      total: Number(row.total),
      shippingAddress: row.shipping_address ?? undefined,
      notes: row.notes ?? undefined,
      items: (orderItemsByOrderId.get(row.id) ?? []).sort((left, right) =>
        left.productName.localeCompare(right.productName),
      ),
      timeline: (timelineByOrderId.get(row.id) ?? []).sort(
        (left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
      ),
    }))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())

  const posTransactions = ((posRows ?? []) as PosTransactionRow[])
    .map(mapPosTransactionStateRow)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())

  const stockMovements = ((stockMovementRows ?? []) as StockMovementRow[])
    .map(mapStockMovementStateRow)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())

  return {
    catalog,
    inventory,
    cart: [],
    orders,
    posTransactions,
    stockMovements,
  } satisfies StoreState
}

function mapCatalogProductRow(product: Product) {
  return {
    id: product.id,
    name: product.name,
    brand: product.brand,
    description: product.description,
    price: product.price,
    category: product.category,
    scent_family: product.scentFamily,
    gender: product.gender,
    top_notes: product.topNotes,
    middle_notes: product.middleNotes,
    base_notes: product.baseNotes,
    longevity: product.longevity,
    intensity: product.intensity,
    sizes: product.sizes,
    images: product.images,
    rating: product.rating,
    review_count: product.reviewCount,
    in_stock: product.inStock,
    featured: product.featured,
    is_new_arrival: product.isNewArrival,
    occasions: product.occasions,
    seasons: product.seasons,
    related_products: product.relatedProducts,
  }
}

function mapInventoryRow(record: InventoryRecord) {
  return {
    product_id: record.productId,
    sku: record.sku,
    stock: record.stock,
    reorder_point: record.reorderPoint,
    location: record.location,
    last_updated: record.lastUpdated,
    last_updated_by: record.lastUpdatedBy ?? null,
    is_archived: record.isArchived,
    archived_at: record.archivedAt ?? null,
    archived_by: record.archivedBy ?? null,
  }
}

function mapStoreOrderRow(order: OrderRecord) {
  return {
    id: order.id,
    source: order.source,
    customer_id: order.customerId ?? null,
    customer_name: order.customerName,
    customer_email: order.customerEmail,
    status: order.status,
    payment_method: order.paymentMethod,
    payment_status: order.paymentStatus,
    created_at: order.createdAt,
    updated_at: getOrderUpdatedAt(order),
    subtotal: order.subtotal,
    tax: order.tax,
    shipping: order.shipping,
    total: order.total,
    shipping_address: order.shippingAddress ?? null,
    notes: order.notes ?? null,
  }
}

function mapStoreOrderItemRows(orders: OrderRecord[]) {
  return orders.flatMap((order) =>
    order.items.map((item, index) => ({
      id: `${order.id}::item::${index}`,
      order_id: order.id,
      product_id: item.productId,
      product_name: item.productName,
      size_ml: item.size,
      quantity: item.quantity,
      unit_price: item.unitPrice,
    })),
  )
}

function mapOrderTimelineRows(orders: OrderRecord[]) {
  return orders.flatMap((order) =>
    order.timeline.map((entry, index) => ({
      id: `${order.id}::timeline::${index}`,
      order_id: order.id,
      status: entry.status,
      created_at: entry.createdAt,
      note: entry.note,
    })),
  )
}

function mapPosTransactionRow(transaction: PosTransaction) {
  return {
    id: transaction.id,
    order_id: transaction.orderId,
    cashier_name: transaction.cashierName,
    payment_method: transaction.paymentMethod,
    created_at: transaction.createdAt,
    subtotal: transaction.subtotal,
    tax: transaction.tax,
    total: transaction.total,
    items_count: transaction.itemsCount,
  }
}

function mapStockMovementRow(movement: StockMovement) {
  return {
    id: movement.id,
    product_id: movement.productId,
    product_name: movement.productName,
    change_quantity: movement.change,
    reason: movement.reason,
    actor: movement.actor,
    created_at: movement.createdAt,
    resulting_stock: movement.resultingStock,
    note: movement.note ?? null,
  }
}

function parseOrderPaymentMetadata(order: OrderRecord) {
  const segments =
    order.notes
      ?.split('|')
      .map((value) => value.trim())
      .filter(Boolean) ?? []

  let reference: string | null = null
  let checkoutSessionId: string | null = null
  let paymentChannel: string | null = null

  segments.forEach((segment) => {
    if (segment.startsWith('PayMongo session:')) {
      checkoutSessionId = segment.replace('PayMongo session:', '').trim() || null
      return
    }

    if (segment.startsWith('PayMongo channel:')) {
      paymentChannel = segment.replace('PayMongo channel:', '').trim() || null
      return
    }

    if (!reference) {
      reference = segment
    }
  })

  return {
    checkoutSessionId,
    paymentChannel,
    reference,
  }
}

function mapPaymentRecordRows(orders: OrderRecord[]) {
  return orders
    .filter((order) => order.paymentStatus === 'Paid')
    .map((order) => {
      const metadata = parseOrderPaymentMetadata(order)

      return {
        id: `${order.id}::payment`,
        order_id: order.id,
        source: order.source,
        customer_id: order.customerId ?? null,
        customer_name: order.customerName,
        customer_email: order.customerEmail,
        amount: order.total,
        subtotal: order.subtotal,
        tax: order.tax,
        shipping: order.shipping,
        payment_method: order.paymentMethod,
        payment_gateway: order.paymentMethod === 'PayMongo' ? 'PayMongo' : null,
        payment_channel: metadata.paymentChannel,
        checkout_session_id: metadata.checkoutSessionId,
        reference: metadata.reference,
        status: 'succeeded',
        paid_at: getOrderPaidAt(order),
      }
    })
}

async function syncRowsByKey(
  table: string,
  key: string,
  rows: Record<string, unknown>[],
) {
  const supabase = createSupabaseAdminClient()
  const { data: existingRows, error: existingError } = await supabase.from(table).select(key)

  if (existingError) {
    throw existingError
  }

  if (rows.length > 0) {
    const { error: upsertError } = await supabase.from(table).upsert(rows)

    if (upsertError) {
      throw upsertError
    }
  }

  const nextKeys = new Set(rows.map((row) => String(row[key])))
  const existingKeyRows = Array.isArray(existingRows) ? (existingRows as unknown[]) : []
  const keysToDelete = existingKeyRows
    .map((row) => {
      if (!row || typeof row !== 'object') {
        return null
      }

      const value = (row as Record<string, unknown>)[key]
      return value == null ? null : String(value)
    })
    .filter((value): value is string => value !== null)
    .filter((value) => !nextKeys.has(value))

  if (keysToDelete.length > 0) {
    const { error: deleteError } = await supabase.from(table).delete().in(key, keysToDelete)

    if (deleteError) {
      throw deleteError
    }
  }
}

async function syncNormalizedStoreTables(state: StoreState) {
  await syncRowsByKey('catalog_products', 'id', state.catalog.map(mapCatalogProductRow))
  await syncRowsByKey('inventory_items', 'product_id', state.inventory.map(mapInventoryRow))
  await syncRowsByKey('store_orders', 'id', state.orders.map(mapStoreOrderRow))
  await syncRowsByKey('store_order_items', 'id', mapStoreOrderItemRows(state.orders))
  await syncRowsByKey('order_timeline_entries', 'id', mapOrderTimelineRows(state.orders))
  await syncRowsByKey('payment_records', 'id', mapPaymentRecordRows(state.orders))
  await syncRowsByKey(
    'pos_transactions',
    'id',
    state.posTransactions.map(mapPosTransactionRow),
  )
  await syncRowsByKey(
    'stock_movements',
    'id',
    state.stockMovements.map(mapStockMovementRow),
  )
}

export async function ensureSupabaseStoreSeeded(
  options: EnsureSupabaseStoreSeededOptions = {},
) {
  const { syncNormalizedTables = false } = options
  const supabase = createSupabaseAdminClient()
  let fullState: StoreState
  let shouldUpsertSnapshot = false
  let shouldSyncPublicSnapshot = false
  let shouldSyncNormalizedTables = false

  const [
    { data: storeRow, error: storeError },
    { data: publicStoreRow, error: publicStoreError },
    { count: promotionCount, error: promotionError },
  ] = await Promise.all([
    supabase
      .from('app_store_snapshots')
      .select('id, state')
      .eq('id', DEFAULT_STORE_ID)
      .maybeSingle(),
    supabase
      .from('public_store_snapshots')
      .select('id')
      .eq('id', DEFAULT_STORE_ID)
      .maybeSingle(),
    supabase.from('promotions').select('id', { head: true, count: 'exact' }),
  ])

  if (storeError) {
    throw storeError
  }

  if (publicStoreError) {
    throw publicStoreError
  }

  if (promotionError) {
    throw promotionError
  }

  if (!storeRow) {
    const seedState = createSampleState()
    fullState = seedState
    shouldUpsertSnapshot = true
    shouldSyncPublicSnapshot = true
    shouldSyncNormalizedTables = true
  } else {
    fullState = normalizeState((storeRow.state as Partial<StoreState> | null) ?? null)
  }

  const hydratedState = ensurePaymentTestProduct(fullState)
  if (hydratedState !== fullState) {
    fullState = hydratedState
    shouldUpsertSnapshot = true
    shouldSyncPublicSnapshot = true
    shouldSyncNormalizedTables = true
  }

  if (!publicStoreRow) {
    shouldSyncPublicSnapshot = true
  }

  if (!promotionCount) {
    await supabase.from('promotions').upsert(
      seedPromotions.map((promotion) => ({
        id: promotion.id,
        code: promotion.code,
        type: promotion.type,
        discount: promotion.discount,
        used_count: promotion.usedCount,
        usage_limit: promotion.usageLimit,
        status: promotion.status,
        starts_at: promotion.startsAt,
        expires_at: promotion.expiresAt,
        description: promotion.description,
      })),
    )
  }

  if (shouldUpsertSnapshot) {
    await supabase.from('app_store_snapshots').upsert({
      id: DEFAULT_STORE_ID,
      state: { ...fullState, cart: [] },
    })
  }

  if (syncNormalizedTables && !shouldSyncNormalizedTables) {
    const { count: catalogCount, error: catalogCountError } = await supabase
      .from('catalog_products')
      .select('id', { head: true, count: 'exact' })

    if (catalogCountError) {
      throw catalogCountError
    }

    shouldSyncNormalizedTables = !catalogCount
  }

  if (shouldSyncPublicSnapshot) {
    await syncPublicStoreSnapshot({
      ...fullState,
      cart: [],
    })
  }

  if (syncNormalizedTables && shouldSyncNormalizedTables) {
    await syncNormalizedStoreTables({
      ...fullState,
      cart: [],
    })
  }
}

export async function loadStoreSnapshot() {
  await ensureSupabaseStoreSeeded()

  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from('app_store_snapshots')
    .select('state')
    .eq('id', DEFAULT_STORE_ID)
    .single()

  return normalizeState((data?.state as Partial<StoreState> | null) ?? null)
}

export async function loadStoreStateForActor(actor?: StoreActor | null) {
  if (isBackofficeActor(actor)) {
    return loadBackofficeStoreState()
  }

  return loadStoreSnapshot()
}

export async function saveStoreSnapshot(state: StoreState) {
  const supabase = createSupabaseAdminClient()
  const normalized = normalizeState({ ...state, cart: [] })

  await supabase.from('app_store_snapshots').upsert({
    id: DEFAULT_STORE_ID,
    state: { ...normalized, cart: [] },
  })

  await syncPublicStoreSnapshot(normalized)
  await syncNormalizedStoreTables(normalized)

  return normalized
}

export async function loadUserCart(userId: string) {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from('user_carts')
    .select('items')
    .eq('user_id', userId)
    .maybeSingle()

  return Array.isArray(data?.items) ? (data.items as CartItem[]) : []
}

export async function saveUserCart(userId: string, items: CartItem[]) {
  const supabase = createSupabaseAdminClient()

  await supabase.from('user_carts').upsert({
    user_id: userId,
    items,
  })
}

export async function loadUserWishlist(userId: string) {
  const supabase = createSupabaseAdminClient()
  const { data } = await supabase
    .from('user_wishlists')
    .select('product_ids')
    .eq('user_id', userId)
    .maybeSingle()

  return Array.isArray(data?.product_ids) ? (data.product_ids as string[]) : []
}

export async function saveUserWishlist(userId: string, productIds: string[]) {
  const supabase = createSupabaseAdminClient()

  await supabase.from('user_wishlists').upsert({
    user_id: userId,
    product_ids: productIds,
  })
}

export function mapPromotionRow(row: {
  id: string
  code: string
  type: StoredPromotion['type']
  discount: number
  used_count: number
  usage_limit: number | null
  status: StoredPromotion['status']
  starts_at: string
  expires_at: string
  description: string
}): StoredPromotion {
  return {
    id: row.id,
    code: row.code,
    type: row.type,
    discount: Number(row.discount),
    usedCount: row.used_count,
    usageLimit: row.usage_limit,
    status: row.status,
    startsAt: row.starts_at,
    expiresAt: row.expires_at,
    description: row.description,
  }
}
