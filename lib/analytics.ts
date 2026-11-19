import type {
  InventoryRecord,
  OrderRecord,
  StockMovement,
} from '@/lib/store-context'

export function roundAnalyticsCurrency(value: number): number {
  return Math.round(value * 100) / 100
}

export function isSuccessfulPaymentOrder(order: OrderRecord) {
  return order.paymentStatus === 'Paid' && order.status !== 'Cancelled'
}

export type SalesTrendGranularity = 'days' | 'months' | 'years'

export interface SalesTrendPoint {
  key: string
  label: string
  fullLabel: string
  revenue: number
  orders: number
  online: number
  pos: number
}

const MANILA_TIME_ZONE = 'Asia/Manila'
const SHORT_MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const LONG_MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

function getManilaDateParts(dateValue: string | Date) {
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date)

  const year = Number(parts.find((p) => p.type === 'year')?.value ?? date.getFullYear())
  const month = Number(parts.find((p) => p.type === 'month')?.value ?? date.getMonth() + 1)
  const day = Number(parts.find((p) => p.type === 'day')?.value ?? date.getDate())
  const monthPadded = String(month).padStart(2, '0')
  const dayPadded = String(day).padStart(2, '0')

  return {
    year,
    month,
    day,
    dateKey: `${year}-${monthPadded}-${dayPadded}`,
    monthKey: `${year}-${monthPadded}`,
  }
}

export function getManilaDateKey(dateValue: string | Date): string {
  return getManilaDateParts(dateValue).dateKey
}

export function getManilaMonthKey(dateValue: string | Date): string {
  return getManilaDateParts(dateValue).monthKey
}

export function getAvailableSalesYears(orders: OrderRecord[]): number[] {
  const years = new Set<number>()
  orders.filter(isSuccessfulPaymentOrder).forEach((order) => {
    years.add(getManilaDateParts(order.createdAt).year)
  })
  if (years.size === 0) {
    years.add(getManilaDateParts(new Date()).year)
  }
  return Array.from(years).sort((a, b) => b - a)
}

export function getAvailableSalesMonths(orders: OrderRecord[], year?: number): string[] {
  const months = new Set<string>()
  orders.filter(isSuccessfulPaymentOrder).forEach((order) => {
    const parts = getManilaDateParts(order.createdAt)
    if (year === undefined || parts.year === year) {
      months.add(parts.monthKey)
    }
  })
  if (months.size === 0) {
    const nowParts = getManilaDateParts(new Date())
    const targetYear = year ?? nowParts.year
    months.add(`${targetYear}-${String(nowParts.month).padStart(2, '0')}`)
  }
  return Array.from(months).sort((a, b) => b.localeCompare(a))
}

function accumulateOrderIntoBucket(bucket: SalesTrendPoint, order: OrderRecord) {
  bucket.revenue = roundAnalyticsCurrency(bucket.revenue + order.total)
  bucket.orders += 1
  if (order.source === 'ONLINE') {
    bucket.online = roundAnalyticsCurrency(bucket.online + order.total)
  } else {
    bucket.pos = roundAnalyticsCurrency(bucket.pos + order.total)
  }
}

export interface BuildSalesTrendOptions {
  granularity: SalesTrendGranularity
  year?: number
  monthKey?: string
  daysWindow?: 'month' | 'last7' | 'last30'
}

export function buildSalesTrendSeries(
  orders: OrderRecord[],
  options: BuildSalesTrendOptions,
): SalesTrendPoint[] {
  const successfulOrders = orders.filter(isSuccessfulPaymentOrder)
  const nowParts = getManilaDateParts(new Date())

  if (options.granularity === 'years') {
    const years = getAvailableSalesYears(orders).sort((a, b) => a - b)
    const buckets: SalesTrendPoint[] = years.map((yr) => ({
      key: String(yr),
      label: String(yr),
      fullLabel: `Year ${yr}`,
      revenue: 0,
      orders: 0,
      online: 0,
      pos: 0,
    }))
    const byKey = new Map(buckets.map((b) => [b.key, b]))

    successfulOrders.forEach((order) => {
      const key = String(getManilaDateParts(order.createdAt).year)
      const bucket = byKey.get(key)
      if (bucket) accumulateOrderIntoBucket(bucket, order)
    })

    return buckets
  }

  if (options.granularity === 'months') {
    const targetYear = options.year ?? getAvailableSalesYears(orders)[0] ?? nowParts.year
    const buckets: SalesTrendPoint[] = SHORT_MONTH_NAMES.map((shortName, index) => {
      const monthNum = String(index + 1).padStart(2, '0')
      return {
        key: `${targetYear}-${monthNum}`,
        label: shortName,
        fullLabel: `${LONG_MONTH_NAMES[index]} ${targetYear}`,
        revenue: 0,
        orders: 0,
        online: 0,
        pos: 0,
      }
    })
    const byKey = new Map(buckets.map((b) => [b.key, b]))

    successfulOrders.forEach((order) => {
      const key = getManilaDateParts(order.createdAt).monthKey
      const bucket = byKey.get(key)
      if (bucket) accumulateOrderIntoBucket(bucket, order)
    })

    return buckets
  }

  // Daily granularity: selected month (1..daysInMonth), or rolling Last 7 / Last 30 days
  const daysWindow = options.daysWindow ?? 'month'
  if (daysWindow === 'last7' || daysWindow === 'last30') {
    const count = daysWindow === 'last7' ? 7 : 30
    const anchor = new Date(Date.UTC(nowParts.year, nowParts.month - 1, nowParts.day))
    const buckets: SalesTrendPoint[] = Array.from({ length: count }, (_, index) => {
      const d = new Date(anchor)
      d.setUTCDate(anchor.getUTCDate() - (count - index - 1))
      const yr = d.getUTCFullYear()
      const mo = d.getUTCMonth() + 1
      const dy = d.getUTCDate()
      const key = `${yr}-${String(mo).padStart(2, '0')}-${String(dy).padStart(2, '0')}`
      const shortMonth = SHORT_MONTH_NAMES[mo - 1]
      return {
        key,
        label: `${shortMonth} ${dy}`,
        fullLabel: `${shortMonth} ${dy}, ${yr}`,
        revenue: 0,
        orders: 0,
        online: 0,
        pos: 0,
      }
    })
    const byKey = new Map(buckets.map((b) => [b.key, b]))

    successfulOrders.forEach((order) => {
      const key = getManilaDateParts(order.createdAt).dateKey
      const bucket = byKey.get(key)
      if (bucket) accumulateOrderIntoBucket(bucket, order)
    })

    return buckets
  }

  const targetMonthKey =
    options.monthKey ?? getAvailableSalesMonths(orders)[0] ?? nowParts.monthKey
  const [yrStr, moStr] = targetMonthKey.split('-')
  const targetYear = Number(yrStr) || nowParts.year
  const targetMonth = Number(moStr) || nowParts.month
  const daysInMonth = new Date(Date.UTC(targetYear, targetMonth, 0)).getUTCDate()
  const shortMonth = SHORT_MONTH_NAMES[targetMonth - 1] ?? moStr

  const buckets: SalesTrendPoint[] = Array.from({ length: daysInMonth }, (_, index) => {
    const dy = index + 1
    const key = `${targetYear}-${String(targetMonth).padStart(2, '0')}-${String(dy).padStart(2, '0')}`
    return {
      key,
      label: String(dy),
      fullLabel: `${shortMonth} ${dy}, ${targetYear}`,
      revenue: 0,
      orders: 0,
      online: 0,
      pos: 0,
    }
  })
  const byKey = new Map(buckets.map((b) => [b.key, b]))

  successfulOrders.forEach((order) => {
    const key = getManilaDateParts(order.createdAt).dateKey
    const bucket = byKey.get(key)
    if (bucket) accumulateOrderIntoBucket(bucket, order)
  })

  return buckets
}

export function buildSalesTrendData(orders: OrderRecord[], days = 7) {
  return buildSalesTrendSeries(orders, {
    granularity: 'days',
    daysWindow: days === 30 ? 'last30' : 'last7',
  }).map((point) => ({
    date: point.key,
    label: point.label,
    revenue: point.revenue,
    orders: point.orders,
    online: point.online,
    pos: point.pos,
  }))
}

export function buildChannelMixData(orders: OrderRecord[]) {
  const totals = orders
    .filter(isSuccessfulPaymentOrder)
    .reduce(
    (accumulator, order) => {
      if (order.source === 'ONLINE') {
        accumulator.online += order.total
      } else {
        accumulator.pos += order.total
      }
      return accumulator
    },
    { online: 0, pos: 0 },
  )

  return [
    { key: 'online', label: 'Online', value: roundAnalyticsCurrency(totals.online) },
    { key: 'pos', label: 'POS', value: roundAnalyticsCurrency(totals.pos) },
  ]
}

export function buildPaymentBreakdownData(orders: OrderRecord[]) {
  const grouped = orders
    .filter(isSuccessfulPaymentOrder)
    .reduce<Record<string, number>>((accumulator, order) => {
      accumulator[order.paymentMethod] = roundAnalyticsCurrency(
        (accumulator[order.paymentMethod] ?? 0) + order.total,
      )
      return accumulator
    }, {})

  return Object.entries(grouped).map(([label, value]) => ({
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    label,
    value,
  }))
}

export function buildOrderStatusData(orders: OrderRecord[]) {
  const grouped = orders.reduce<Record<string, number>>((accumulator, order) => {
    accumulator[order.status] = (accumulator[order.status] ?? 0) + 1
    return accumulator
  }, {})

  return Object.entries(grouped).map(([label, value]) => ({
    key: label.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
    label,
    value,
  }))
}

export function buildInventoryHealthData(inventory: InventoryRecord[]) {
  const totals = inventory.reduce(
    (accumulator, item) => {
      if (item.stock <= 0) {
        accumulator.outOfStock += 1
      } else if (item.stock <= item.reorderPoint) {
        accumulator.lowStock += 1
      } else {
        accumulator.inStock += 1
      }
      return accumulator
    },
    { inStock: 0, lowStock: 0, outOfStock: 0 },
  )

  return [
    { key: 'inStock', label: 'In Stock', value: totals.inStock },
    { key: 'lowStock', label: 'Low Stock', value: totals.lowStock },
    { key: 'outOfStock', label: 'Out of Stock', value: totals.outOfStock },
  ]
}

export function buildTopProductData(orders: OrderRecord[], limit = 5) {
  const grouped = orders
    .filter(isSuccessfulPaymentOrder)
    .reduce<
    Record<
      string,
      {
        productId: string
        name: string
        revenue: number
        quantity: number
      }
    >
  >((accumulator, order) => {
    order.items.forEach((item) => {
      const current = accumulator[item.productId] ?? {
        productId: item.productId,
        name: item.productName || 'Unknown Product',
        revenue: 0,
        quantity: 0,
      }

      current.revenue = roundAnalyticsCurrency(current.revenue + item.unitPrice * item.quantity)
      current.quantity += item.quantity
      accumulator[item.productId] = current
    })

    return accumulator
  }, {})

  const sorted = Object.values(grouped)
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, limit)

  const seenCounts = new Map<string, number>()

  return sorted.map((item, index) => {
    const baseName = item.name || 'Unknown Product'
    const occurrences = seenCounts.get(baseName) ?? 0
    seenCounts.set(baseName, occurrences + 1)
    const uniqueName = occurrences > 0 ? `${baseName} (#${occurrences + 1})` : baseName

    return {
      productId: item.productId,
      key: `${item.productId}-${index}`,
      name: uniqueName,
      displayName: baseName,
      revenue: item.revenue,
      quantity: item.quantity,
    }
  })
}

export function buildStockMovementData(movements: StockMovement[], limit = 6) {
  return movements.slice(0, limit).reverse().map((movement) => ({
    id: movement.id,
    label: movement.productName.length > 14
      ? `${movement.productName.slice(0, 14)}...`
      : movement.productName,
    fullLabel: movement.productName,
    change: movement.change,
    resultingStock: movement.resultingStock,
  }))
}
