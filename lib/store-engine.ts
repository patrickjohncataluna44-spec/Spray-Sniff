import type { Product } from '@/lib/products'
import { products } from '@/lib/products'
import { DEMO_USER_EMAIL } from '@/lib/site'

const TAX_RATE = 0.12
const STANDARD_SHIPPING_FEE = 75
const FREE_SHIPPING_THRESHOLD = 400
export const PAYMENT_TEST_PRODUCT_ID = 'test-1peso'

const DEFAULT_LOCATIONS = [
  'A1-01',
  'A1-02',
  'A1-03',
  'A2-01',
  'A2-02',
  'B1-01',
  'B1-02',
  'B2-01',
] as const

const SEEDED_STOCK_LEVELS: Record<string, number> = {
  '1': 18,
  '2': 9,
  '3': 14,
  '4': 4,
  '5': 11,
  '6': 7,
  '7': 2,
  '8': 0,
  [PAYMENT_TEST_PRODUCT_ID]: 50,
}

export const ONLINE_PAYMENT_METHODS = ['PayMongo', 'Cash on Delivery'] as const
export const POS_PAYMENT_METHODS = ['Cash', 'QR Pay', 'Card', 'GCash'] as const
export const ONLINE_ORDER_STATUSES = [
  'Pending',
  'Processing',
  'Shipped',
  'In Transit',
  'Out for Delivery',
  'Delivered',
] as const

/**
 * Statuses that represent physical delivery progress. Only an ADMIN may set
 * these; STAFF is limited to the pre-delivery workflow (Pending -> Processing).
 */
export const DELIVERY_ORDER_STATUSES = [
  'Shipped',
  'In Transit',
  'Out for Delivery',
  'Delivered',
] as const

/**
 * Delivery stages advance forward only. A lower rank than the order's current
 * stage is rejected, which also makes 'Delivered' terminal so a delivered order
 * can never be reset back to an earlier stage.
 */
const DELIVERY_STATUS_RANK: Partial<Record<OrderStatus, number>> = {
  Shipped: 0,
  'In Transit': 1,
  'Out for Delivery': 2,
  Delivered: 3,
}

export type StoreUserRole = 'ADMIN' | 'STAFF' | 'USER'
export type HistoricalPaymentMethod = 'Card' | 'PayPal' | 'Bank Transfer'
export type OnlinePaymentMethod = (typeof ONLINE_PAYMENT_METHODS)[number]
export type PosPaymentMethod = (typeof POS_PAYMENT_METHODS)[number]
export type PaymentMethod = OnlinePaymentMethod | PosPaymentMethod | HistoricalPaymentMethod
export type OrderSource = 'ONLINE' | 'POS'
export type PaymentStatus = 'Paid' | 'Pending'
export type OrderStatus =
  | (typeof ONLINE_ORDER_STATUSES)[number]
  | 'Completed'
  | 'Cancelled'
export type StockMovementReason =
  | 'restock'
  | 'manual-adjustment'
  | 'online-sale'
  | 'pos-sale'
  | 'order-cancelled'
export type InventoryAvailability = 'In Stock' | 'Low Stock' | 'Out of Stock'

export interface StoreActor {
  id: string
  email: string
  name: string
  role: StoreUserRole
}

export interface CartItem {
  productId: string
  size: number
  quantity: number
  unitPrice: number
}

export type InventoryStockHealth = 'in_stock' | 'low_stock' | 'over_stock' | 'out_of_stock'

export const DEFAULT_OVERSTOCK_THRESHOLD = 50

export function getInventoryStockHealth(
  stock: number,
  reorderPoint: number = 3,
  overStockThreshold: number = DEFAULT_OVERSTOCK_THRESHOLD,
  isArchived = false,
): InventoryStockHealth {
  if (isArchived || stock <= 0) {
    return 'out_of_stock'
  }
  if (stock <= reorderPoint) {
    return 'low_stock'
  }
  if (stock >= overStockThreshold) {
    return 'over_stock'
  }
  return 'in_stock'
}

export interface InventoryRecord {
  productId: string
  sku: string
  stock: number
  reorderPoint: number
  overStockThreshold?: number
  location: string
  lastUpdated: string
  lastUpdatedBy?: string
  isArchived: boolean
  archivedAt?: string
  archivedBy?: string
}

export interface OrderLineItem {
  productId: string
  productName: string
  size: number
  quantity: number
  unitPrice: number
  image?: string
}

export interface OrderTimelineEntry {
  status: OrderStatus
  createdAt: string
  note: string
  /** The status this entry moved the order away from. */
  previousStatus?: OrderStatus
  /** Display name of the admin who recorded the change. */
  actorName?: string
  /** Account id of the admin who recorded the change. */
  actorId?: string
}

export interface OrderPaymentSummary {
  paymentGateway?: string
  paymentChannel?: string
  reference?: string
  checkoutSessionId?: string
  paidAt?: string
}

export interface OrderActionAvailability {
  canCancel: boolean
  cancelBlockedReason?: string
  needsRefundFollowUp: boolean
}

export interface OrderRecord {
  id: string
  source: OrderSource
  customerId?: string | null
  customerName: string
  customerEmail: string
  status: OrderStatus
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  createdAt: string
  subtotal: number
  tax: number
  shipping: number
  total: number
  shippingAddress?: string
  notes?: string
  /** Courier or logistics partner handling the delivery, entered by an admin. */
  courier?: string
  /** The courier's own tracking number for this parcel, entered by an admin. */
  trackingNumber?: string
  /** Free-text delivery instructions recorded by an admin. */
  deliveryNotes?: string
  items: OrderLineItem[]
  timeline: OrderTimelineEntry[]
  paymentSummary?: OrderPaymentSummary
  actionAvailability?: OrderActionAvailability
}

export interface PosTransaction {
  id: string
  orderId: string
  cashierName: string
  paymentMethod: PosPaymentMethod
  createdAt: string
  subtotal: number
  tax: number
  total: number
  itemsCount: number
}

export interface StockMovement {
  id: string
  productId: string
  productName: string
  change: number
  reason: StockMovementReason
  actor: string
  createdAt: string
  resultingStock: number
  note?: string
}

export interface PlaceOnlineOrderInput {
  customerName: string
  customerEmail: string
  shippingAddress: string
  paymentMethod: OnlinePaymentMethod
  notes?: string
  items?: CartItem[]
}

export interface CreatePosSaleInput {
  cashierName: string
  customerName?: string
  paymentMethod: PosPaymentMethod
  items: CartItem[]
  notes?: string
  clientSaleId?: string
}

export interface AddCatalogProductOptions {
  initialStock: number
  reorderPoint?: number
  overStockThreshold?: number
  location?: string
  actor?: string
}

export interface UpdateCatalogProductOptions {
  stock: number
  reorderPoint?: number
  overStockThreshold?: number
  location?: string
  actor?: string
}

export interface UpdateInventoryInput {
  productId: string
  stock: number
  reorderPoint?: number
  overStockThreshold?: number
  location?: string
  actor?: string
  note?: string
}

export interface AdjustInventoryInput {
  productId: string
  delta: number
  actor: string
  note?: string
  location?: string
}

export interface ArchiveInventoryItemInput {
  productId: string
  actor: string
  note?: string
}

export interface RestoreInventoryItemInput {
  productId: string
  actor: string
}

export interface StoreActionResult<T = undefined> {
  ok: boolean
  message: string
  data?: T
}

export interface StoreState {
  catalog: Product[]
  inventory: InventoryRecord[]
  cart: CartItem[]
  orders: OrderRecord[]
  posTransactions: PosTransaction[]
  stockMovements: StockMovement[]
}

export function createEmptyStoreState(): StoreState {
  return {
    catalog: [],
    inventory: [],
    cart: [],
    orders: [],
    posTransactions: [],
    stockMovements: [],
  }
}

export type StoreAction =
  | { type: 'addCatalogProduct'; product: Product; options?: AddCatalogProductOptions }
  | {
      type: 'updateCatalogProduct'
      productId: string
      product: Product
      options: UpdateCatalogProductOptions
    }
  | { type: 'removeCatalogProduct'; productId: string }
  | { type: 'updateInventory'; input: UpdateInventoryInput }
  | { type: 'adjustInventory'; input: AdjustInventoryInput }
  | { type: 'archiveInventoryItem'; input: ArchiveInventoryItemInput }
  | { type: 'restoreInventoryItem'; input: RestoreInventoryItemInput }
  | { type: 'addToCart'; item: CartItem }
  | { type: 'updateCartQuantity'; productId: string; size: number; quantity: number }
  | { type: 'removeFromCart'; productId: string; size: number }
  | { type: 'clearCart' }
  | { type: 'placeOnlineOrder'; input: PlaceOnlineOrderInput }
  | { type: 'createPosSale'; input: CreatePosSaleInput }
  | { type: 'cancelOwnOrder'; orderId: string }
  | {
      type: 'updateOrderDelivery'
      orderId: string
      status: OrderStatus
      courier?: string
      trackingNumber?: string
      deliveryNotes?: string
      note?: string
    }
  | { type: 'markOrderPaymentPaid'; orderId: string; actor?: string; note?: string }
  | { type: 'updateOrderStatus'; orderId: string; status: OrderStatus; actor?: string; note?: string }

export interface StoreMutationResponse<T = undefined> {
  nextState: StoreState
  result: StoreActionResult<T>
}

function roundCurrency(value: number) {
  return Math.round(value * 100) / 100
}

function isoFromNow(daysOffset: number, hoursOffset = 0) {
  const date = new Date()
  date.setDate(date.getDate() + daysOffset)
  date.setHours(date.getHours() + hoursOffset)
  return date.toISOString()
}

function clampToWholeNumber(value: number) {
  if (Number.isNaN(value) || !Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.round(value))
}

function createSku(product: Product, index: number) {
  const compactName = product.name.toUpperCase().replace(/[^A-Z0-9]+/g, '').slice(0, 6)
  return `SNS-${String(index + 1).padStart(3, '0')}-${compactName}`
}

function hasRole(actor: StoreActor | null | undefined, role: StoreUserRole) {
  return actor?.role === role
}

function canShop(actor: StoreActor | null | undefined) {
  return actor?.role === 'USER' || actor?.role === 'ADMIN' || actor?.role === 'STAFF'
}

function canAccessBackoffice(actor: StoreActor | null | undefined) {
  return actor?.role === 'ADMIN' || actor?.role === 'STAFF'
}

function isDeliveryOrderStatus(status: OrderStatus) {
  return (DELIVERY_ORDER_STATUSES as readonly OrderStatus[]).includes(status)
}

const MAX_DELIVERY_FIELD_LENGTH = 200

/**
 * Trims an admin-entered delivery field and caps its length. Returns undefined
 * for blank input so an empty form field leaves the stored value untouched.
 */
function sanitizeDeliveryField(value: string | undefined | null) {
  if (typeof value !== 'string') {
    return undefined
  }

  const trimmed = value.trim()
  if (!trimmed) {
    return undefined
  }

  return trimmed.slice(0, MAX_DELIVERY_FIELD_LENGTH)
}

function getActorName(actor: StoreActor | null | undefined, fallback: string) {
  return actor?.name || fallback
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export function orderBelongsToActor(
  order: Pick<OrderRecord, 'customerId' | 'customerEmail'>,
  actor?: Pick<StoreActor, 'id' | 'email'> | null,
) {
  if (!actor) {
    return false
  }

  if (order.customerId && actor.id && order.customerId === actor.id) {
    return true
  }

  if (actor.email && order.customerEmail) {
    return normalizeEmail(order.customerEmail) === normalizeEmail(actor.email)
  }

  return false
}

export function getOrderNeedsRefundFollowUp(
  order: Pick<OrderRecord, 'status' | 'paymentStatus'>,
) {
  return order.status === 'Cancelled' && order.paymentStatus === 'Paid'
}

export function getCustomerOrderActionAvailability(
  order: OrderRecord,
  actor?: StoreActor | null,
): OrderActionAvailability {
  const ownsOrder = actor?.role === 'USER' && order.source === 'ONLINE' && orderBelongsToActor(order, actor)
  const needsRefundFollowUp = getOrderNeedsRefundFollowUp(order)

  if (!ownsOrder) {
    return {
      canCancel: false,
      needsRefundFollowUp,
    }
  }

  const canCancel = order.status === 'Pending' || order.status === 'Processing'

  let cancelBlockedReason: string | undefined

  if (!canCancel) {
    switch (order.status) {
      case 'Cancelled':
        cancelBlockedReason = 'This order has already been cancelled.'
        break
      case 'Shipped':
      case 'In Transit':
      case 'Out for Delivery':
        cancelBlockedReason = 'This order is already in dispatch and can no longer be cancelled here.'
        break
      case 'Delivered':
        cancelBlockedReason = 'Delivered orders can no longer be cancelled here.'
        break
      default:
        cancelBlockedReason = 'This order cannot be cancelled from your account.'
        break
    }
  }

  return {
    canCancel,
    cancelBlockedReason,
    needsRefundFollowUp,
  }
}

export function getInventoryAvailability(
  stock: number,
  reorderPoint: number,
  isArchived = false,
): InventoryAvailability {
  if (isArchived || stock <= 0) {
    return 'Out of Stock'
  }

  if (stock <= reorderPoint) {
    return 'Low Stock'
  }

  return 'In Stock'
}

function syncCatalogStock(catalog: Product[], inventory: InventoryRecord[]) {
  const inventoryMap = new Map(inventory.map((record) => [record.productId, record]))

  return catalog.map((product) => ({
    ...product,
    inStock: Boolean(
      inventoryMap.get(product.id) &&
        !inventoryMap.get(product.id)?.isArchived &&
        (inventoryMap.get(product.id)?.stock ?? 0) > 0,
    ),
  }))
}

function createInventoryRecord(
  product: Product,
  index: number,
  stock = SEEDED_STOCK_LEVELS[product.id] ?? (product.inStock ? 12 : 0),
  reorderPoint = stock > 0 ? Math.min(6, Math.max(2, stock - 4)) : 3,
  location = DEFAULT_LOCATIONS[index % DEFAULT_LOCATIONS.length],
): InventoryRecord {
  return {
    productId: product.id,
    sku: createSku(product, index),
    stock: clampToWholeNumber(stock),
    reorderPoint: clampToWholeNumber(reorderPoint),
    overStockThreshold: DEFAULT_OVERSTOCK_THRESHOLD,
    location,
    lastUpdated: new Date().toISOString(),
    lastUpdatedBy: undefined,
    isArchived: false,
  }
}

function ensureInventoryRecords(catalog: Product[], existingInventory: InventoryRecord[]) {
  const inventoryMap = new Map(existingInventory.map((record) => [record.productId, record]))

  return catalog.map((product, index) => {
    const existing = inventoryMap.get(product.id)
    if (!existing) {
      return createInventoryRecord(product, index)
    }

    return {
      ...existing,
      sku: existing.sku || createSku(product, index),
      location: existing.location || DEFAULT_LOCATIONS[index % DEFAULT_LOCATIONS.length],
      stock: clampToWholeNumber(existing.stock),
      reorderPoint: clampToWholeNumber(existing.reorderPoint || 0),
      overStockThreshold: existing.overStockThreshold ?? DEFAULT_OVERSTOCK_THRESHOLD,
      lastUpdated: existing.lastUpdated || new Date().toISOString(),
      lastUpdatedBy: existing.lastUpdatedBy,
      isArchived: existing.isArchived ?? false,
      archivedAt: existing.isArchived ? existing.archivedAt : undefined,
      archivedBy: existing.isArchived ? existing.archivedBy : undefined,
    }
  })
}

export function ensureInventoryRecordsForCatalog(
  catalog: Product[],
  existingInventory: InventoryRecord[],
) {
  return ensureInventoryRecords(catalog, existingInventory)
}

function normalizeCart(cart: CartItem[] | undefined, catalog: Product[]) {
  if (!Array.isArray(cart)) {
    return []
  }

  const productIds = new Set(catalog.map((product) => product.id))

  return cart
    .filter(
      (item) =>
        productIds.has(item.productId) &&
        clampToWholeNumber(item.quantity) > 0 &&
        clampToWholeNumber(item.size) > 0,
    )
    .map((item) => ({
      ...item,
      quantity: clampToWholeNumber(item.quantity),
      size: clampToWholeNumber(item.size),
      unitPrice: roundCurrency(item.unitPrice),
    }))
}

export function isPaymentTestCart(items: CartItem[]) {
  return items.length > 0 && items.every((item) => item.productId === PAYMENT_TEST_PRODUCT_ID)
}

function calculateTotals(items: CartItem[], source: OrderSource) {
  const isTestCart = isPaymentTestCart(items)
  const subtotal = roundCurrency(items.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0))
  const shipping =
    !isTestCart && source === 'ONLINE' && subtotal < FREE_SHIPPING_THRESHOLD
      ? STANDARD_SHIPPING_FEE
      : 0
  // Standard Philippine BIR 12% VAT-inclusive breakdown:
  // Retail perfume price is already VAT-inclusive.
  const vatableSales = isTestCart ? 0 : roundCurrency(subtotal / 1.12)
  const tax = isTestCart ? 0 : roundCurrency(subtotal - vatableSales)
  const total = roundCurrency(subtotal + shipping)

  return { subtotal, shipping, tax, total }
}

export function createSampleState(catalog: Product[] = products): StoreState {
  const catalogById = new Map(catalog.map((product) => [product.id, product]))
  const inventory = ensureInventoryRecords(catalog, [])

  const createOrderItem = (productId: string, size: number, quantity: number) => {
    const product = catalogById.get(productId)
    const unitPrice =
      product?.sizes.find((variant) => variant.ml === size)?.price ?? product?.price ?? 0

    return {
      productId,
      productName: product?.name ?? 'Unknown Product',
      size,
      quantity,
      unitPrice,
    }
  }

  const onlineOrders: OrderRecord[] = [
    {
      id: 'WEB-240401-1051',
      source: 'ONLINE',
      customerName: 'Demo User',
      customerEmail: DEMO_USER_EMAIL,
      status: 'Processing',
      paymentMethod: 'PayMongo',
      paymentStatus: 'Paid',
      createdAt: isoFromNow(0, -5),
      subtotal: 460,
      shipping: 0,
      tax: 55.2,
      total: 515.2,
      shippingAddress: '221B Orchard Heights, Makati City',
      notes: 'Customer requested gift wrapping.',
      items: [createOrderItem('2', 75, 1), createOrderItem('3', 50, 1)],
      timeline: [
        {
          status: 'Pending',
          createdAt: isoFromNow(0, -5),
          note: 'Order placed through the website.',
        },
        {
          status: 'Processing',
          createdAt: isoFromNow(0, -4),
          note: 'Picking and packing has started.',
        },
      ],
    },
    {
      id: 'WEB-240330-1052',
      source: 'ONLINE',
      customerName: 'Sarah Davis',
      customerEmail: 'sarah.davis@example.com',
      status: 'Out for Delivery',
      paymentMethod: 'Card',
      paymentStatus: 'Paid',
      createdAt: isoFromNow(-2, -1),
      subtotal: 235,
      shipping: 75,
      tax: 28.2,
      total: 338.2,
      shippingAddress: '17 Emerald Park, BGC, Taguig',
      items: [createOrderItem('5', 50, 1)],
      timeline: [
        { status: 'Pending', createdAt: isoFromNow(-2, -1), note: 'Order placed through the website.' },
        { status: 'Processing', createdAt: isoFromNow(-2), note: 'Store team confirmed stock allocation.' },
        {
          status: 'Shipped',
          createdAt: isoFromNow(-1, -6),
          note: 'Packed and turned over to courier.',
        },
        {
          status: 'Out for Delivery',
          createdAt: isoFromNow(0, -8),
          note: 'Courier is en route to the customer.',
        },
      ],
    },
    {
      id: 'WEB-240327-1053',
      source: 'ONLINE',
      customerName: 'Lisa Anderson',
      customerEmail: 'lisa.anderson@example.com',
      status: 'Delivered',
      paymentMethod: 'PayPal',
      paymentStatus: 'Paid',
      createdAt: isoFromNow(-5, -2),
      subtotal: 185,
      shipping: 75,
      tax: 22.2,
      total: 282.2,
      shippingAddress: '84 Palm Residences, Cebu City',
      items: [createOrderItem('1', 30, 1)],
      timeline: [
        { status: 'Pending', createdAt: isoFromNow(-5, -2), note: 'Order placed through the website.' },
        { status: 'Processing', createdAt: isoFromNow(-5, -1), note: 'Store team confirmed stock allocation.' },
        {
          status: 'Shipped',
          createdAt: isoFromNow(-4, -6),
          note: 'Packed and handed over to courier.',
        },
        {
          status: 'Out for Delivery',
          createdAt: isoFromNow(-4, -1),
          note: 'Courier is en route to the customer.',
        },
        {
          status: 'Delivered',
          createdAt: isoFromNow(-3, -7),
          note: 'Customer confirmed delivery.',
        },
      ],
    },
  ]

  const posOrders: OrderRecord[] = [
    {
      id: 'POS-240401-2051',
      source: 'POS',
      customerName: 'Walk-in Customer',
      customerEmail: 'walk-in@sprayandsniff.local',
      status: 'Completed',
      paymentMethod: 'Cash',
      paymentStatus: 'Paid',
      createdAt: isoFromNow(0, -3),
      subtotal: 430,
      shipping: 0,
      tax: 51.6,
      total: 481.6,
      notes: 'Same-day in-store checkout.',
      items: [createOrderItem('4', 100, 2)],
      timeline: [
        { status: 'Completed', createdAt: isoFromNow(0, -3), note: 'Point-of-sale transaction completed in store.' },
      ],
    },
    {
      id: 'POS-240331-2052',
      source: 'POS',
      customerName: 'Member Sale',
      customerEmail: 'member@sprayandsniff.local',
      status: 'Completed',
      paymentMethod: 'Card',
      paymentStatus: 'Paid',
      createdAt: isoFromNow(-1, -5),
      subtotal: 380,
      shipping: 0,
      tax: 45.6,
      total: 425.6,
      notes: 'Cross-sell bundle at the cashier desk.',
      items: [createOrderItem('7', 30, 1), createOrderItem('5', 30, 1)],
      timeline: [
        { status: 'Completed', createdAt: isoFromNow(-1, -5), note: 'POS transaction completed in store.' },
      ],
    },
  ]

  const posTransactions: PosTransaction[] = [
    {
      id: 'TX-240401-3001',
      orderId: 'POS-240401-2051',
      cashierName: 'Store Staff',
      paymentMethod: 'Cash',
      createdAt: isoFromNow(0, -3),
      subtotal: 430,
      tax: 51.6,
      total: 481.6,
      itemsCount: 2,
    },
    {
      id: 'TX-240331-3002',
      orderId: 'POS-240331-2052',
      cashierName: 'Store Staff',
      paymentMethod: 'Card',
      createdAt: isoFromNow(-1, -5),
      subtotal: 380,
      tax: 45.6,
      total: 425.6,
      itemsCount: 2,
    },
  ]

  const stockMovements: StockMovement[] = [
    {
      id: 'MVT-240401-01',
      productId: '2',
      productName: catalogById.get('2')?.name ?? 'Dawn Light',
      change: -1,
      reason: 'online-sale',
      actor: 'Web checkout',
      createdAt: isoFromNow(0, -5),
      resultingStock: 9,
      note: 'Order WEB-240401-1051',
    },
    {
      id: 'MVT-240401-02',
      productId: '3',
      productName: catalogById.get('3')?.name ?? 'Velvet Spice',
      change: -1,
      reason: 'online-sale',
      actor: 'Web checkout',
      createdAt: isoFromNow(0, -5),
      resultingStock: 14,
      note: 'Order WEB-240401-1051',
    },
    {
      id: 'MVT-240401-03',
      productId: '4',
      productName: catalogById.get('4')?.name ?? 'Ocean Breeze',
      change: -2,
      reason: 'pos-sale',
      actor: 'Store Staff',
      createdAt: isoFromNow(0, -3),
      resultingStock: 4,
      note: 'POS-240401-2051',
    },
    {
      id: 'MVT-240401-04',
      productId: '7',
      productName: catalogById.get('7')?.name ?? 'Silk Dreams',
      change: -1,
      reason: 'pos-sale',
      actor: 'Store Staff',
      createdAt: isoFromNow(-1, -5),
      resultingStock: 2,
      note: 'POS-240331-2052',
    },
    {
      id: 'MVT-240331-05',
      productId: '5',
      productName: catalogById.get('5')?.name ?? 'Golden Hour',
      change: -1,
      reason: 'pos-sale',
      actor: 'Store Staff',
      createdAt: isoFromNow(-1, -5),
      resultingStock: 11,
      note: 'POS-240331-2052',
    },
    {
      id: 'MVT-240330-06',
      productId: '4',
      productName: catalogById.get('4')?.name ?? 'Ocean Breeze',
      change: 6,
      reason: 'restock',
      actor: 'Store Admin',
      createdAt: isoFromNow(-2, -6),
      resultingStock: 6,
      note: 'Emergency refill for low stock line.',
    },
    {
      id: 'MVT-240329-07',
      productId: '8',
      productName: catalogById.get('8')?.name ?? 'Stone & Steel',
      change: -3,
      reason: 'online-sale',
      actor: 'Web checkout',
      createdAt: isoFromNow(-3, -4),
      resultingStock: 0,
      note: 'Stock depleted after weekend promo.',
    },
    {
      id: 'MVT-240328-08',
      productId: '7',
      productName: catalogById.get('7')?.name ?? 'Silk Dreams',
      change: 4,
      reason: 'manual-adjustment',
      actor: 'Store Admin',
      createdAt: isoFromNow(-4, -8),
      resultingStock: 3,
      note: 'Cycle count correction after shelf audit.',
    },
  ]

  return {
    catalog: syncCatalogStock(catalog, inventory),
    inventory,
    cart: [],
    orders: [...onlineOrders, ...posOrders].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    ),
    posTransactions: posTransactions.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    ),
    stockMovements: stockMovements.sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    ),
  }
}

export function normalizeState(storedState: Partial<StoreState> | null, currentCatalog: Product[] = products) {
  const hasStoredCatalog = Array.isArray(storedState?.catalog)
  const baseCatalog = hasStoredCatalog
    ? storedState?.catalog ?? []
    : currentCatalog.length > 0
      ? currentCatalog
      : products
  const canonicalPaymentTestProduct = currentCatalog.find(
    (product) => product.id === PAYMENT_TEST_PRODUCT_ID,
  )
  const catalogWithoutTestProduct = baseCatalog.filter(
    (product) => product.id !== PAYMENT_TEST_PRODUCT_ID,
  )
  const catalogSource =
    canonicalPaymentTestProduct
      ? [canonicalPaymentTestProduct, ...catalogWithoutTestProduct]
      : baseCatalog

  const seedState = createSampleState(catalogSource)
  const inventory = hasStoredCatalog
    ? ensureInventoryRecords(catalogSource, storedState?.inventory ?? [])
    : ensureInventoryRecords(catalogSource, storedState?.inventory ?? seedState.inventory)
  const orders =
    storedState?.orders && storedState.orders.length > 0 ? storedState.orders : seedState.orders
  const posTransactions =
    storedState?.posTransactions && storedState.posTransactions.length > 0
      ? storedState.posTransactions
      : seedState.posTransactions
  const ordersById = new Map(orders.map((order) => [order.id, order]))

  posTransactions.forEach((transaction) => {
    if (ordersById.has(transaction.orderId)) {
      return
    }

    const seededOrder = seedState.orders.find((order) => order.id === transaction.orderId)
    if (seededOrder) {
      ordersById.set(seededOrder.id, seededOrder)
    }
  })

  return {
    catalog: syncCatalogStock(catalogSource, inventory),
    inventory,
    cart: normalizeCart(storedState?.cart, catalogSource),
    orders: [...ordersById.values()].sort(
      (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    ),
    posTransactions,
    stockMovements:
      storedState?.stockMovements && storedState.stockMovements.length > 0
        ? storedState.stockMovements
        : seedState.stockMovements,
  }
}

function createOrderId(source: OrderSource) {
  const prefix = source === 'POS' ? 'POS' : 'WEB'
  return `${prefix}-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function createTransactionId() {
  return `TX-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function createMovementId() {
  return `MVT-${Date.now().toString().slice(-8)}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

export function getProductByIdFromState(state: StoreState, productId: string) {
  return state.catalog.find((product) => product.id === productId)
}

export function getInventoryRecordFromState(state: StoreState, productId: string) {
  return state.inventory.find((record) => record.productId === productId)
}

export function getAvailableStockFromState(state: StoreState, productId: string) {
  return getInventoryRecordFromState(state, productId)?.isArchived
    ? 0
    : getInventoryRecordFromState(state, productId)?.stock ?? 0
}

export function getAvailabilityStatusFromState(state: StoreState, productId: string): InventoryAvailability {
  const record = getInventoryRecordFromState(state, productId)
  if (!record) {
    return 'Out of Stock'
  }

  return getInventoryAvailability(record.stock, record.reorderPoint, record.isArchived)
}

export function performStoreAction(
  currentState: StoreState,
  action: StoreAction,
  actor?: StoreActor | null,
): StoreMutationResponse<any> {
  const getProductById = (productId: string) => getProductByIdFromState(currentState, productId)
  const getInventoryRecord = (productId: string) => getInventoryRecordFromState(currentState, productId)
  const getAvailableStock = (productId: string) => getAvailableStockFromState(currentState, productId)

  switch (action.type) {
    case 'addCatalogProduct': {
      if (!hasRole(actor, 'ADMIN')) {
        return { nextState: currentState, result: { ok: false, message: 'Only admins can add products to the catalog.' } }
      }

      if (currentState.catalog.some((item) => item.id === action.product.id)) {
        return { nextState: currentState, result: { ok: false, message: 'A product with this identifier already exists.' } }
      }

      const nextCatalog = [action.product, ...currentState.catalog]
      const nextInventory = ensureInventoryRecords(nextCatalog, [
        {
          productId: action.product.id,
          sku: createSku(action.product, 0),
          stock: clampToWholeNumber(action.options?.initialStock ?? (action.product.inStock ? 12 : 0)),
          reorderPoint: clampToWholeNumber(action.options?.reorderPoint ?? 3),
          location: action.options?.location || DEFAULT_LOCATIONS[0],
          lastUpdated: new Date().toISOString(),
          lastUpdatedBy: action.options?.actor || getActorName(actor, 'Store Admin'),
          isArchived: false,
        },
        ...currentState.inventory,
      ])

      return {
        nextState: {
          ...currentState,
          catalog: syncCatalogStock(nextCatalog, nextInventory),
          inventory: nextInventory,
        },
        result: {
          ok: true,
          message: `${action.product.name} was added to the catalog.`,
          data: action.product,
        },
      }
    }

    case 'updateCatalogProduct': {
      if (!hasRole(actor, 'ADMIN')) {
        return { nextState: currentState, result: { ok: false, message: 'Only admins can edit products in the catalog.' } }
      }

      const existingProduct = currentState.catalog.find((item) => item.id === action.productId)
      if (!existingProduct) {
        return { nextState: currentState, result: { ok: false, message: 'Product not found.' } }
      }

      if (action.product.id !== action.productId) {
        return { nextState: currentState, result: { ok: false, message: 'Product identifiers cannot be changed.' } }
      }

      const timestamp = new Date().toISOString()
      const existingPriceHistory = existingProduct.priceHistory || []
      const priceHistory = [...existingPriceHistory]

      if (existingProduct.price !== action.product.price) {
        priceHistory.unshift({
          id: `ph_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          oldPrice: existingProduct.price,
          newPrice: action.product.price,
          effectiveDate: timestamp,
          changedAt: timestamp,
          changedBy: action.options.actor || getActorName(actor, 'Store Admin'),
          note: `Price changed from ₱${existingProduct.price} to ₱${action.product.price}. Historical orders retain original purchase prices.`,
        })
      }

      const updatedProduct: Product = {
        ...action.product,
        priceHistory,
        inStock: clampToWholeNumber(action.options.stock) > 0,
      }
      const existingInventoryRecord = currentState.inventory.find((record) => record.productId === action.productId)
      const nextCatalog = currentState.catalog.map((item) => (item.id === action.productId ? updatedProduct : item))

      const updatedInventoryRecord: InventoryRecord = existingInventoryRecord
        ? {
            ...existingInventoryRecord,
            stock: clampToWholeNumber(action.options.stock),
            reorderPoint:
              typeof action.options.reorderPoint === 'number'
                ? clampToWholeNumber(action.options.reorderPoint)
                : existingInventoryRecord.reorderPoint,
            overStockThreshold:
              typeof action.options.overStockThreshold === 'number'
                ? clampToWholeNumber(action.options.overStockThreshold)
                : (existingInventoryRecord.overStockThreshold ?? DEFAULT_OVERSTOCK_THRESHOLD),
            location: action.options.location || existingInventoryRecord.location,
            lastUpdated: timestamp,
            lastUpdatedBy: action.options.actor || getActorName(actor, 'Store Admin'),
          }
        : {
            productId: action.productId,
            sku: createSku(updatedProduct, 0),
            stock: clampToWholeNumber(action.options.stock),
            reorderPoint: clampToWholeNumber(action.options.reorderPoint ?? 3),
            overStockThreshold: clampToWholeNumber(action.options.overStockThreshold ?? DEFAULT_OVERSTOCK_THRESHOLD),
            location: action.options.location || DEFAULT_LOCATIONS[0],
            lastUpdated: timestamp,
            lastUpdatedBy: action.options.actor || getActorName(actor, 'Store Admin'),
            isArchived: false,
          }

      const nextInventory = existingInventoryRecord
        ? currentState.inventory.map((record) =>
            record.productId === action.productId ? updatedInventoryRecord : record,
          )
        : ensureInventoryRecords(nextCatalog, [updatedInventoryRecord, ...currentState.inventory])

      return {
        nextState: {
          ...currentState,
          catalog: syncCatalogStock(nextCatalog, nextInventory),
          inventory: nextInventory,
        },
        result: {
          ok: true,
          message: `${updatedProduct.name} was updated successfully.`,
          data: updatedProduct,
        },
      }
    }

    case 'removeCatalogProduct': {
      if (!hasRole(actor, 'ADMIN')) {
        return { nextState: currentState, result: { ok: false, message: 'Only admins can remove products from the catalog.' } }
      }

      const product = currentState.catalog.find((item) => item.id === action.productId)
      if (!product) {
        return { nextState: currentState, result: { ok: false, message: 'Product not found.' } }
      }

      const nextCatalog = currentState.catalog.filter((item) => item.id !== action.productId)
      const nextInventory = currentState.inventory.filter((record) => record.productId !== action.productId)
      const nextCart = currentState.cart.filter((item) => item.productId !== action.productId)

      return {
        nextState: {
          ...currentState,
          catalog: syncCatalogStock(nextCatalog, nextInventory),
          inventory: nextInventory,
          cart: nextCart,
        },
        result: { ok: true, message: `${product.name} was removed from the catalog.` },
      }
    }

    case 'updateInventory': {
      if (!canAccessBackoffice(actor)) {
        return { nextState: currentState, result: { ok: false, message: 'Only staff and admins can update inventory.' } }
      }

      const product = currentState.catalog.find((item) => item.id === action.input.productId)
      if (!product) {
        return { nextState: currentState, result: { ok: false, message: 'Unable to update inventory for an unknown product.' } }
      }

      const existingRecord = getInventoryRecord(action.input.productId)
      if (!existingRecord) {
        return { nextState: currentState, result: { ok: false, message: 'Inventory record not found.' } }
      }

      if (existingRecord.isArchived) {
        return { nextState: currentState, result: { ok: false, message: `${product.name} is archived. Restore it before editing inventory.` } }
      }

      const previousStock = existingRecord.stock
      const nextRecord: InventoryRecord = {
        ...existingRecord,
        stock: clampToWholeNumber(action.input.stock),
        reorderPoint:
          typeof action.input.reorderPoint === 'number'
            ? clampToWholeNumber(action.input.reorderPoint)
            : existingRecord.reorderPoint,
        overStockThreshold:
          typeof action.input.overStockThreshold === 'number'
            ? clampToWholeNumber(action.input.overStockThreshold)
            : (existingRecord.overStockThreshold ?? DEFAULT_OVERSTOCK_THRESHOLD),
        location: action.input.location || existingRecord.location,
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: action.input.actor || getActorName(actor, 'Inventory update'),
      }

      const nextInventory = currentState.inventory.map((record) =>
        record.productId === action.input.productId ? nextRecord : record,
      )
      const difference = nextRecord.stock - previousStock
      const movementReason: StockMovementReason = difference > 0 ? 'restock' : 'manual-adjustment'
      const nextMovements =
        difference === 0
          ? currentState.stockMovements
          : [
              {
                id: createMovementId(),
                productId: product.id,
                productName: product.name,
                change: difference,
                reason: movementReason,
                actor: action.input.actor || getActorName(actor, 'Inventory update'),
                createdAt: new Date().toISOString(),
                resultingStock: nextRecord.stock,
                note: action.input.note,
              },
              ...currentState.stockMovements,
            ]

      return {
        nextState: {
          ...currentState,
          catalog: syncCatalogStock(currentState.catalog, nextInventory),
          inventory: nextInventory,
          stockMovements: nextMovements,
        },
        result: { ok: true, message: `${product.name} inventory was updated.`, data: nextRecord },
      }
    }

    case 'adjustInventory': {
      if (!canAccessBackoffice(actor)) {
        return { nextState: currentState, result: { ok: false, message: 'Only staff and admins can adjust inventory.' } }
      }

      const product = currentState.catalog.find((item) => item.id === action.input.productId)
      if (!product) {
        return { nextState: currentState, result: { ok: false, message: 'Unable to adjust inventory for an unknown product.' } }
      }

      const existingRecord = getInventoryRecord(action.input.productId)
      if (!existingRecord) {
        return { nextState: currentState, result: { ok: false, message: 'Inventory record not found.' } }
      }

      if (existingRecord.isArchived) {
        return { nextState: currentState, result: { ok: false, message: `${product.name} is archived. Restore it before adding stock.` } }
      }

      const delta = Math.round(action.input.delta)
      const nextStock = clampToWholeNumber(existingRecord.stock + delta)
      const appliedChange = nextStock - existingRecord.stock
      if (appliedChange === 0 && !action.input.location) {
        return { nextState: currentState, result: { ok: false, message: 'No inventory change was applied.' } }
      }

      const timestamp = new Date().toISOString()
      const nextRecord: InventoryRecord = {
        ...existingRecord,
        stock: nextStock,
        location: action.input.location || existingRecord.location,
        lastUpdated: timestamp,
        lastUpdatedBy: action.input.actor,
      }
      const nextInventory = currentState.inventory.map((record) =>
        record.productId === action.input.productId ? nextRecord : record,
      )
      const movementReason: StockMovementReason = appliedChange > 0 ? 'restock' : 'manual-adjustment'
      const nextMovements =
        appliedChange === 0
          ? currentState.stockMovements
          : [
              {
                id: createMovementId(),
                productId: product.id,
                productName: product.name,
                change: appliedChange,
                reason: movementReason,
                actor: action.input.actor,
                createdAt: timestamp,
                resultingStock: nextRecord.stock,
                note: action.input.note,
              },
              ...currentState.stockMovements,
            ]

      return {
        nextState: {
          ...currentState,
          catalog: syncCatalogStock(currentState.catalog, nextInventory),
          inventory: nextInventory,
          stockMovements: nextMovements,
        },
        result: {
          ok: true,
          message:
            appliedChange > 0
              ? `${product.name} was restocked by ${appliedChange} unit(s).`
              : `${product.name} inventory was adjusted.`,
          data: nextRecord,
        },
      }
    }

    case 'archiveInventoryItem': {
      if (!canAccessBackoffice(actor)) {
        return { nextState: currentState, result: { ok: false, message: 'Only staff and admins can archive inventory.' } }
      }

      const product = currentState.catalog.find((item) => item.id === action.input.productId)
      if (!product) {
        return { nextState: currentState, result: { ok: false, message: 'Product not found.' } }
      }

      const existingRecord = getInventoryRecord(action.input.productId)
      if (!existingRecord) {
        return { nextState: currentState, result: { ok: false, message: 'Inventory record not found.' } }
      }

      if (existingRecord.isArchived) {
        return { nextState: currentState, result: { ok: false, message: `${product.name} is already archived.` } }
      }

      const timestamp = new Date().toISOString()
      const nextRecord: InventoryRecord = {
        ...existingRecord,
        isArchived: true,
        archivedAt: timestamp,
        archivedBy: action.input.actor,
        lastUpdated: timestamp,
        lastUpdatedBy: action.input.actor,
      }
      const nextInventory = currentState.inventory.map((record) =>
        record.productId === action.input.productId ? nextRecord : record,
      )

      return {
        nextState: {
          ...currentState,
          catalog: syncCatalogStock(currentState.catalog, nextInventory),
          inventory: nextInventory,
          cart: currentState.cart.filter((item) => item.productId !== action.input.productId),
        },
        result: {
          ok: true,
          message: action.input.note
            ? `${product.name} was archived. ${action.input.note}`
            : `${product.name} was archived from active inventory.`,
          data: nextRecord,
        },
      }
    }

    case 'restoreInventoryItem': {
      if (!canAccessBackoffice(actor)) {
        return { nextState: currentState, result: { ok: false, message: 'Only staff and admins can restore inventory.' } }
      }

      const product = currentState.catalog.find((item) => item.id === action.input.productId)
      if (!product) {
        return { nextState: currentState, result: { ok: false, message: 'Product not found.' } }
      }

      const existingRecord = getInventoryRecord(action.input.productId)
      if (!existingRecord) {
        return { nextState: currentState, result: { ok: false, message: 'Inventory record not found.' } }
      }

      if (!existingRecord.isArchived) {
        return { nextState: currentState, result: { ok: false, message: `${product.name} is already active in inventory.` } }
      }

      const nextRecord: InventoryRecord = {
        ...existingRecord,
        isArchived: false,
        archivedAt: undefined,
        archivedBy: undefined,
        lastUpdated: new Date().toISOString(),
        lastUpdatedBy: action.input.actor,
      }
      const nextInventory = currentState.inventory.map((record) =>
        record.productId === action.input.productId ? nextRecord : record,
      )

      return {
        nextState: {
          ...currentState,
          catalog: syncCatalogStock(currentState.catalog, nextInventory),
          inventory: nextInventory,
        },
        result: {
          ok: true,
          message: `${product.name} was restored to active inventory.`,
          data: nextRecord,
        },
      }
    }

    case 'addToCart': {
      if (!actor || (actor.role !== 'USER' && actor.role !== 'ADMIN' && actor.role !== 'STAFF')) {
        return { nextState: currentState, result: { ok: false, message: 'Sign in or create an account before adding items to your cart.' } }
      }

      const product = getProductById(action.item.productId)
      const record = getInventoryRecord(action.item.productId)
      if (!product) {
        return { nextState: currentState, result: { ok: false, message: 'Product no longer exists.' } }
      }

      if (!record || record.isArchived) {
        return { nextState: currentState, result: { ok: false, message: `${product.name} is no longer available for sale.` } }
      }

      const availableStock = getAvailableStock(action.item.productId)
      if (availableStock <= 0) {
        return { nextState: currentState, result: { ok: false, message: `${product.name} is currently out of stock.` } }
      }

      const nextQuantity = clampToWholeNumber(action.item.quantity)
      if (nextQuantity === 0) {
        return { nextState: currentState, result: { ok: false, message: 'Quantity must be at least 1.' } }
      }

      const existingItem = currentState.cart.find(
        (cartItem) => cartItem.productId === action.item.productId && cartItem.size === action.item.size,
      )
      const totalQuantityForProduct = currentState.cart
        .filter((cartItem) => cartItem.productId === action.item.productId)
        .reduce((sum, cartItem) => sum + cartItem.quantity, 0)

      if (totalQuantityForProduct + nextQuantity > availableStock) {
        return {
          nextState: currentState,
          result: { ok: false, message: `Only ${availableStock} unit(s) of ${product.name} are available.` },
        }
      }

      const nextCart = existingItem
        ? currentState.cart.map((cartItem) =>
            cartItem.productId === action.item.productId && cartItem.size === action.item.size
              ? { ...cartItem, quantity: cartItem.quantity + nextQuantity }
              : cartItem,
          )
        : [...currentState.cart, { ...action.item, quantity: nextQuantity }]

      return {
        nextState: { ...currentState, cart: nextCart },
        result: { ok: true, message: `${product.name} was added to the cart.`, data: action.item },
      }
    }

    case 'updateCartQuantity': {
      if (!canShop(actor)) {
        return { nextState: currentState, result: { ok: false, message: 'Sign in or create an account before updating your cart.' } }
      }

      const product = getProductById(action.productId)
      const record = getInventoryRecord(action.productId)
      if (!product) {
        return { nextState: currentState, result: { ok: false, message: 'Product no longer exists.' } }
      }

      if (!record || record.isArchived) {
        return { nextState: currentState, result: { ok: false, message: `${product.name} is no longer available for sale.` } }
      }

      if (action.quantity <= 0) {
        return {
          nextState: {
            ...currentState,
            cart: currentState.cart.filter(
              (item) => !(item.productId === action.productId && item.size === action.size),
            ),
          },
          result: { ok: true, message: `${product.name} was removed from the cart.` },
        }
      }

      const availableStock = getAvailableStock(action.productId)
      const quantityForOtherSizes = currentState.cart
        .filter((item) => item.productId === action.productId && item.size !== action.size)
        .reduce((sum, item) => sum + item.quantity, 0)

      if (quantityForOtherSizes + action.quantity > availableStock) {
        return {
          nextState: currentState,
          result: { ok: false, message: `Only ${availableStock} unit(s) of ${product.name} are available.` },
        }
      }

      return {
        nextState: {
          ...currentState,
          cart: currentState.cart.map((item) =>
            item.productId === action.productId && item.size === action.size
              ? { ...item, quantity: clampToWholeNumber(action.quantity) }
              : item,
          ),
        },
        result: { ok: true, message: `${product.name} quantity updated.` },
      }
    }

    case 'removeFromCart': {
      if (!canShop(actor)) {
        return { nextState: currentState, result: { ok: false, message: 'Sign in or create an account before updating your cart.' } }
      }

      return {
        nextState: {
          ...currentState,
          cart: currentState.cart.filter(
            (item) => !(item.productId === action.productId && item.size === action.size),
          ),
        },
        result: { ok: true, message: 'Item removed from the cart.' },
      }
    }

    case 'clearCart': {
      if (!canShop(actor)) {
        return { nextState: currentState, result: { ok: false, message: 'Sign in or create an account before updating your cart.' } }
      }

      return { nextState: { ...currentState, cart: [] }, result: { ok: true, message: 'Cart cleared.' } }
    }

    case 'placeOnlineOrder': {
      if (!canShop(actor)) {
        return { nextState: currentState, result: { ok: false, message: 'Sign in before placing an order.' } }
      }

      const activeCart =
        Array.isArray(action.input.items) && action.input.items.length > 0
          ? action.input.items
          : currentState.cart.length > 0
            ? currentState.cart
            : []

      if (activeCart.length === 0) {
        return { nextState: currentState, result: { ok: false, message: 'Add items to the cart before placing an order.' } }
      }

      const remainingCart = currentState.cart.filter(
        (cartItem) =>
          !activeCart.some(
            (checkedItem) =>
              checkedItem.productId === cartItem.productId && checkedItem.size === cartItem.size,
          ),
      )

      const inventoryMap = new Map(currentState.inventory.map((record) => [record.productId, record]))
      const quantityByProduct = activeCart.reduce<Record<string, number>>((totals, item) => {
        totals[item.productId] = (totals[item.productId] ?? 0) + item.quantity
        return totals
      }, {})

      for (const [productId, requestedQuantity] of Object.entries(quantityByProduct)) {
        const product = getProductById(productId)
        const record = inventoryMap.get(productId)
        const availableStock = record?.isArchived ? 0 : record?.stock ?? 0

        if (!product || !record || record.isArchived) {
          return {
            nextState: currentState,
            result: { ok: false, message: `${product?.name ?? 'An item'} is no longer available for checkout.` },
          }
        }

        if (availableStock < requestedQuantity) {
          return {
            nextState: currentState,
            result: { ok: false, message: `${product?.name ?? 'An item'} does not have enough stock to complete checkout.` },
          }
        }
      }

      const timestamp = new Date().toISOString()
      const orderItems: OrderLineItem[] = activeCart.map((item) => {
        const product = getProductById(item.productId)
        return {
          productId: item.productId,
          productName: product?.name ?? 'Unknown Product',
          size: item.size,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          image: product?.images?.[0] || '',
        }
      })
      const totals = calculateTotals(activeCart, 'ONLINE')
      const nextInventory = currentState.inventory.map((record) => {
        const soldQuantity = quantityByProduct[record.productId]
        if (!soldQuantity) {
          return record
        }

        return { ...record, stock: clampToWholeNumber(record.stock - soldQuantity), lastUpdated: timestamp }
      })

      const nextOrder: OrderRecord = {
        id: createOrderId('ONLINE'),
        source: 'ONLINE',
        customerId: actor?.id ?? null,
        customerName: action.input.customerName,
        customerEmail: action.input.customerEmail.trim().toLowerCase(),
        status: 'Processing',
        paymentMethod: action.input.paymentMethod,
        paymentStatus: action.input.paymentMethod === 'Cash on Delivery' ? 'Pending' : 'Paid',
        createdAt: timestamp,
        subtotal: totals.subtotal,
        shipping: totals.shipping,
        tax: totals.tax,
        total: totals.total,
        shippingAddress: action.input.shippingAddress,
        notes: action.input.notes,
        items: orderItems,
        timeline: [
          { status: 'Pending', createdAt: timestamp, note: 'Order placed successfully.' },
          { status: 'Processing', createdAt: timestamp, note: 'Inventory allocated and ready for fulfillment.' },
        ],
      }

      const nextMovements = [
        ...orderItems.map((item) => ({
          id: createMovementId(),
          productId: item.productId,
          productName: item.productName,
          change: -item.quantity,
          reason: 'online-sale' as const,
          actor: 'Web checkout',
          createdAt: timestamp,
          resultingStock: nextInventory.find((record) => record.productId === item.productId)?.stock ?? 0,
          note: nextOrder.id,
        })),
        ...currentState.stockMovements,
      ]

      return {
        nextState: {
          ...currentState,
          catalog: syncCatalogStock(currentState.catalog, nextInventory),
          inventory: nextInventory,
          cart: remainingCart,
          orders: [nextOrder, ...currentState.orders],
          stockMovements: nextMovements,
        },
        result: { ok: true, message: 'Order placed successfully.', data: nextOrder },
      }
    }

    case 'createPosSale': {
      if (!canAccessBackoffice(actor)) {
        return { nextState: currentState, result: { ok: false, message: 'Only staff and admins can process POS sales.' } }
      }

      if (action.input.items.length === 0) {
        return { nextState: currentState, result: { ok: false, message: 'Add at least one item to process a POS sale.' } }
      }

      if (action.input.clientSaleId) {
        const existingOrder = currentState.orders.find(
          (order) =>
            order.source === 'POS' &&
            order.notes?.includes(`[POS-REF:${action.input.clientSaleId}]`),
        )
        if (existingOrder) {
          return {
            nextState: currentState,
            result: { ok: true, message: 'POS sale already processed.', data: existingOrder },
          }
        }
      }

      const inventoryMap = new Map(currentState.inventory.map((record) => [record.productId, record]))
      const quantityByProduct = action.input.items.reduce<Record<string, number>>((totals, item) => {
        totals[item.productId] = (totals[item.productId] ?? 0) + item.quantity
        return totals
      }, {})

      for (const [productId, requestedQuantity] of Object.entries(quantityByProduct)) {
        const product = getProductById(productId)
        const record = inventoryMap.get(productId)
        const availableStock = record?.isArchived ? 0 : record?.stock ?? 0

        if (!product || !record || record.isArchived) {
          return {
            nextState: currentState,
            result: { ok: false, message: `${product?.name ?? 'An item'} is no longer available for this sale.` },
          }
        }

        if (availableStock < requestedQuantity) {
          return {
            nextState: currentState,
            result: { ok: false, message: `${product?.name ?? 'An item'} does not have enough stock for this sale.` },
          }
        }
      }

      const timestamp = new Date().toISOString()
      const totals = calculateTotals(action.input.items, 'POS')
      const orderItems: OrderLineItem[] = action.input.items.map((item) => {
        const product = getProductById(item.productId)
        return {
          productId: item.productId,
          productName: product?.name ?? 'Unknown Product',
          size: item.size,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          image: product?.images?.[0] || '',
        }
      })
      const nextInventory = currentState.inventory.map((record) => {
        const soldQuantity = quantityByProduct[record.productId]
        if (!soldQuantity) {
          return record
        }

        return { ...record, stock: clampToWholeNumber(record.stock - soldQuantity), lastUpdated: timestamp }
      })

      const posRefTag = action.input.clientSaleId ? `[POS-REF:${action.input.clientSaleId}]` : ''
      const combinedNotes = [action.input.notes?.trim(), posRefTag].filter(Boolean).join(' ')

      const nextOrder: OrderRecord = {
        id: createOrderId('POS'),
        source: 'POS',
        customerName: action.input.customerName?.trim() || 'Walk-in Customer',
        customerEmail: 'walk-in@sprayandsniff.local',
        status: 'Completed',
        paymentMethod: action.input.paymentMethod,
        paymentStatus: 'Paid',
        createdAt: timestamp,
        subtotal: totals.subtotal,
        shipping: 0,
        tax: totals.tax,
        total: totals.total,
        notes: combinedNotes,
        items: orderItems,
        timeline: [{ status: 'Completed', createdAt: timestamp, note: 'POS transaction completed.' }],
      }

      const nextTransaction: PosTransaction = {
        id: createTransactionId(),
        orderId: nextOrder.id,
        cashierName: action.input.cashierName,
        paymentMethod: action.input.paymentMethod,
        createdAt: timestamp,
        subtotal: totals.subtotal,
        tax: totals.tax,
        total: totals.total,
        itemsCount: action.input.items.reduce((sum, item) => sum + item.quantity, 0),
      }

      const nextMovements = [
        ...orderItems.map((item) => ({
          id: createMovementId(),
          productId: item.productId,
          productName: item.productName,
          change: -item.quantity,
          reason: 'pos-sale' as const,
          actor: action.input.cashierName,
          createdAt: timestamp,
          resultingStock: nextInventory.find((record) => record.productId === item.productId)?.stock ?? 0,
          note: nextOrder.id,
        })),
        ...currentState.stockMovements,
      ]

      return {
        nextState: {
          ...currentState,
          catalog: syncCatalogStock(currentState.catalog, nextInventory),
          inventory: nextInventory,
          orders: [nextOrder, ...currentState.orders],
          posTransactions: [nextTransaction, ...currentState.posTransactions],
          stockMovements: nextMovements,
        },
        result: { ok: true, message: 'POS transaction completed successfully.', data: nextOrder },
      }
    }

    case 'cancelOwnOrder': {
      if (!hasRole(actor, 'USER')) {
        return {
          nextState: currentState,
          result: { ok: false, message: 'Sign in with your customer account to cancel this order.' },
        }
      }

      const existingOrder = currentState.orders.find((order) => order.id === action.orderId)
      if (!existingOrder || !orderBelongsToActor(existingOrder, actor)) {
        return { nextState: currentState, result: { ok: false, message: 'Order not found.' } }
      }

      if (existingOrder.source !== 'ONLINE') {
        return {
          nextState: currentState,
          result: { ok: false, message: 'Only online orders can be cancelled from your account.' },
        }
      }

      if (existingOrder.status === 'Cancelled') {
        return {
          nextState: currentState,
          result: { ok: false, message: `Order ${existingOrder.id} has already been cancelled.` },
        }
      }

      if (existingOrder.status !== 'Pending' && existingOrder.status !== 'Processing') {
        return {
          nextState: currentState,
          result: {
            ok: false,
            message: 'Only pending or processing orders can be cancelled from your account.',
          },
        }
      }

      const timestamp = new Date().toISOString()
      const actorName = getActorName(actor, 'Customer')
      const quantityByProduct = existingOrder.items.reduce<Record<string, number>>((totals, item) => {
        totals[item.productId] = (totals[item.productId] ?? 0) + item.quantity
        return totals
      }, {})

      const nextInventory = currentState.inventory.map((record) => {
        const restoredQuantity = quantityByProduct[record.productId]
        if (!restoredQuantity) {
          return record
        }

        return {
          ...record,
          stock: clampToWholeNumber(record.stock + restoredQuantity),
          lastUpdated: timestamp,
          lastUpdatedBy: actorName,
        }
      })

      const updatedOrder: OrderRecord = {
        ...existingOrder,
        status: 'Cancelled',
        timeline: [
          ...existingOrder.timeline,
          {
            status: 'Cancelled',
            createdAt: timestamp,
            note:
              existingOrder.paymentStatus === 'Paid'
                ? 'Order cancelled by the customer through self-service. Refund follow-up is required.'
                : 'Order cancelled by the customer through self-service.',
          },
        ],
      }

      const nextMovements = [
        ...existingOrder.items.map((item) => ({
          id: createMovementId(),
          productId: item.productId,
          productName: item.productName,
          change: item.quantity,
          reason: 'order-cancelled' as const,
          actor: actorName,
          createdAt: timestamp,
          resultingStock: nextInventory.find((record) => record.productId === item.productId)?.stock ?? item.quantity,
          note: existingOrder.id,
        })),
        ...currentState.stockMovements,
      ]

      return {
        nextState: {
          ...currentState,
          catalog: syncCatalogStock(currentState.catalog, nextInventory),
          inventory: nextInventory,
          orders: currentState.orders.map((order) => (order.id === action.orderId ? updatedOrder : order)),
          stockMovements: nextMovements,
        },
        result: {
          ok: true,
          message:
            existingOrder.paymentStatus === 'Paid'
              ? `Order ${existingOrder.id} has been cancelled. Our team will review the refund and follow up separately.`
              : `Order ${existingOrder.id} has been cancelled successfully.`,
          data: updatedOrder,
        },
      }
    }

    case 'updateOrderDelivery': {
      // The single authoritative permission check for delivery changes: only a
      // verified ADMIN account reaches this point. Everything else — customers,
      // STAFF, and unauthenticated callers — is refused here on the server, not
      // merely hidden in the UI.
      if (!hasRole(actor, 'ADMIN')) {
        return {
          nextState: currentState,
          result: {
            ok: false,
            message: 'Only admins can change delivery stages. Ask an administrator to update this order.',
          },
        }
      }

      const existingOrder = currentState.orders.find((order) => order.id === action.orderId)
      if (!existingOrder) {
        return { nextState: currentState, result: { ok: false, message: 'Order not found.' } }
      }

      if (existingOrder.source !== 'ONLINE') {
        return {
          nextState: currentState,
          result: { ok: false, message: 'Walk-in orders are completed at checkout and have no delivery.' },
        }
      }

      if (existingOrder.status === 'Cancelled') {
        return {
          nextState: currentState,
          result: { ok: false, message: 'Cancelled orders can no longer be updated.' },
        }
      }

      if (!isDeliveryOrderStatus(action.status)) {
        return {
          nextState: currentState,
          result: {
            ok: false,
            message: `"${action.status}" is not a delivery stage. Use the order status control instead.`,
          },
        }
      }

      const currentRank = DELIVERY_STATUS_RANK[existingOrder.status]
      const nextRank = DELIVERY_STATUS_RANK[action.status]

      if (nextRank === undefined) {
        return {
          nextState: currentState,
          result: { ok: false, message: 'That delivery stage is not recognised.' },
        }
      }

      if (currentRank !== undefined && nextRank <= currentRank) {
        return {
          nextState: currentState,
          result: {
            ok: false,
            message:
              existingOrder.status === 'Delivered'
                ? 'This order has already been delivered and cannot be moved back to an earlier stage.'
                : `Delivery stages move forward only. This order is already at "${existingOrder.status}".`,
          },
        }
      }

      const timestamp = new Date().toISOString()
      const actorName = getActorName(actor, 'Store team')

      // A key that is present but blank clears the stored value; a key that was
      // never sent leaves the existing value alone.
      const courier = 'courier' in action ? sanitizeDeliveryField(action.courier) : existingOrder.courier
      const trackingNumber =
        'trackingNumber' in action
          ? sanitizeDeliveryField(action.trackingNumber)
          : existingOrder.trackingNumber
      const deliveryNotes =
        'deliveryNotes' in action
          ? sanitizeDeliveryField(action.deliveryNotes)
          : existingOrder.deliveryNotes

      const updatedOrder: OrderRecord = {
        ...existingOrder,
        status: action.status,
        courier,
        trackingNumber,
        deliveryNotes,
        timeline: [
          ...existingOrder.timeline,
          {
            status: action.status,
            previousStatus: existingOrder.status,
            createdAt: timestamp,
            actorName,
            actorId: actor?.id,
            note:
              sanitizeDeliveryField(action.note) ||
              `Delivery stage set to ${action.status} by ${actorName}.`,
          },
        ],
      }

      return {
        nextState: {
          ...currentState,
          orders: currentState.orders.map((order) =>
            order.id === action.orderId ? updatedOrder : order,
          ),
        },
        result: {
          ok: true,
          message: `Order ${action.orderId} moved to ${action.status}.`,
          data: updatedOrder,
        },
      }
    }

    case 'updateOrderStatus': {
      if (!canAccessBackoffice(actor)) {
        return { nextState: currentState, result: { ok: false, message: 'Only staff and admins can update order status.' } }
      }

      const existingOrder = currentState.orders.find((order) => order.id === action.orderId)
      if (!existingOrder) {
        return { nextState: currentState, result: { ok: false, message: 'Order not found.' } }
      }

      if (isDeliveryOrderStatus(action.status) || isDeliveryOrderStatus(existingOrder.status)) {
        // Delivery stages have their own validated, audited path. Letting this
        // generic action set them would bypass the forward-only rule and the
        // delivered-order lock, so it is refused for every role including ADMIN.
        return {
          nextState: currentState,
          result: {
            ok: false,
            message:
              'Delivery stages are changed with the Manage Delivery controls, which validate each step.',
          },
        }
      }

      if (existingOrder.status === 'Cancelled') {
        return {
          nextState: currentState,
          result: { ok: false, message: 'Cancelled orders can no longer be updated.' },
        }
      }

      if (action.status === 'Cancelled') {
        return {
          nextState: currentState,
          result: { ok: false, message: 'Use the cancellation workflow so stock is restored correctly.' },
        }
      }

      const timestamp = new Date().toISOString()
      const actorName = getActorName(actor, 'Store team')
      const updatedOrder: OrderRecord = {
        ...existingOrder,
        status: action.status,
        timeline: [
          ...existingOrder.timeline,
          {
            status: action.status,
            previousStatus: existingOrder.status,
            createdAt: timestamp,
            actorName,
            actorId: actor?.id,
            note:
              action.note ||
              (action.status === 'Delivered'
                ? `Order delivered successfully by ${action.actor || actorName}.`
                : `Order moved to ${action.status} by ${action.actor || actorName}.`),
          },
        ],
      }

      return {
        nextState: {
          ...currentState,
          orders: currentState.orders.map((order) => (order.id === action.orderId ? updatedOrder : order)),
        },
        result: { ok: true, message: `Order ${action.orderId} updated to ${action.status}.`, data: updatedOrder },
      }
    }

    case 'markOrderPaymentPaid': {
      if (!canAccessBackoffice(actor)) {
        return {
          nextState: currentState,
          result: { ok: false, message: 'Only staff and admins can record order payments.' },
        }
      }

      const existingOrder = currentState.orders.find((order) => order.id === action.orderId)
      if (!existingOrder) {
        return { nextState: currentState, result: { ok: false, message: 'Order not found.' } }
      }

      if (existingOrder.status === 'Cancelled') {
        return {
          nextState: currentState,
          result: { ok: false, message: 'Cancelled orders cannot be marked as paid.' },
        }
      }

      if (existingOrder.paymentStatus === 'Paid') {
        return {
          nextState: currentState,
          result: {
            ok: true,
            message: `Payment for ${action.orderId} is already recorded.`,
            data: existingOrder,
          },
        }
      }

      const timestamp = new Date().toISOString()
      const actorName = action.actor || getActorName(actor, 'Store team')
      const updatedOrder: OrderRecord = {
        ...existingOrder,
        paymentStatus: 'Paid',
        timeline: [
          ...existingOrder.timeline,
          {
            status: existingOrder.status,
            createdAt: timestamp,
            note:
              action.note ||
              (existingOrder.paymentMethod === 'Cash on Delivery'
                ? `Cash on Delivery payment collected by ${actorName}.`
                : `Payment recorded by ${actorName}.`),
          },
        ],
      }

      return {
        nextState: {
          ...currentState,
          orders: currentState.orders.map((order) =>
            order.id === action.orderId ? updatedOrder : order,
          ),
        },
        result: {
          ok: true,
          message: `Payment for ${action.orderId} has been recorded as paid.`,
          data: updatedOrder,
        },
      }
    }
  }

  return {
    nextState: currentState,
    result: {
      ok: false,
      message: 'Unsupported store action.',
    },
  }
}
