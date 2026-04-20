import type {
  InventoryRecord,
  OrderRecord,
  StockMovement,
} from '@/lib/store-context'

export function isSuccessfulPaymentOrder(order: OrderRecord) {
  return order.paymentStatus === 'Paid'
}

function toDayKey(dateValue: string) {
  return new Date(dateValue).toISOString().slice(0, 10)
}

function formatShortDate(dateValue: string) {
  return new Date(dateValue).toLocaleDateString('en-PH', {
    month: 'short',
    day: 'numeric',
  })
}

export function buildSalesTrendData(orders: OrderRecord[], days = 7) {
  const successfulOrders = orders.filter(isSuccessfulPaymentOrder)
  const now = new Date()
  const range = Array.from({ length: days }, (_, index) => {
    const date = new Date(now)
    date.setDate(now.getDate() - (days - index - 1))
    const iso = date.toISOString()

    return {
      date: toDayKey(iso),
      label: formatShortDate(iso),
      revenue: 0,
      orders: 0,
      online: 0,
      pos: 0,
    }
  })

  const dateMap = new Map(range.map((entry) => [entry.date, entry]))

  successfulOrders.forEach((order) => {
    const key = toDayKey(order.createdAt)
    const bucket = dateMap.get(key)

    if (!bucket) {
      return
    }

    bucket.revenue += order.total
    bucket.orders += 1
    if (order.source === 'ONLINE') {
      bucket.online += order.total
    } else {
      bucket.pos += order.total
    }
  })

  return range
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
    { key: 'online', label: 'Online', value: totals.online },
    { key: 'pos', label: 'POS', value: totals.pos },
  ]
}

export function buildPaymentBreakdownData(orders: OrderRecord[]) {
  const grouped = orders
    .filter(isSuccessfulPaymentOrder)
    .reduce<Record<string, number>>((accumulator, order) => {
      accumulator[order.paymentMethod] = (accumulator[order.paymentMethod] ?? 0) + order.total
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
        name: string
        revenue: number
        quantity: number
      }
    >
  >((accumulator, order) => {
    order.items.forEach((item) => {
      const current = accumulator[item.productId] ?? {
        name: item.productName,
        revenue: 0,
        quantity: 0,
      }

      current.revenue += item.unitPrice * item.quantity
      current.quantity += item.quantity
      accumulator[item.productId] = current
    })

    return accumulator
  }, {})

  return Object.values(grouped)
    .sort((left, right) => right.revenue - left.revenue)
    .slice(0, limit)
    .map((item) => ({
      name: item.name,
      revenue: item.revenue,
      quantity: item.quantity,
    }))
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
