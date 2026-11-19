import {
  buildInventoryHealthData,
  buildOrderStatusData,
  buildPaymentBreakdownData,
  buildSalesTrendSeries,
  buildTopProductData,
  getManilaMonthKey,
  isSuccessfulPaymentOrder,
  roundAnalyticsCurrency,
} from '@/lib/analytics'
import {
  formatPosPaymentMeta,
  getChannelLabel,
  getOrderStatusLabel,
  getPaymentStateLabel,
} from '@/lib/admin-orders-formatters'
import type { Product } from '@/lib/products'
import { SITE_NAME } from '@/lib/site'
import {
  DEFAULT_OVERSTOCK_THRESHOLD,
  type InventoryRecord,
  type OrderRecord,
  type PosTransaction,
  type StockMovement,
} from '@/lib/store-engine'
import { downloadCsvFile, downloadXlsxWorkbook, type XlsxCell, type XlsxSheet } from '@/lib/xlsx'

export type ReportExportScope =
  | 'full'
  | 'sales'
  | 'orders'
  | 'products'
  | 'pos'
  | 'inventory'
  | 'movements'
  | 'orders-csv'

export interface StoreReportExportInput {
  selectedMonth: string
  orders: OrderRecord[]
  posTransactions: PosTransaction[]
  stockMovements: StockMovement[]
  inventory: InventoryRecord[]
  catalog: Product[]
}

const MANILA_TIME_ZONE = 'Asia/Manila'

export function formatManilaDateTime(dateValue: string | Date): string {
  const date = typeof dateValue === 'string' ? new Date(dateValue) : dateValue
  if (Number.isNaN(date.getTime())) {
    return typeof dateValue === 'string' ? dateValue : ''
  }

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: MANILA_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date)

  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((p) => p.type === type)?.value ?? '00'

  const hour = get('hour') === '24' ? '00' : get('hour')
  return `${get('year')}-${get('month')}-${get('day')} ${hour}:${get('minute')}:${get('second')}`
}

export function formatReportPeriodLabel(selectedMonth: string): string {
  if (selectedMonth === 'all') {
    return 'All Time'
  }
  const [year, month] = selectedMonth.split('-').map(Number)
  if (!year || !month) return selectedMonth
  return new Date(year, month - 1, 1).toLocaleDateString('en-PH', {
    month: 'long',
    year: 'numeric',
  })
}

function buildPeriodSlug(selectedMonth: string): string {
  return selectedMonth === 'all' ? 'all-time' : selectedMonth
}

function sanitizeExportText(value: string | undefined | null): string {
  return value ? value.replace(/\r?\n/g, ' ').trim() : ''
}

function buildSummarySheet(input: StoreReportExportInput): XlsxSheet {
  const { catalog, inventory, orders, selectedMonth } = input
  const periodLabel = formatReportPeriodLabel(selectedMonth)
  const generatedAt = formatManilaDateTime(new Date())

  const filteredOrders =
    selectedMonth === 'all'
      ? orders
      : orders.filter((order) => getManilaMonthKey(order.createdAt) === selectedMonth)
  const successfulPayments = filteredOrders.filter(isSuccessfulPaymentOrder)

  const totalRevenue = roundAnalyticsCurrency(
    successfulPayments.reduce((sum, order) => sum + order.total, 0),
  )
  const onlineRevenue = roundAnalyticsCurrency(
    successfulPayments
      .filter((order) => order.source === 'ONLINE')
      .reduce((sum, order) => sum + order.total, 0),
  )
  const posRevenue = roundAnalyticsCurrency(
    successfulPayments
      .filter((order) => order.source === 'POS')
      .reduce((sum, order) => sum + order.total, 0),
  )
  const taxCollected = roundAnalyticsCurrency(
    successfulPayments.reduce((sum, order) => sum + order.tax, 0),
  )

  const inventoryByProductId = new Map(inventory.map((record) => [record.productId, record]))
  const activeInventory = inventory.filter((item) => !item.isArchived)
  const activeCatalog = catalog.filter(
    (product) => !inventoryByProductId.get(product.id)?.isArchived,
  )
  const inventoryCoverage =
    activeCatalog.length === 0 ? 0 : activeInventory.length / activeCatalog.length

  const paymentBreakdown = buildPaymentBreakdownData(filteredOrders)
  const orderStatusData = buildOrderStatusData(filteredOrders)
  const inventoryHealthData = buildInventoryHealthData(activeInventory)

  const rows: XlsxCell[][] = [
    [{ value: `${SITE_NAME} — Business Report`, format: 'title' }],
    [
      {
        value: `Period: ${periodLabel} | Generated: ${generatedAt} (Asia/Manila) | Orders Analyzed: ${filteredOrders.length}`,
        format: 'subtitle',
      },
    ],
    [
      {
        value:
          'Immutable Historical Pricing: Revenue, tax, and line totals use frozen unit prices recorded at the time of purchase.',
        format: 'subtitle',
      },
    ],
    [],
    [
      { value: 'Key Performance Metric', format: 'header' },
      { value: 'Value', format: 'header' },
      { value: 'Notes', format: 'header' },
    ],
    [
      'Paid Revenue',
      { value: totalRevenue, format: 'currency' },
      'All paid, non-cancelled Online and POS orders',
    ],
    [
      'Online Paid Revenue',
      { value: onlineRevenue, format: 'currency' },
      'Paid storefront orders',
    ],
    [
      'POS Paid Revenue',
      { value: posRevenue, format: 'currency' },
      'Paid walk-in point-of-sale transactions',
    ],
    [
      'Tax Collected (VAT)',
      { value: taxCollected, format: 'currency' },
      'Total VAT collected on paid orders',
    ],
    [
      'Paid Orders Count',
      { value: successfulPayments.length, format: 'integer' },
      'Completed/paid non-cancelled orders',
    ],
    [
      'Total Orders Analyzed',
      { value: filteredOrders.length, format: 'integer' },
      'Includes pending and cancelled orders in period',
    ],
    [
      'Active Catalog Items',
      { value: activeCatalog.length, format: 'integer' },
      'Non-archived products in catalog',
    ],
    [
      'Tracked Active Inventory SKUs',
      { value: activeInventory.length, format: 'integer' },
      'Active inventory records',
    ],
    [
      'Inventory Accuracy Coverage',
      { value: inventoryCoverage, format: 'percent' },
      'Active catalog matched to live inventory records',
    ],
    [],
    [
      { value: 'Payment Method', format: 'header' },
      { value: 'Paid Revenue', format: 'header' },
      { value: 'Share of Paid Revenue', format: 'header' },
    ],
  ]

  if (paymentBreakdown.length === 0) {
    rows.push(['No paid orders in period', { value: 0, format: 'currency' }, { value: 0, format: 'percent' }])
  } else {
    paymentBreakdown.forEach((entry) => {
      rows.push([
        entry.label,
        { value: entry.value, format: 'currency' },
        { value: totalRevenue > 0 ? entry.value / totalRevenue : 0, format: 'percent' },
      ])
    })
  }

  rows.push([])
  rows.push([
    { value: 'Order Status', format: 'header' },
    { value: 'Order Count', format: 'header' },
    { value: 'Share of Orders', format: 'header' },
  ])

  if (orderStatusData.length === 0) {
    rows.push(['No orders in period', { value: 0, format: 'integer' }, { value: 0, format: 'percent' }])
  } else {
    orderStatusData.forEach((entry) => {
      rows.push([
        entry.label,
        { value: entry.value, format: 'integer' },
        {
          value: filteredOrders.length > 0 ? entry.value / filteredOrders.length : 0,
          format: 'percent',
        },
      ])
    })
  }

  rows.push([])
  rows.push([
    { value: 'Inventory Health Condition', format: 'header' },
    { value: 'Active SKU Count', format: 'header' },
    { value: 'Share of Active SKUs', format: 'header' },
  ])

  inventoryHealthData.forEach((entry) => {
    rows.push([
      entry.label,
      { value: entry.value, format: 'integer' },
      {
        value: activeInventory.length > 0 ? entry.value / activeInventory.length : 0,
        format: 'percent',
      },
    ])
  })

  return {
    name: 'Summary',
    rows,
    colWidths: [34, 22, 46],
  }
}

function buildSalesTrendSheet(input: StoreReportExportInput): XlsxSheet {
  const { orders, selectedMonth } = input

  if (selectedMonth !== 'all') {
    const dailySeries = buildSalesTrendSeries(orders, {
      granularity: 'days',
      daysWindow: 'month',
      monthKey: selectedMonth,
    })

    const totals = dailySeries.reduce(
      (acc, pt) => {
        acc.revenue = roundAnalyticsCurrency(acc.revenue + pt.revenue)
        acc.online = roundAnalyticsCurrency(acc.online + pt.online)
        acc.pos = roundAnalyticsCurrency(acc.pos + pt.pos)
        acc.orders += pt.orders
        return acc
      },
      { revenue: 0, online: 0, pos: 0, orders: 0 },
    )

    const rows: XlsxCell[][] = [
      [
        { value: 'Date (Manila)', format: 'header' },
        { value: 'Label', format: 'header' },
        { value: 'Total Paid Revenue', format: 'header' },
        { value: 'Online Revenue', format: 'header' },
        { value: 'POS Revenue', format: 'header' },
        { value: 'Paid Orders', format: 'header' },
      ],
      ...dailySeries.map((pt) => [
        pt.key,
        pt.fullLabel,
        { value: pt.revenue, format: 'currency' as const },
        { value: pt.online, format: 'currency' as const },
        { value: pt.pos, format: 'currency' as const },
        { value: pt.orders, format: 'integer' as const },
      ]),
      [
        { value: 'TOTAL', format: 'boldText' },
        { value: formatReportPeriodLabel(selectedMonth), format: 'boldText' },
        { value: totals.revenue, format: 'boldCurrency' },
        { value: totals.online, format: 'boldCurrency' },
        { value: totals.pos, format: 'boldCurrency' },
        { value: totals.orders, format: 'boldInteger' },
      ],
    ]

    return {
      name: 'Sales Trend',
      rows,
      freezeHeaderRow: 1,
      autoFilterRow: 1,
    }
  }

  // All Time: group paid non-cancelled orders by Manila month chronologically
  const monthlyMap = new Map<
    string,
    { monthKey: string; label: string; revenue: number; online: number; pos: number; orders: number }
  >()

  orders.filter(isSuccessfulPaymentOrder).forEach((order) => {
    const monthKey = getManilaMonthKey(order.createdAt)
    const existing = monthlyMap.get(monthKey) ?? {
      monthKey,
      label: formatReportPeriodLabel(monthKey),
      revenue: 0,
      online: 0,
      pos: 0,
      orders: 0,
    }
    existing.revenue = roundAnalyticsCurrency(existing.revenue + order.total)
    existing.orders += 1
    if (order.source === 'ONLINE') {
      existing.online = roundAnalyticsCurrency(existing.online + order.total)
    } else {
      existing.pos = roundAnalyticsCurrency(existing.pos + order.total)
    }
    monthlyMap.set(monthKey, existing)
  })

  const sortedMonths = Array.from(monthlyMap.values()).sort((a, b) =>
    a.monthKey.localeCompare(b.monthKey),
  )

  const totals = sortedMonths.reduce(
    (acc, pt) => {
      acc.revenue = roundAnalyticsCurrency(acc.revenue + pt.revenue)
      acc.online = roundAnalyticsCurrency(acc.online + pt.online)
      acc.pos = roundAnalyticsCurrency(acc.pos + pt.pos)
      acc.orders += pt.orders
      return acc
    },
    { revenue: 0, online: 0, pos: 0, orders: 0 },
  )

  const rows: XlsxCell[][] = [
    [
      { value: 'Month Key', format: 'header' },
      { value: 'Month', format: 'header' },
      { value: 'Total Paid Revenue', format: 'header' },
      { value: 'Online Revenue', format: 'header' },
      { value: 'POS Revenue', format: 'header' },
      { value: 'Paid Orders', format: 'header' },
    ],
    ...sortedMonths.map((pt) => [
      pt.monthKey,
      pt.label,
      { value: pt.revenue, format: 'currency' as const },
      { value: pt.online, format: 'currency' as const },
      { value: pt.pos, format: 'currency' as const },
      { value: pt.orders, format: 'integer' as const },
    ]),
    [
      { value: 'TOTAL', format: 'boldText' },
      { value: 'All Time', format: 'boldText' },
      { value: totals.revenue, format: 'boldCurrency' },
      { value: totals.online, format: 'boldCurrency' },
      { value: totals.pos, format: 'boldCurrency' },
      { value: totals.orders, format: 'boldInteger' },
    ],
  ]

  return {
    name: 'Sales Trend',
    rows,
    freezeHeaderRow: 1,
    autoFilterRow: 1,
  }
}

function getFilteredOrdersSorted(orders: OrderRecord[], selectedMonth: string): OrderRecord[] {
  const filtered =
    selectedMonth === 'all'
      ? orders
      : orders.filter((order) => getManilaMonthKey(order.createdAt) === selectedMonth)

  return [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

function buildOrdersSheet(orders: OrderRecord[], selectedMonth: string): XlsxSheet {
  const sortedOrders = getFilteredOrdersSorted(orders, selectedMonth)

  const rows: XlsxCell[][] = [
    [
      { value: 'Order ID', format: 'header' },
      { value: 'Date & Time (Manila)', format: 'header' },
      { value: 'Channel', format: 'header' },
      { value: 'Customer Name', format: 'header' },
      { value: 'Customer Email', format: 'header' },
      { value: 'Order Status', format: 'header' },
      { value: 'Payment Method', format: 'header' },
      { value: 'Payment Status', format: 'header' },
      { value: 'Items Count', format: 'header' },
      { value: 'Items Summary', format: 'header' },
      { value: 'Subtotal', format: 'header' },
      { value: 'Tax (VAT)', format: 'header' },
      { value: 'Shipping', format: 'header' },
      { value: 'Total', format: 'header' },
      { value: 'Courier', format: 'header' },
      { value: 'Tracking Number', format: 'header' },
      { value: 'Notes', format: 'header' },
    ],
    ...sortedOrders.map((order) => {
      const itemsCount = order.items.reduce((sum, item) => sum + item.quantity, 0)
      const itemsSummary = order.items
        .map((item) => `${item.productName} (${item.size}ml) x${item.quantity}`)
        .join('; ')
      const cleanNotes =
        order.source === 'POS'
          ? sanitizeExportText(formatPosPaymentMeta(order).cleanNote)
          : sanitizeExportText(order.notes)

      return [
        order.id,
        formatManilaDateTime(order.createdAt),
        getChannelLabel(order),
        order.customerName,
        order.customerEmail,
        getOrderStatusLabel(order),
        order.paymentMethod,
        getPaymentStateLabel(order),
        { value: itemsCount, format: 'integer' as const },
        itemsSummary,
        { value: order.subtotal, format: 'currency' as const },
        { value: order.tax, format: 'currency' as const },
        { value: order.shipping, format: 'currency' as const },
        { value: order.total, format: 'currency' as const },
        sanitizeExportText(order.courier),
        sanitizeExportText(order.trackingNumber),
        cleanNotes,
      ]
    }),
  ]

  return {
    name: 'Orders',
    rows,
    freezeHeaderRow: 1,
    autoFilterRow: 1,
  }
}

function buildProductSalesSheet(orders: OrderRecord[], selectedMonth: string): XlsxSheet {
  const filteredOrders = getFilteredOrdersSorted(orders, selectedMonth)
  const productSales = buildTopProductData(
    filteredOrders,
    Math.max(filteredOrders.length * 10, 1000),
  )

  const totalUnits = productSales.reduce((sum, item) => sum + item.quantity, 0)
  const totalProductRevenue = roundAnalyticsCurrency(
    productSales.reduce((sum, item) => sum + item.revenue, 0),
  )

  const rows: XlsxCell[][] = [
    [
      { value: 'Rank', format: 'header' },
      { value: 'Product ID', format: 'header' },
      { value: 'Product Name', format: 'header' },
      { value: 'Units Sold', format: 'header' },
      { value: 'Pre-VAT Revenue', format: 'header' },
      { value: 'Share of Product Revenue', format: 'header' },
    ],
    ...productSales.map((item, idx) => [
      { value: idx + 1, format: 'integer' as const },
      item.productId,
      item.displayName || item.name,
      { value: item.quantity, format: 'integer' as const },
      { value: item.revenue, format: 'currency' as const },
      {
        value: totalProductRevenue > 0 ? item.revenue / totalProductRevenue : 0,
        format: 'percent' as const,
      },
    ]),
    [
      { value: 'TOTAL', format: 'boldText' },
      { value: '', format: 'boldText' },
      { value: `${productSales.length} product(s)`, format: 'boldText' },
      { value: totalUnits, format: 'boldInteger' },
      { value: totalProductRevenue, format: 'boldCurrency' },
      { value: productSales.length > 0 ? 1 : 0, format: 'boldPercent' },
    ],
  ]

  return {
    name: 'Product Sales',
    rows,
    freezeHeaderRow: 1,
    autoFilterRow: 1,
  }
}

function buildOrderLineItemsSheet(orders: OrderRecord[], selectedMonth: string): XlsxSheet {
  const sortedOrders = getFilteredOrdersSorted(orders, selectedMonth)

  const rows: XlsxCell[][] = [
    [
      { value: 'Order ID', format: 'header' },
      { value: 'Date & Time (Manila)', format: 'header' },
      { value: 'Channel', format: 'header' },
      { value: 'Order Status', format: 'header' },
      { value: 'Payment Status', format: 'header' },
      { value: 'Product ID', format: 'header' },
      { value: 'Product Name', format: 'header' },
      { value: 'Size (ml)', format: 'header' },
      { value: 'Quantity', format: 'header' },
      { value: 'Frozen Unit Price', format: 'header' },
      { value: 'Line Total', format: 'header' },
    ],
  ]

  sortedOrders.forEach((order) => {
    const manilaDate = formatManilaDateTime(order.createdAt)
    const channel = getChannelLabel(order)
    const orderStatus = getOrderStatusLabel(order)
    const paymentStatus = getPaymentStateLabel(order)

    order.items.forEach((item) => {
      rows.push([
        order.id,
        manilaDate,
        channel,
        orderStatus,
        paymentStatus,
        item.productId,
        item.productName,
        { value: item.size, format: 'integer' },
        { value: item.quantity, format: 'integer' },
        { value: item.unitPrice, format: 'currency' },
        {
          value: roundAnalyticsCurrency(item.unitPrice * item.quantity),
          format: 'currency',
        },
      ])
    })
  })

  return {
    name: 'Order Line Items',
    rows,
    freezeHeaderRow: 1,
    autoFilterRow: 1,
  }
}

function buildPosTransactionsSheet(
  posTransactions: PosTransaction[],
  orders: OrderRecord[],
  selectedMonth: string,
): XlsxSheet {
  const ordersById = new Map(orders.map((order) => [order.id, order]))
  const filteredTx = (
    selectedMonth === 'all'
      ? posTransactions
      : posTransactions.filter((tx) => getManilaMonthKey(tx.createdAt) === selectedMonth)
  )
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const rows: XlsxCell[][] = [
    [
      { value: 'Transaction ID', format: 'header' },
      { value: 'Order ID', format: 'header' },
      { value: 'Date & Time (Manila)', format: 'header' },
      { value: 'Cashier', format: 'header' },
      { value: 'Payment Method', format: 'header' },
      { value: 'Order Status', format: 'header' },
      { value: 'Items Count', format: 'header' },
      { value: 'Subtotal', format: 'header' },
      { value: 'Tax (VAT)', format: 'header' },
      { value: 'Total', format: 'header' },
    ],
    ...filteredTx.map((tx) => {
      const linkedOrder = ordersById.get(tx.orderId)
      const status = linkedOrder
        ? getOrderStatusLabel(linkedOrder)
        : 'Completed'

      return [
        tx.id,
        tx.orderId,
        formatManilaDateTime(tx.createdAt),
        tx.cashierName,
        tx.paymentMethod,
        status,
        { value: tx.itemsCount, format: 'integer' as const },
        { value: tx.subtotal, format: 'currency' as const },
        { value: tx.tax, format: 'currency' as const },
        { value: tx.total, format: 'currency' as const },
      ]
    }),
  ]

  return {
    name: 'POS Transactions',
    rows,
    freezeHeaderRow: 1,
    autoFilterRow: 1,
  }
}

function buildInventorySheet(inventory: InventoryRecord[], catalog: Product[]): XlsxSheet {
  const productsById = new Map(catalog.map((product) => [product.id, product]))
  const activeInventory = inventory
    .filter((item) => !item.isArchived)
    .slice()
    .sort((a, b) => a.sku.localeCompare(b.sku))

  const rows: XlsxCell[][] = [
    [
      { value: 'SKU', format: 'header' },
      { value: 'Product ID', format: 'header' },
      { value: 'Product Name', format: 'header' },
      { value: 'Brand', format: 'header' },
      { value: 'Category', format: 'header' },
      { value: 'Current Stock', format: 'header' },
      { value: 'Reorder Point', format: 'header' },
      { value: 'Overstock Threshold', format: 'header' },
      { value: 'Stock Condition', format: 'header' },
      { value: 'Needs Reorder', format: 'header' },
      { value: 'Location', format: 'header' },
      { value: 'Catalog Price', format: 'header' },
      { value: 'Est. Stock Value', format: 'header' },
      { value: 'Last Updated (Manila)', format: 'header' },
      { value: 'Updated By', format: 'header' },
    ],
    ...activeInventory.map((item) => {
      const product = productsById.get(item.productId)
      const condition =
        item.stock <= 0
          ? 'Out of Stock'
          : item.stock <= item.reorderPoint
            ? 'Low Stock'
            : 'In Stock'
      const needsReorder = item.stock <= item.reorderPoint ? 'Yes' : 'No'
      const unitPrice = product?.price ?? 0
      const stockValue = roundAnalyticsCurrency(unitPrice * item.stock)

      return [
        item.sku,
        item.productId,
        product?.name ?? 'Unknown Product',
        product?.brand ?? SITE_NAME,
        product?.category ?? '',
        { value: item.stock, format: 'integer' as const },
        { value: item.reorderPoint, format: 'integer' as const },
        {
          value: item.overStockThreshold ?? DEFAULT_OVERSTOCK_THRESHOLD,
          format: 'integer' as const,
        },
        condition,
        needsReorder,
        item.location,
        { value: unitPrice, format: 'currency' as const },
        { value: stockValue, format: 'currency' as const },
        formatManilaDateTime(item.lastUpdated),
        sanitizeExportText(item.lastUpdatedBy),
      ]
    }),
  ]

  return {
    name: 'Inventory',
    rows,
    freezeHeaderRow: 1,
    autoFilterRow: 1,
  }
}

function buildStockMovementsSheet(
  stockMovements: StockMovement[],
  selectedMonth: string,
): XlsxSheet {
  const filteredMovements = (
    selectedMonth === 'all'
      ? stockMovements
      : stockMovements.filter((m) => getManilaMonthKey(m.createdAt) === selectedMonth)
  )
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

  const rows: XlsxCell[][] = [
    [
      { value: 'Movement ID', format: 'header' },
      { value: 'Date & Time (Manila)', format: 'header' },
      { value: 'Product ID', format: 'header' },
      { value: 'Product Name', format: 'header' },
      { value: 'Change', format: 'header' },
      { value: 'Resulting Stock', format: 'header' },
      { value: 'Reason', format: 'header' },
      { value: 'Actor', format: 'header' },
      { value: 'Note', format: 'header' },
    ],
    ...filteredMovements.map((movement) => [
      movement.id,
      formatManilaDateTime(movement.createdAt),
      movement.productId,
      movement.productName,
      { value: movement.change, format: 'integer' as const },
      { value: movement.resultingStock, format: 'integer' as const },
      movement.reason,
      movement.actor,
      sanitizeExportText(movement.note),
    ]),
  ]

  return {
    name: 'Stock Movements',
    rows,
    freezeHeaderRow: 1,
    autoFilterRow: 1,
  }
}

/**
 * Builds the complete multi-sheet Excel workbook for the Reports page.
 */
export function buildStoreReportSheets(input: StoreReportExportInput): XlsxSheet[] {
  return [
    buildSummarySheet(input),
    buildSalesTrendSheet(input),
    buildOrdersSheet(input.orders, input.selectedMonth),
    buildProductSalesSheet(input.orders, input.selectedMonth),
    buildOrderLineItemsSheet(input.orders, input.selectedMonth),
    buildPosTransactionsSheet(input.posTransactions, input.orders, input.selectedMonth),
    buildInventorySheet(input.inventory, input.catalog),
    buildStockMovementsSheet(input.stockMovements, input.selectedMonth),
  ]
}

/**
 * Exports the requested report scope as an .xlsx workbook or .csv download.
 */
export function exportStoreReport(
  scope: ReportExportScope,
  input: StoreReportExportInput,
): { filename: string; sheetCount: number } {
  const periodSlug = buildPeriodSlug(input.selectedMonth)

  if (scope === 'orders-csv') {
    const ordersSheet = buildOrdersSheet(input.orders, input.selectedMonth)
    const filename = `spray-and-sniff-orders-${periodSlug}.csv`
    downloadCsvFile(filename, ordersSheet.rows)
    return { filename, sheetCount: 1 }
  }

  let sheets: XlsxSheet[]
  let filename: string

  switch (scope) {
    case 'sales':
      sheets = [buildSummarySheet(input), buildSalesTrendSheet(input)]
      filename = `spray-and-sniff-sales-summary-${periodSlug}.xlsx`
      break
    case 'orders':
      sheets = [
        buildOrdersSheet(input.orders, input.selectedMonth),
        buildOrderLineItemsSheet(input.orders, input.selectedMonth),
      ]
      filename = `spray-and-sniff-orders-${periodSlug}.xlsx`
      break
    case 'products':
      sheets = [buildProductSalesSheet(input.orders, input.selectedMonth)]
      filename = `spray-and-sniff-product-sales-${periodSlug}.xlsx`
      break
    case 'pos':
      sheets = [buildPosTransactionsSheet(input.posTransactions, input.orders, input.selectedMonth)]
      filename = `spray-and-sniff-pos-transactions-${periodSlug}.xlsx`
      break
    case 'inventory':
      sheets = [buildInventorySheet(input.inventory, input.catalog)]
      filename = `spray-and-sniff-inventory-${periodSlug}.xlsx`
      break
    case 'movements':
      sheets = [buildStockMovementsSheet(input.stockMovements, input.selectedMonth)]
      filename = `spray-and-sniff-stock-movements-${periodSlug}.xlsx`
      break
    case 'full':
    default:
      sheets = buildStoreReportSheets(input)
      filename = `spray-and-sniff-report-${periodSlug}.xlsx`
      break
  }

  downloadXlsxWorkbook(filename, sheets)
  return { filename, sheetCount: sheets.length }
}
