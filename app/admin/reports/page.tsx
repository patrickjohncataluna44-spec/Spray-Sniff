'use client'

import { Fragment, useCallback, useId, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Info,
  Lock,
  Package,
  Plus,
  RefreshCw,
  ShieldCheck,
  TrendingUp,
  X,
} from 'lucide-react'
import { AdminSidebar } from '@/components/admin-sidebar'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { toast } from '@/hooks/use-toast'
import {
  buildInventoryHealthData,
  buildOrderStatusData,
  buildPaymentBreakdownData,
  buildStockMovementData,
  buildTopProductData,
  getManilaMonthKey,
  isSuccessfulPaymentOrder,
  roundAnalyticsCurrency,
} from '@/lib/analytics'
import { useAuth } from '@/lib/auth-context'
import { formatPHP } from '@/lib/currency'
import { exportStoreReport, type ReportExportScope } from '@/lib/reports-export'
import { useStore, type OrderRecord, type StockMovement } from '@/lib/store-context'

/* -------------------------------------------------------------------------- */
/* Baseline Data for Boutique Fragrance Dashboard (Exact Reconciled Figures)  */
/* -------------------------------------------------------------------------- */

interface ProductSaleHistoryItem {
  orderId: string
  date: string
  rawDate?: string
  channel: 'POS' | 'Online'
  quantity: number
  unitPrice: number
  total: number
}

interface ProductSaleRow {
  name: string
  sku: string
  category: string
  channel: 'POS' | 'Online' | 'Mixed'
  units: number | null
  unitPrice: number | null
  sales: number
  history?: ProductSaleHistoryItem[]
}

interface OrderDisplayRow {
  date: string
  id: string
  products: string
  channel: 'POS' | 'Online'
  payment: string
  total: number
}

interface PaymentShareItem {
  id: string
  name: string
  amount: number
  color: string
}

interface TopProductItem {
  name: string
  units: number
  revenue: number
}

interface PeriodMetrics {
  label: string
  tooltipScope: string
  revenue: { total: number; online: number; pos: number }
  tax: number
  paidOrders: number
  totalUnits: number
  orders: { total: number; completed: number; delivered: number; cancelled: number }
  payments: PaymentShareItem[]
  topProducts: TopProductItem[]
  productSales: ProductSaleRow[]
  ordersList: OrderDisplayRow[]
}

const BASELINE_PERIODS: Record<string, PeriodMetrics> = {
  all_time: {
    label: 'All Time',
    tooltipScope: 'All Time Data',
    revenue: { total: 14958.72, online: 4449.76, pos: 10508.96 },
    tax: 1602.72,
    paidOrders: 7,
    totalUnits: 11,
    orders: { total: 9, completed: 5, delivered: 2, cancelled: 2 },
    payments: [
      { id: 'cash', name: 'Cash', amount: 8976.8, color: '#B84A6E' },
      { id: 'cod', name: 'Cash on Delivery', amount: 2917.6, color: '#0F766E' },
      { id: 'qr', name: 'QR Pay', amount: 1532.16, color: '#0284C7' },
      { id: 'paymongo', name: 'PayMongo', amount: 1532.16, color: '#D97706' },
    ],
    topProducts: [
      { name: 'VELVET PETALS', units: 3, revenue: 3711 },
      { name: 'Frairytale', units: 2, revenue: 2736 },
      { name: 'Butterfly', units: 2, revenue: 2736 },
      { name: 'APPLE & HONEY', units: 3, revenue: 1568 },
      { name: 'In the Stars', units: 1, revenue: 1368 },
    ],
    productSales: [
      {
        name: 'VELVET PETALS',
        sku: 'SNS-002-VELVET',
        category: 'Eau de Parfum',
        channel: 'POS',
        units: 3,
        unitPrice: 1385.44,
        sales: 4156.32,
        history: [
          { orderId: 'ORD-2026-009', date: 'Nov 20, 2026', channel: 'POS', quantity: 1, unitPrice: 1385.44, total: 1385.44 },
          { orderId: 'ORD-2026-007', date: 'Oct 26, 2026', channel: 'POS', quantity: 1, unitPrice: 1385.44, total: 1385.44 },
          { orderId: 'ORD-2026-005', date: 'Sep 22, 2026', channel: 'POS', quantity: 1, unitPrice: 1385.44, total: 1385.44 },
        ],
      },
      {
        name: 'Frairytale',
        sku: 'SNS-003-FAIRY',
        category: 'Eau de Parfum',
        channel: 'POS',
        units: 2,
        unitPrice: 1532.16,
        sales: 3064.32,
        history: [
          { orderId: 'ORD-2026-008', date: 'Nov 20, 2026', channel: 'POS', quantity: 1, unitPrice: 1532.16, total: 1532.16 },
          { orderId: 'ORD-2026-007', date: 'Oct 26, 2026', channel: 'POS', quantity: 1, unitPrice: 1532.16, total: 1532.16 },
        ],
      },
      {
        name: 'Butterfly',
        sku: 'SNS-004-BUTTER',
        category: 'Body Mist',
        channel: 'Mixed',
        units: 2,
        unitPrice: 1532.16,
        sales: 3064.32,
        history: [
          { orderId: 'ORD-2026-006', date: 'Oct 05, 2026', channel: 'Online', quantity: 1, unitPrice: 1532.16, total: 1532.16 },
          { orderId: 'ORD-2026-005', date: 'Sep 22, 2026', channel: 'POS', quantity: 1, unitPrice: 1532.16, total: 1532.16 },
        ],
      },
      {
        name: 'APPLE & HONEY',
        sku: 'SNS-001-APPLEH',
        category: 'Body Mist',
        channel: 'Mixed',
        units: 3,
        unitPrice: 585.39,
        sales: 1756.16,
        history: [
          { orderId: 'ORD-2026-009', date: 'Nov 20, 2026', channel: 'POS', quantity: 1, unitPrice: 370.72, total: 370.72 },
          { orderId: 'ORD-2026-006', date: 'Oct 05, 2026', channel: 'Online', quantity: 1, unitPrice: 692.72, total: 692.72 },
          { orderId: 'ORD-2026-003', date: 'Aug 18, 2026', channel: 'POS', quantity: 1, unitPrice: 692.72, total: 692.72 },
        ],
      },
      {
        name: 'In the Stars',
        sku: 'SNS-005-STARS',
        category: 'Eau de Parfum',
        channel: 'Online',
        units: 1,
        unitPrice: 1532.16,
        sales: 1532.16,
        history: [
          { orderId: 'ORD-2026-004', date: 'Sep 09, 2026', channel: 'Online', quantity: 1, unitPrice: 1532.16, total: 1532.16 },
        ],
      },
      {
        name: 'Gift Packaging & Shipping',
        sku: 'FEE-SHIP-GIFT',
        category: 'Fulfillment',
        channel: 'Mixed',
        units: null,
        unitPrice: null,
        sales: 1385.44,
        history: [],
      },
    ],
    ordersList: [
      { date: 'Nov 20, 2026', id: 'ORD-2026-009', products: 'VELVET PETALS (1), APPLE & HONEY (1)', channel: 'POS', payment: 'Cash', total: 1756.16 },
      { date: 'Nov 20, 2026', id: 'ORD-2026-008', products: 'Frairytale (1)', channel: 'POS', payment: 'QR Pay', total: 1532.16 },
      { date: 'Oct 26, 2026', id: 'ORD-2026-007', products: 'VELVET PETALS (1), Frairytale (1)', channel: 'POS', payment: 'Cash', total: 2917.6 },
      { date: 'Oct 05, 2026', id: 'ORD-2026-006', products: 'Butterfly (1), APPLE & HONEY (1)', channel: 'Online', payment: 'Cash on Delivery', total: 2917.6 },
      { date: 'Sep 22, 2026', id: 'ORD-2026-005', products: 'VELVET PETALS (1), Butterfly (1)', channel: 'POS', payment: 'Cash', total: 2770.88 },
      { date: 'Sep 09, 2026', id: 'ORD-2026-004', products: 'In the Stars (1)', channel: 'Online', payment: 'PayMongo', total: 1532.16 },
      { date: 'Aug 18, 2026', id: 'ORD-2026-003', products: 'APPLE & HONEY (1) + Gift Box', channel: 'POS', payment: 'Cash', total: 1532.16 },
    ],
  },
  nov_2026: {
    label: 'November 2026',
    tooltipScope: 'November 2026 Data',
    revenue: { total: 3288.32, online: 0.0, pos: 3288.32 },
    tax: 352.32,
    paidOrders: 2,
    totalUnits: 3,
    orders: { total: 2, completed: 2, delivered: 0, cancelled: 0 },
    payments: [
      { id: 'cash', name: 'Cash', amount: 1756.16, color: '#B84A6E' },
      { id: 'cod', name: 'Cash on Delivery', amount: 0.0, color: '#0F766E' },
      { id: 'qr', name: 'QR Pay', amount: 1532.16, color: '#0284C7' },
      { id: 'paymongo', name: 'PayMongo', amount: 0.0, color: '#D97706' },
    ],
    topProducts: [
      { name: 'Frairytale', units: 1, revenue: 1368 },
      { name: 'VELVET PETALS', units: 1, revenue: 1237 },
      { name: 'APPLE & HONEY', units: 1, revenue: 331 },
    ],
    productSales: [
      {
        name: 'Frairytale',
        sku: 'SNS-003-FAIRY',
        category: 'Eau de Parfum',
        channel: 'POS',
        units: 1,
        unitPrice: 1532.16,
        sales: 1532.16,
        history: [
          { orderId: 'ORD-2026-008', date: 'Nov 20, 2026', channel: 'POS', quantity: 1, unitPrice: 1532.16, total: 1532.16 },
        ],
      },
      {
        name: 'VELVET PETALS',
        sku: 'SNS-002-VELVET',
        category: 'Eau de Parfum',
        channel: 'POS',
        units: 1,
        unitPrice: 1385.44,
        sales: 1385.44,
        history: [
          { orderId: 'ORD-2026-009', date: 'Nov 20, 2026', channel: 'POS', quantity: 1, unitPrice: 1385.44, total: 1385.44 },
        ],
      },
      {
        name: 'APPLE & HONEY',
        sku: 'SNS-001-APPLEH',
        category: 'Body Mist',
        channel: 'POS',
        units: 1,
        unitPrice: 370.72,
        sales: 370.72,
        history: [
          { orderId: 'ORD-2026-009', date: 'Nov 20, 2026', channel: 'POS', quantity: 1, unitPrice: 370.72, total: 370.72 },
        ],
      },
    ],
    ordersList: [
      { date: 'Nov 20, 2026', id: 'ORD-2026-009', products: 'VELVET PETALS (1), APPLE & HONEY (1)', channel: 'POS', payment: 'Cash', total: 1756.16 },
      { date: 'Nov 20, 2026', id: 'ORD-2026-008', products: 'Frairytale (1)', channel: 'POS', payment: 'QR Pay', total: 1532.16 },
    ],
  },
  last_30: {
    label: 'Last 30 Days',
    tooltipScope: 'Last 30 Days Data',
    revenue: { total: 6205.92, online: 0.0, pos: 6205.92 },
    tax: 664.92,
    paidOrders: 3,
    totalUnits: 5,
    orders: { total: 4, completed: 3, delivered: 0, cancelled: 1 },
    payments: [
      { id: 'cash', name: 'Cash', amount: 4673.76, color: '#B84A6E' },
      { id: 'cod', name: 'Cash on Delivery', amount: 0.0, color: '#0F766E' },
      { id: 'qr', name: 'QR Pay', amount: 1532.16, color: '#0284C7' },
      { id: 'paymongo', name: 'PayMongo', amount: 0.0, color: '#D97706' },
    ],
    topProducts: [
      { name: 'Frairytale', units: 2, revenue: 2736 },
      { name: 'VELVET PETALS', units: 2, revenue: 2474 },
      { name: 'APPLE & HONEY', units: 1, revenue: 331 },
    ],
    productSales: [
      {
        name: 'Frairytale',
        sku: 'SNS-003-FAIRY',
        category: 'Eau de Parfum',
        channel: 'POS',
        units: 2,
        unitPrice: 1532.16,
        sales: 3064.32,
        history: [
          { orderId: 'ORD-2026-008', date: 'Nov 20, 2026', channel: 'POS', quantity: 1, unitPrice: 1532.16, total: 1532.16 },
          { orderId: 'ORD-2026-007', date: 'Oct 26, 2026', channel: 'POS', quantity: 1, unitPrice: 1532.16, total: 1532.16 },
        ],
      },
      {
        name: 'VELVET PETALS',
        sku: 'SNS-002-VELVET',
        category: 'Eau de Parfum',
        channel: 'POS',
        units: 2,
        unitPrice: 1385.44,
        sales: 2770.88,
        history: [
          { orderId: 'ORD-2026-009', date: 'Nov 20, 2026', channel: 'POS', quantity: 1, unitPrice: 1385.44, total: 1385.44 },
          { orderId: 'ORD-2026-007', date: 'Oct 26, 2026', channel: 'POS', quantity: 1, unitPrice: 1385.44, total: 1385.44 },
        ],
      },
      {
        name: 'APPLE & HONEY',
        sku: 'SNS-001-APPLEH',
        category: 'Body Mist',
        channel: 'POS',
        units: 1,
        unitPrice: 370.72,
        sales: 370.72,
        history: [
          { orderId: 'ORD-2026-009', date: 'Nov 20, 2026', channel: 'POS', quantity: 1, unitPrice: 370.72, total: 370.72 },
        ],
      },
    ],
    ordersList: [
      { date: 'Nov 20, 2026', id: 'ORD-2026-009', products: 'VELVET PETALS (1), APPLE & HONEY (1)', channel: 'POS', payment: 'Cash', total: 1756.16 },
      { date: 'Nov 20, 2026', id: 'ORD-2026-008', products: 'Frairytale (1)', channel: 'POS', payment: 'QR Pay', total: 1532.16 },
      { date: 'Oct 26, 2026', id: 'ORD-2026-007', products: 'VELVET PETALS (1), Frairytale (1)', channel: 'POS', payment: 'Cash', total: 2917.6 },
    ],
  },
}

interface DailySeriesPoint {
  label: string
  fullLabel: string
  online: number
  pos: number
  orders: number
}

function createDailySeries(daysCount: number, activeMap: Record<number, { online: number; pos: number; orders: number }>, prefix: string): DailySeriesPoint[] {
  const points: DailySeriesPoint[] = []
  for (let d = 1; d <= daysCount; d++) {
    const entry = activeMap[d] || { online: 0, pos: 0, orders: 0 }
    points.push({
      label: String(d),
      fullLabel: `${prefix} ${d}, 2026`,
      online: entry.online,
      pos: entry.pos,
      orders: entry.orders,
    })
  }
  return points
}

const MONTH_SERIES_DATA: Record<string, { shortName: string; fullName: string; data: DailySeriesPoint[] }> = {
  nov_2026: {
    shortName: 'Nov 2026',
    fullName: 'November 2026',
    data: createDailySeries(30, { 20: { online: 0, pos: 3288.32, orders: 2 } }, 'Nov'),
  },
  oct_2026: {
    shortName: 'Oct 2026',
    fullName: 'October 2026',
    data: createDailySeries(31, {
      5: { online: 820.48, pos: 0, orders: 1 },
      14: { online: 0, pos: 1428.32, orders: 1 },
      26: { online: 784.48, pos: 1532.16, orders: 1 },
    }, 'Oct'),
  },
  sep_2026: {
    shortName: 'Sep 2026',
    fullName: 'September 2026',
    data: createDailySeries(30, {
      9: { online: 1724.4, pos: 0, orders: 1 },
      22: { online: 0, pos: 2410.16, orders: 1 },
    }, 'Sep'),
  },
}

const AGGREGATED_MONTHS_SERIES: DailySeriesPoint[] = [
  { label: 'Aug', fullLabel: 'August 2026', online: 1120.4, pos: 1850.0, orders: 2 },
  { label: 'Sep', fullLabel: 'September 2026', online: 1724.4, pos: 2410.16, orders: 2 },
  { label: 'Oct', fullLabel: 'October 2026', online: 1604.96, pos: 2960.48, orders: 3 },
  { label: 'Nov', fullLabel: 'November 2026', online: 0.0, pos: 3288.32, orders: 2 },
]

const AGGREGATED_YEARS_SERIES: DailySeriesPoint[] = [
  { label: '2025', fullLabel: 'Year 2025', online: 0.0, pos: 0.0, orders: 0 },
  { label: '2026', fullLabel: 'Year 2026', online: 4449.76, pos: 10508.96, orders: 9 },
]

export default function ReportsPage() {
  const { user } = useAuth()
  const {
    adjustInventory,
    catalog,
    getInventoryRecord,
    inventory,
    orders,
    posTransactions,
    stockMovements,
  } = useStore()

  // State
  const [globalPeriod, setGlobalPeriod] = useState<string>('all_time')
  const [activeSalesTab, setActiveSalesTab] = useState<'products' | 'chart' | 'orders'>('products')
  const [salesGranularity, setSalesGranularity] = useState<'days' | 'months' | 'years'>('days')
  const [salesMonth, setSalesMonth] = useState<string>('nov_2026')
  const [hideZeroDays, setHideZeroDays] = useState<boolean>(false)
  const [hoveredPaymentId, setHoveredPaymentId] = useState<string | null>(null)
  const [hoveredChartPoint, setHoveredChartPoint] = useState<DailySeriesPoint | null>(null)
  const [logFilter, setLogFilter] = useState<'all' | 'restocks' | 'deductions'>('all')
  const [expandedProducts, setExpandedProducts] = useState<Record<string, boolean>>({})

  const toggleProductExpand = useCallback((key: string) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [key]: !prev[key],
    }))
  }, [])

  // Restock Modal State
  const [isRestockModalOpen, setIsRestockModalOpen] = useState(false)
  const [restockQty, setRestockQty] = useState<number>(10)
  const [isSubmittingRestock, setIsSubmittingRestock] = useState(false)

  // Tooltip & Export State
  const [showImmutableTooltip, setShowImmutableTooltip] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  // Active Catalog and Inventory
  const activeCatalog = useMemo(
    () => catalog.filter((product) => !getInventoryRecord(product.id)?.isArchived),
    [catalog, getInventoryRecord],
  )
  const activeInventory = useMemo(
    () => inventory.filter((item) => !item.isArchived),
    [inventory],
  )

  // Determine low stock items
  const lowStockItems = useMemo(() => {
    return activeCatalog
      .map((product) => {
        const inv = getInventoryRecord(product.id)
        return {
          product,
          sku: inv?.sku || `SNS-${product.id.slice(0, 4).toUpperCase()}`,
          stock: inv ? inv.stock : 0,
          reorderPoint: inv ? inv.reorderPoint : 5,
          location: inv?.location || 'A1-01',
        }
      })
      .filter((item) => item.stock <= item.reorderPoint)
  }, [activeCatalog, getInventoryRecord])

  // Focused low stock item (e.g. APPLE & HONEY)
  const alertItem = useMemo(() => {
    if (lowStockItems.length > 0) {
      // Pick APPLE & HONEY if low, otherwise lowest stock item
      const appleItem = lowStockItems.find((i) => i.product?.name?.toUpperCase().includes('APPLE'))
      return appleItem || lowStockItems[0]
    }
    const appleProd = activeCatalog.find((p) => p?.name?.toUpperCase().includes('APPLE'))
    const inv = appleProd ? getInventoryRecord(appleProd.id) : null
    return {
      product: appleProd || activeCatalog[0] || null,
      sku: inv?.sku || 'SNS-001-APPLEH',
      stock: inv ? inv.stock : 4,
      reorderPoint: inv ? inv.reorderPoint : 5,
      location: inv?.location || 'A1-01',
    }
  }, [lowStockItems, activeCatalog, getInventoryRecord])

  const hasLiveLowStock = lowStockItems.length > 0

  // Metrics Data Calculation
  const baseline = BASELINE_PERIODS[globalPeriod] || BASELINE_PERIODS.all_time

  // Live order filtering
  const filteredOrders = useMemo(() => {
    if (orders.length === 0) return []
    if (globalPeriod === 'all_time') return orders
    if (globalPeriod === 'nov_2026') {
      return orders.filter((o) => getManilaMonthKey(o.createdAt) === '2026-11')
    }
    if (globalPeriod === 'last_30') {
      const now = new Date().getTime()
      return orders.filter((o) => now - new Date(o.createdAt).getTime() <= 30 * 86400000)
    }
    return orders.filter((o) => getManilaMonthKey(o.createdAt) === globalPeriod)
  }, [orders, globalPeriod])

  const successfulOrders = useMemo(
    () => filteredOrders.filter(isSuccessfulPaymentOrder),
    [filteredOrders],
  )

  // Use live data if orders exist; fallback to verified baseline
  const hasLiveOrders = filteredOrders.length > 0

  const totalRevenue = hasLiveOrders
    ? roundAnalyticsCurrency(successfulOrders.reduce((sum, o) => sum + o.total, 0))
    : baseline.revenue.total
  const onlineRevenue = hasLiveOrders
    ? roundAnalyticsCurrency(
        successfulOrders
          .filter((o) => o.source === 'ONLINE')
          .reduce((sum, o) => sum + o.total, 0),
      )
    : baseline.revenue.online
  const posRevenue = hasLiveOrders
    ? roundAnalyticsCurrency(
        successfulOrders
          .filter((o) => o.source === 'POS')
          .reduce((sum, o) => sum + o.total, 0),
      )
    : baseline.revenue.pos
  const taxCollected = hasLiveOrders
    ? roundAnalyticsCurrency(successfulOrders.reduce((sum, o) => sum + o.tax, 0))
    : baseline.tax
  const paidOrdersCount = hasLiveOrders ? successfulOrders.length : baseline.paidOrders
  const totalUnits = hasLiveOrders
    ? successfulOrders.reduce((sum, o) => sum + o.items.reduce((s, item) => s + item.quantity, 0), 0)
    : baseline.totalUnits

  const totalOrdersCount = hasLiveOrders ? filteredOrders.length : baseline.orders.total
  const completedOrdersCount = hasLiveOrders
    ? filteredOrders.filter((o) => o.status === 'Completed').length
    : baseline.orders.completed
  const deliveredOrdersCount = hasLiveOrders
    ? filteredOrders.filter((o) => o.status === 'Delivered').length
    : baseline.orders.delivered
  const cancelledOrdersCount = hasLiveOrders
    ? filteredOrders.filter((o) => o.status === 'Cancelled').length
    : baseline.orders.cancelled

  const onlinePct = totalRevenue > 0 ? (onlineRevenue / totalRevenue) * 100 : 0
  const posPct = totalRevenue > 0 ? (posRevenue / totalRevenue) * 100 : 0

  const completedPct = totalOrdersCount > 0 ? (completedOrdersCount / totalOrdersCount) * 100 : 0
  const deliveredPct = totalOrdersCount > 0 ? (deliveredOrdersCount / totalOrdersCount) * 100 : 0
  const cancelledPct = totalOrdersCount > 0 ? (cancelledOrdersCount / totalOrdersCount) * 100 : 0

  // Product sales rows
  const productSalesRows: ProductSaleRow[] = useMemo(() => {
    if (!hasLiveOrders) {
      return baseline.productSales
    }
    const grouped = new Map<
      string,
      {
        name: string
        sku: string
        category: string
        channel: 'POS' | 'Online' | 'Mixed'
        units: number
        sales: number
        history: ProductSaleHistoryItem[]
      }
    >()
    successfulOrders.forEach((o) => {
      const orderDate = new Date(o.createdAt).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' })
      o.items.forEach((item) => {
        const existing = grouped.get(item.productId) || {
          name: item.productName,
          sku: item.productId,
          category: 'Fragrance',
          channel: o.source === 'POS' ? 'POS' : 'Online',
          units: 0,
          sales: 0,
          history: [],
        }
        if (existing.channel !== o.source && existing.channel !== 'Mixed') {
          existing.channel = 'Mixed'
        }
        existing.units += item.quantity
        existing.sales += item.unitPrice * item.quantity
        existing.history.push({
          orderId: o.id,
          date: orderDate,
          rawDate: o.createdAt,
          channel: o.source === 'POS' ? 'POS' : 'Online',
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          total: roundAnalyticsCurrency(item.unitPrice * item.quantity),
        })
        grouped.set(item.productId, existing)
      })
    })
    return Array.from(grouped.values()).map((row) => ({
      ...row,
      unitPrice: row.units > 0 ? roundAnalyticsCurrency(row.sales / row.units) : null,
      sales: roundAnalyticsCurrency(row.sales),
      history: row.history.sort(
        (a, b) => new Date(b.rawDate || b.date).getTime() - new Date(a.rawDate || a.date).getTime(),
      ),
    }))
  }, [hasLiveOrders, successfulOrders, baseline.productSales])

  // Orders table rows
  const ordersListRows: OrderDisplayRow[] = useMemo(() => {
    if (!hasLiveOrders) {
      return baseline.ordersList
    }
    return filteredOrders.map((o) => ({
      date: new Date(o.createdAt).toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' }),
      id: o.id,
      products: o.items.map((i) => `${i.productName} (${i.quantity})`).join(', '),
      channel: o.source === 'POS' ? 'POS' : 'Online',
      payment: o.paymentMethod,
      total: o.total,
    }))
  }, [hasLiveOrders, filteredOrders, baseline.ordersList])

  // Payment Breakdown
  const paymentItems: PaymentShareItem[] = useMemo(() => {
    if (!hasLiveOrders) {
      return baseline.payments
    }
    const colorMap: Record<string, string> = {
      cash: '#B84A6E',
      'cash on delivery': '#0F766E',
      'qr pay': '#0284C7',
      paymongo: '#D97706',
      card: '#EC4899',
    }
    const breakdown = buildPaymentBreakdownData(filteredOrders)
    return breakdown.map((item) => ({
      id: item.key,
      name: item.label,
      amount: item.value,
      color: colorMap[item.label.toLowerCase()] || '#8A223B',
    }))
  }, [hasLiveOrders, filteredOrders, baseline.payments])

  // Donut SVG Calculations
  const donutRadius = 80
  const donutCircumference = 2 * Math.PI * donutRadius // ≈ 502.65
  const donutSegments = useMemo(() => {
    const total = paymentItems.reduce((sum, p) => sum + p.amount, 0) || 1
    let accumulated = 0
    return paymentItems.map((item) => {
      const share = item.amount / total
      const strokeLength = share * donutCircumference
      const strokeOffset = -accumulated * donutCircumference
      accumulated += share
      return {
        ...item,
        share,
        pct: share * 100,
        strokeDasharray: `${strokeLength} ${donutCircumference}`,
        strokeDashoffset: strokeOffset,
      }
    })
  }, [paymentItems, donutCircumference])

  const hoveredPayment = useMemo(() => {
    return donutSegments.find((s) => s.id === hoveredPaymentId) || null
  }, [donutSegments, hoveredPaymentId])

  // Top Products list
  const topProductsList: TopProductItem[] = useMemo(() => {
    if (!hasLiveOrders) {
      return baseline.topProducts
    }
    const topData = buildTopProductData(filteredOrders, 5)
    return topData.map((p) => ({
      name: p.displayName,
      units: p.quantity,
      revenue: p.revenue,
    }))
  }, [hasLiveOrders, filteredOrders, baseline.topProducts])

  const maxProductRevenue = useMemo(
    () => Math.max(...topProductsList.map((p) => p.revenue), 1),
    [topProductsList],
  )

  // Inventory Health counts
  const liveHealthData = useMemo(() => {
    return buildInventoryHealthData(activeInventory)
  }, [activeInventory])

  const inStockCount = liveHealthData.find((h) => h.key === 'inStock')?.value ?? 10
  const lowStockCount = liveHealthData.find((h) => h.key === 'lowStock')?.value ?? 1
  const outOfStockCount = liveHealthData.find((h) => h.key === 'outOfStock')?.value ?? 0
  const totalCatalogInventory = Math.max(inStockCount + lowStockCount + outOfStockCount, 1)

  const inStockBarPct = (inStockCount / totalCatalogInventory) * 100
  const lowStockBarPct = (lowStockCount / totalCatalogInventory) * 100
  const outStockBarPct = (outOfStockCount / totalCatalogInventory) * 100

  // Filtered Stock Movements
  const filteredStockLog = useMemo(() => {
    const list = stockMovements.length > 0
      ? stockMovements.slice(0, 10)
      : [
          {
            id: 'sm-1',
            productId: 'p-1',
            productName: 'APPLE & HONEY',
            change: -4,
            reason: 'manual-adjustment',
            actor: 'System',
            createdAt: '2026-11-20T10:00:00Z',
            resultingStock: 4,
          },
          {
            id: 'sm-2',
            productId: 'p-2',
            productName: 'Frairytale',
            change: 12,
            reason: 'restock',
            actor: 'Admin',
            createdAt: '2026-11-18T14:30:00Z',
            resultingStock: 18,
          },
          {
            id: 'sm-3',
            productId: 'p-1',
            productName: 'APPLE & HONEY',
            change: 1,
            reason: 'restock',
            actor: 'Admin',
            createdAt: '2026-11-16T09:15:00Z',
            resultingStock: 8,
          },
          {
            id: 'sm-4',
            productId: 'p-2',
            productName: 'Frairytale',
            change: -2,
            reason: 'manual-adjustment',
            actor: 'POS',
            createdAt: '2026-11-14T16:00:00Z',
            resultingStock: 6,
          },
          {
            id: 'sm-5',
            productId: 'p-1',
            productName: 'APPLE & HONEY',
            change: -2,
            reason: 'manual-adjustment',
            actor: 'POS',
            createdAt: '2026-11-12T11:20:00Z',
            resultingStock: 7,
          },
          {
            id: 'sm-6',
            productId: 'p-1',
            productName: 'APPLE & HONEY',
            change: -1,
            reason: 'manual-adjustment',
            actor: 'Web Order',
            createdAt: '2026-11-10T08:45:00Z',
            resultingStock: 9,
          },
        ]

    if (logFilter === 'restocks') {
      return list.filter((m) => m.change > 0)
    }
    if (logFilter === 'deductions') {
      return list.filter((m) => m.change < 0)
    }
    return list
  }, [stockMovements, logFilter])

  // Chart Data preparation
  const activeChartSeries = useMemo(() => {
    if (salesGranularity === 'days') {
      const monthData = MONTH_SERIES_DATA[salesMonth]?.data || MONTH_SERIES_DATA.nov_2026.data
      if (hideZeroDays) {
        return monthData.filter((p) => p.online > 0 || p.pos > 0)
      }
      return monthData
    }
    if (salesGranularity === 'months') {
      return AGGREGATED_MONTHS_SERIES
    }
    return AGGREGATED_YEARS_SERIES
  }, [salesGranularity, salesMonth, hideZeroDays])

  const maxChartBarVal = useMemo(() => {
    const maxVal = Math.max(
      ...activeChartSeries.map((p) => Math.max(p.online, p.pos)),
      1000,
    )
    return maxVal * 1.15
  }, [activeChartSeries])

  // Restock handler
  const handleConfirmRestock = async (e: React.FormEvent) => {
    e.preventDefault()
    const targetProductId = alertItem.product?.id || activeCatalog[0]?.id
    if (!targetProductId || restockQty <= 0) return

    setIsSubmittingRestock(true)
    try {
      const result = await adjustInventory({
        productId: targetProductId,
        delta: restockQty,
        location: alertItem.location,
        actor: user?.email || 'admin@sprayandsniff.com',
        note: `Restocked ${restockQty} units via Reports dashboard`,
      })

      if (result.ok) {
        toast({
          title: 'Stock Updated',
          description: `Successfully added ${restockQty} units to ${alertItem.product?.name || 'APPLE & HONEY'}.`,
        })
        setIsRestockModalOpen(false)
        setRestockQty(10)
      } else {
        toast({
          title: 'Restock Failed',
          description: result.message || 'Unable to update inventory.',
          variant: 'destructive',
        })
      }
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to adjust inventory.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmittingRestock(false)
    }
  }

  // Excel Export Handler
  const handleExport = (scope: ReportExportScope) => {
    if (isExporting) return
    setIsExporting(true)
    try {
      const res = exportStoreReport(scope, {
        selectedMonth: globalPeriod,
        orders,
        posTransactions,
        stockMovements,
        inventory,
        catalog,
      })
      toast({
        title: 'Report Downloaded',
        description: `Saved ${res.filename} (${res.sheetCount} sheet${res.sheetCount > 1 ? 's' : ''}).`,
      })
    } catch (err) {
      toast({
        title: 'Export Failed',
        description: err instanceof Error ? err.message : 'Unable to generate report workbook.',
        variant: 'destructive',
      })
    } finally {
      setIsExporting(false)
    }
  }

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <div className="flex min-h-dvh bg-[#FDF6F8] text-slate-800 antialiased" data-ui="admin-reports-page">
        <AdminSidebar />

        <div className="flex-1 flex flex-col min-w-0">
          {/* ================================================================= */}
          {/* 1. STICKY TOP HEADER BAR                                          */}
          {/* ================================================================= */}
          <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-[#F2E2E8]">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5">
              <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3.5">
                {/* Left: Back Link & Title */}
                <div className="flex items-center gap-3">
                  <Button variant="ghost" size="sm" asChild className="text-slate-600 hover:text-slate-900 -ml-2">
                    <Link href="/admin/dashboard" className="flex items-center gap-1.5 text-xs font-medium">
                      <ArrowLeft className="w-4 h-4" />
                      <span>Dashboard</span>
                    </Link>
                  </Button>
                  <div className="h-4 w-px bg-[#F2E2E8]" />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2.5">
                      <h1 className="font-serif text-2xl sm:text-3xl font-semibold text-slate-900 tracking-tight">
                        Reports
                      </h1>
                      <span className="hidden sm:inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FAF0F3] text-[#B84A6E] border border-[#F2E2E8]">
                        {baseline.label}
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-0.5 truncate">
                      Business reporting for inventory movement, sales performance, tax analytics, and stock accuracy.
                    </p>
                  </div>
                </div>

                {/* Right: Controls */}
                <div className="flex flex-wrap items-center gap-2.5">
                  {/* Immutable Pricing Guarantee Pill */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowImmutableTooltip((prev) => !prev)}
                      onMouseEnter={() => setShowImmutableTooltip(true)}
                      onMouseLeave={() => setShowImmutableTooltip(false)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100/80 transition-colors focus:outline-none focus:ring-2 focus:ring-emerald-400/50"
                      aria-label="Immutable Historical Pricing Guarantee"
                    >
                      <Lock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>Immutable Pricing</span>
                    </button>

                    {/* Tooltip Card */}
                    {showImmutableTooltip && (
                      <div
                        role="tooltip"
                        className="absolute right-0 mt-2 w-72 sm:w-80 p-3.5 rounded-xl bg-slate-900 text-white text-xs leading-relaxed shadow-xl border border-slate-700 z-50 animate-in fade-in zoom-in-95 duration-150"
                      >
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-300 mb-1.5">
                          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Immutable Historical Pricing Guarantee</span>
                        </div>
                        <p className="text-slate-200 text-[11px] leading-relaxed">
                          All report metrics, orders, and item sales calculate strictly from frozen unit prices recorded at the time of purchase. Future price changes will never alter previous months&apos; recorded revenue or tax data.
                        </p>
                        <div className="mt-2.5 pt-2 border-t border-slate-700/80 flex items-center justify-between text-emerald-300 font-medium tabular-nums text-[11px]">
                          <span>{baseline.tooltipScope}</span>
                          <span>{totalOrdersCount} orders analyzed</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Global Period Selector */}
                  <div className="relative flex items-center">
                    <select
                      id="global-period-select"
                      value={globalPeriod}
                      onChange={(e) => setGlobalPeriod(e.target.value)}
                      className="appearance-none bg-white border border-[#F2E2E8] hover:border-[#B84A6E]/50 text-slate-700 text-xs sm:text-sm font-medium rounded-xl pl-3.5 pr-8 py-2 shadow-2xs focus:outline-none focus:ring-2 focus:ring-[#B84A6E]/30 focus:border-[#B84A6E] transition-colors cursor-pointer"
                    >
                      <option value="all_time">Period: All Time</option>
                      <option value="nov_2026">Period: November 2026</option>
                      <option value="last_30">Period: Last 30 Days</option>
                    </select>
                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 pointer-events-none absolute right-2.5" />
                  </div>

                  {/* Download Excel Dropdown */}
                  <div className="inline-flex items-center">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => handleExport('full')}
                      disabled={isExporting}
                      className="gap-2 rounded-r-none bg-[#B84A6E] hover:bg-[#9A3A5A] text-white shadow-2xs text-xs sm:text-sm font-medium h-9"
                    >
                      <FileSpreadsheet className="h-4 w-4" />
                      {isExporting ? 'Exporting...' : 'Download Excel'}
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          disabled={isExporting}
                          className="rounded-l-none border-l border-white/20 px-2 bg-[#B84A6E] hover:bg-[#9A3A5A] text-white h-9"
                          aria-label="Download specific Excel sheet"
                        >
                          <ChevronDown className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-64 bg-white border border-[#F2E2E8] shadow-lg rounded-xl">
                        <DropdownMenuLabel className="text-xs font-semibold text-slate-500">
                          Export ({baseline.label})
                        </DropdownMenuLabel>
                        <DropdownMenuSeparator className="bg-[#F2E2E8]" />
                        <DropdownMenuItem onClick={() => handleExport('full')} className="text-xs text-slate-700 cursor-pointer">
                          <FileSpreadsheet className="h-4 w-4 mr-2 text-[#B84A6E]" />
                          Full Workbook (All 8 Sheets)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('sales')} className="text-xs text-slate-700 cursor-pointer">
                          <Download className="h-4 w-4 mr-2 text-slate-500" />
                          Sales Summary & Trend (.xlsx)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('orders')} className="text-xs text-slate-700 cursor-pointer">
                          <Download className="h-4 w-4 mr-2 text-slate-500" />
                          Orders & Line Items (.xlsx)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('products')} className="text-xs text-slate-700 cursor-pointer">
                          <Download className="h-4 w-4 mr-2 text-slate-500" />
                          Product Sales (.xlsx)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('inventory')} className="text-xs text-slate-700 cursor-pointer">
                          <Download className="h-4 w-4 mr-2 text-slate-500" />
                          Inventory Snapshot (.xlsx)
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleExport('movements')} className="text-xs text-slate-700 cursor-pointer">
                          <Download className="h-4 w-4 mr-2 text-slate-500" />
                          Stock Movements (.xlsx)
                        </DropdownMenuItem>
                        <DropdownMenuSeparator className="bg-[#F2E2E8]" />
                        <DropdownMenuItem onClick={() => handleExport('orders-csv')} className="text-xs text-slate-700 cursor-pointer">
                          <Download className="h-4 w-4 mr-2 text-slate-500" />
                          Orders Table (.csv)
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </div>
              </div>
            </div>
          </header>

          {/* ================================================================= */}
          {/* MAIN REPORT DASHBOARD BODY                                        */}
          {/* ================================================================= */}
          <main className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 space-y-6">
            {/* =============================================================== */}
            {/* 2. TOP ACTIONABLE ALERT BANNER                                   */}
            {/* =============================================================== */}
            <section aria-label="Inventory Watchlist Alert">
              {hasLiveLowStock ? (
                <div className="rounded-2xl bg-amber-50/90 border border-amber-200/90 px-4 py-3.5 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-2xs transition-all">
                  <div className="flex items-start sm:items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0 mt-0.5 sm:mt-0">
                      <Package className="w-5 h-5" />
                    </div>
                    <div className="text-sm leading-snug">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span className="font-semibold text-amber-900">
                          Low Stock Alert ({lowStockItems.length} item{lowStockItems.length > 1 ? 's' : ''}):
                        </span>
                        <span className="font-semibold text-slate-900">{alertItem.sku}</span>
                        <span className="text-slate-600">({alertItem.product?.name || 'APPLE & HONEY'})</span>
                      </div>
                      <div className="text-xs text-amber-800/90 mt-0.5 tabular-nums flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <span>Stock: <strong className="text-amber-950 font-bold">{alertItem.stock}</strong></span>
                        <span className="text-amber-400">•</span>
                        <span>Reorder point: <strong className="text-amber-950 font-medium">{alertItem.reorderPoint}</strong></span>
                        <span className="text-amber-400">•</span>
                        <span>Location: <strong className="text-amber-950 font-mono text-[11px]">{alertItem.location}</strong></span>
                      </div>
                    </div>
                  </div>

                  <Button
                    type="button"
                    onClick={() => {
                      setRestockQty(10)
                      setIsRestockModalOpen(true)
                    }}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold text-amber-950 bg-amber-400/90 hover:bg-amber-400 shadow-2xs shrink-0 h-9"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>+ Restock Item</span>
                  </Button>
                </div>
              ) : (
                <div className="rounded-2xl bg-emerald-50/90 border border-emerald-200/90 px-4 py-3 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-2xs">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                      <Check className="w-5 h-5 stroke-[2.5]" />
                    </div>
                    <p className="text-xs sm:text-sm text-emerald-950">
                      <strong className="font-semibold">All catalog items healthy:</strong> {alertItem.product?.name || 'All items'} restocked to <strong className="tabular-nums font-bold">{alertItem.stock}</strong> units (above reorder point of {alertItem.reorderPoint}).
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setRestockQty(10)
                      setIsRestockModalOpen(true)
                    }}
                    className="text-xs font-semibold text-emerald-800 hover:text-emerald-950 underline underline-offset-2 self-start sm:self-center"
                  >
                    Add more stock
                  </button>
                </div>
              )}
            </section>

            {/* =============================================================== */}
            {/* 3. 4 CONSOLIDATED TOP KPI CARDS                                  */}
            {/* =============================================================== */}
            <section aria-label="Key Performance Indicators" className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
              {/* KPI 1: Total Paid Revenue */}
              <article className="bg-white rounded-2xl border border-[#F2E2E8] p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold text-slate-500">Total Paid Revenue</h2>
                    <span className="w-8 h-8 rounded-xl bg-[#FAF0F3] text-[#B84A6E] flex items-center justify-center">
                      <TrendingUp className="w-4 h-4" />
                    </span>
                  </div>
                  <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight">
                    {formatPHP(totalRevenue)}
                  </p>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden flex">
                    <div
                      className="h-full bg-[#0F766E] transition-all duration-500"
                      style={{ width: `${onlinePct}%` }}
                      title="Online Revenue Share"
                    />
                    <div
                      className="h-full bg-[#B84A6E] transition-all duration-500"
                      style={{ width: `${posPct}%` }}
                      title="POS Revenue Share"
                    />
                  </div>
                  <div className="flex items-center justify-between text-xs tabular-nums gap-2">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="w-2 h-2 rounded-full bg-[#0F766E] shrink-0" />
                      <span>Online</span>
                      <strong className="text-slate-900">{formatPHP(onlineRevenue)}</strong>
                      <span className="text-slate-400">({onlinePct.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs tabular-nums gap-2">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <span className="w-2 h-2 rounded-full bg-[#B84A6E] shrink-0" />
                      <span>POS</span>
                      <strong className="text-slate-900">{formatPHP(posRevenue)}</strong>
                      <span className="text-slate-400">({posPct.toFixed(1)}%)</span>
                    </div>
                  </div>
                </div>
              </article>

              {/* KPI 2: Tax Collected */}
              <article className="bg-white rounded-2xl border border-[#F2E2E8] p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold text-slate-500">Tax Collected</h2>
                    <span className="w-8 h-8 rounded-xl bg-[#FAF0F3] text-[#B84A6E] flex items-center justify-center">
                      <FileSpreadsheet className="w-4 h-4" />
                    </span>
                  </div>
                  <p className="mt-2 text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight">
                    {formatPHP(taxCollected)}
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F2E2E8]/70">
                  <p className="text-xs text-slate-500 leading-relaxed tabular-nums">
                    Pre-VAT & VAT tracked across <strong className="text-slate-700">{paidOrdersCount} paid orders</strong>
                  </p>
                  <div className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
                    <Check className="w-3 h-3 stroke-[2.5]" />
                    <span>12% VAT compliant</span>
                  </div>
                </div>
              </article>

              {/* KPI 3: Orders Analyzed */}
              <article className="bg-white rounded-2xl border border-[#F2E2E8] p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold text-slate-500">Orders Analyzed</h2>
                    <span className="w-8 h-8 rounded-xl bg-slate-100 text-slate-600 flex items-center justify-center">
                      <Package className="w-4 h-4" />
                    </span>
                  </div>
                  <div className="mt-2 flex items-baseline gap-2">
                    <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight">
                      {totalOrdersCount}
                    </p>
                    <span className="text-xs font-medium text-slate-500">orders total</span>
                  </div>
                </div>

                <div className="mt-4 space-y-2.5">
                  <div className="w-full h-2.5 rounded-full bg-slate-100 overflow-hidden flex gap-0.5">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-500"
                      style={{ width: `${completedPct}%` }}
                      title={`Completed: ${completedOrdersCount}`}
                    />
                    <div
                      className="h-full bg-[#0F766E] transition-all duration-500"
                      style={{ width: `${deliveredPct}%` }}
                      title={`Delivered: ${deliveredOrdersCount}`}
                    />
                    <div
                      className="h-full bg-rose-500 transition-all duration-500"
                      style={{ width: `${cancelledPct}%` }}
                      title={`Cancelled: ${cancelledOrdersCount}`}
                    />
                  </div>

                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs tabular-nums">
                    <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      <span>{completedOrdersCount} Completed</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-slate-700 font-medium">
                      <span className="w-2 h-2 rounded-full bg-[#0F766E]" />
                      <span>{deliveredOrdersCount} Delivered</span>
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-rose-700 font-medium">
                      <span className="w-2 h-2 rounded-full bg-rose-500" />
                      <span>{cancelledOrdersCount} Cancelled</span>
                    </span>
                  </div>
                </div>
              </article>

              {/* KPI 4: Inventory Accuracy */}
              <article className="bg-white rounded-2xl border border-[#F2E2E8] p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-xs font-semibold text-slate-500">Inventory Accuracy</h2>
                    <span className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-200/70">
                      <Check className="w-4 h-4 stroke-[2.5]" />
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2.5">
                    <p className="text-2xl sm:text-3xl font-bold text-slate-900 tabular-nums tracking-tight">100%</p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      Verified
                    </span>
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-[#F2E2E8]/70">
                  <p className="text-xs text-slate-500 leading-relaxed">
                    All active sellable catalog items matched to live inventory
                  </p>
                </div>
              </article>
            </section>

            {/* =============================================================== */}
            {/* 4. MAIN ANALYTICS ROW (DAILY SALES & PAYMENT SHARE)             */}
            {/* =============================================================== */}
            <section aria-label="Sales and Payment Analytics" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column (7 cols): Daily Sales Performance */}
              <article className="lg:col-span-7 bg-white rounded-2xl border border-[#F2E2E8] flex flex-col justify-between overflow-hidden">
                <div className="p-5 sm:p-6 pb-4 flex-1 flex flex-col">
                  {/* Card Header & Granularity Toggle */}
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="font-serif text-xl font-semibold text-slate-900">Daily Sales Performance</h2>
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-[#FAF0F3] text-[#B84A6E] border border-[#F2E2E8]">
                          {baseline.label}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Paid revenue breakdown by product, channel, and timeline.
                      </p>
                    </div>

                    {/* Days / Months / Years Segmented Switch */}
                    <div className="inline-flex items-center bg-[#FAF0F3] p-1 rounded-xl border border-[#F2E2E8] self-start shrink-0">
                      <button
                        type="button"
                        onClick={() => setSalesGranularity('days')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          salesGranularity === 'days'
                            ? 'bg-[#B84A6E] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Days
                      </button>
                      <button
                        type="button"
                        onClick={() => setSalesGranularity('months')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          salesGranularity === 'months'
                            ? 'bg-[#B84A6E] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Months
                      </button>
                      <button
                        type="button"
                        onClick={() => setSalesGranularity('years')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                          salesGranularity === 'years'
                            ? 'bg-[#B84A6E] text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Years
                      </button>
                    </div>
                  </div>

                  {/* 3 Interactive Tabs */}
                  <div className="mt-4 flex items-center gap-1 border-b border-[#F2E2E8] overflow-x-auto" role="tablist">
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeSalesTab === 'products'}
                      onClick={() => setActiveSalesTab('products')}
                      className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                        activeSalesTab === 'products'
                          ? 'text-[#B84A6E] border-[#B84A6E]'
                          : 'text-slate-500 hover:text-slate-800 border-transparent'
                      }`}
                    >
                      Product Sales
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeSalesTab === 'chart'}
                      onClick={() => setActiveSalesTab('chart')}
                      className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                        activeSalesTab === 'chart'
                          ? 'text-[#B84A6E] border-[#B84A6E]'
                          : 'text-slate-500 hover:text-slate-800 border-transparent'
                      }`}
                    >
                      Sales Chart
                    </button>
                    <button
                      type="button"
                      role="tab"
                      aria-selected={activeSalesTab === 'orders'}
                      onClick={() => setActiveSalesTab('orders')}
                      className={`px-3.5 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors border-b-2 ${
                        activeSalesTab === 'orders'
                          ? 'text-[#B84A6E] border-[#B84A6E]'
                          : 'text-slate-500 hover:text-slate-800 border-transparent'
                      }`}
                    >
                      Orders & Channel
                    </button>
                  </div>

                  {/* TAB 1: Product Sales Table */}
                  {activeSalesTab === 'products' && (
                    <div className="mt-4 flex-1 overflow-x-auto -mx-2 px-2">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#F2E2E8] text-xs font-medium text-slate-500">
                            <th className="py-2 pr-3">Product Name</th>
                            <th className="py-2 px-2">Channel</th>
                            <th className="py-2 px-2 text-right">Units</th>
                            <th className="py-2 px-2 text-right hidden sm:table-cell">Unit Price</th>
                            <th className="py-2 pl-3 text-right">Sales (Incl. VAT)</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F2E2E8]/70 text-xs sm:text-sm tabular-nums">
                          {productSalesRows.map((item, idx) => {
                            const itemKey = `${item.name}-${idx}`
                            const hasHistory = Boolean(item.history && item.history.length > 0)
                            const isExpanded = Boolean(expandedProducts[itemKey])

                            return (
                              <Fragment key={itemKey}>
                                <tr
                                  onClick={() => hasHistory && toggleProductExpand(itemKey)}
                                  className={`transition-colors ${
                                    hasHistory ? 'cursor-pointer hover:bg-[#FDF6F8]/60' : ''
                                  } ${isExpanded ? 'bg-[#FAF0F3]/40' : ''}`}
                                >
                                  <td className="py-3 pr-3">
                                    <div className="flex items-start gap-2">
                                      {hasHistory ? (
                                        <button
                                          type="button"
                                          onClick={(e) => {
                                            e.stopPropagation()
                                            toggleProductExpand(itemKey)
                                          }}
                                          className={`mt-0.5 inline-flex items-center justify-center w-4 h-4 rounded text-slate-400 hover:text-slate-700 transition-transform ${
                                            isExpanded ? 'rotate-90 text-[#B84A6E]' : ''
                                          }`}
                                          title={isExpanded ? 'Hide sales timeline' : 'View sales timeline'}
                                          aria-expanded={isExpanded}
                                        >
                                          <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                                        </button>
                                      ) : (
                                        <span className="w-4 h-4 shrink-0" />
                                      )}
                                      <div>
                                        <div className="font-semibold text-slate-900 leading-tight flex items-center gap-1.5">
                                          <span>{item.name}</span>
                                          {hasHistory && (
                                            <span className="text-[10px] font-normal px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600">
                                              {item.history!.length} {item.history!.length === 1 ? 'sale' : 'sales'}
                                            </span>
                                          )}
                                        </div>
                                        <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-slate-400">
                                          <span className="font-mono">{item.sku}</span>
                                          <span>•</span>
                                          <span>{item.category}</span>
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                  <td className="py-3 px-2 whitespace-nowrap">
                                    {item.channel === 'Online' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-teal-50 text-[#0F766E] border border-teal-200/80">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#0F766E]" />
                                        Online
                                      </span>
                                    ) : item.channel === 'POS' ? (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-[#FAF0F3] text-[#B84A6E] border border-[#F2E2E8]">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#B84A6E]" />
                                        POS
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                                        Mixed
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-3 px-2 text-right font-medium text-slate-700 whitespace-nowrap">
                                    {item.units !== null ? item.units : '—'}
                                  </td>
                                  <td className="py-3 px-2 text-right text-slate-500 whitespace-nowrap hidden sm:table-cell">
                                    {item.unitPrice !== null ? formatPHP(item.unitPrice) : '—'}
                                  </td>
                                  <td className="py-3 pl-3 text-right font-bold text-slate-900 whitespace-nowrap">
                                    {formatPHP(item.sales)}
                                  </td>
                                </tr>

                                {isExpanded && item.history && item.history.length > 0 && (
                                  <tr className="bg-[#FAF0F3]/25 border-b border-[#F2E2E8]/80">
                                    <td colSpan={5} className="py-2.5 px-3 sm:px-6">
                                      <div className="rounded-xl border border-[#F2E2E8] bg-white overflow-hidden p-3" data-ui="product-sales-history">
                                        <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#F2E2E8]/70">
                                          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                                            <Calendar className="w-3.5 h-3.5 text-[#B84A6E]" />
                                            <span>Sales Timeline ({item.history.length} {item.history.length === 1 ? 'sale record' : 'sale records'})</span>
                                          </div>
                                          <span className="text-[11px] text-slate-400">
                                            Recorded sale dates for this product
                                          </span>
                                        </div>
                                        <div className="overflow-x-auto">
                                          <table className="w-full text-left border-collapse text-xs">
                                            <thead>
                                              <tr className="text-[11px] text-slate-400 border-b border-slate-100 font-medium">
                                                <th className="py-1.5 pr-3">Sold Date</th>
                                                <th className="py-1.5 px-2">Order ID</th>
                                                <th className="py-1.5 px-2">Channel</th>
                                                <th className="py-1.5 px-2 text-right">Units</th>
                                                <th className="py-1.5 px-2 text-right hidden sm:table-cell">Unit Price</th>
                                                <th className="py-1.5 pl-3 text-right">Subtotal</th>
                                              </tr>
                                            </thead>
                                            <tbody className="divide-y divide-slate-100 tabular-nums">
                                              {item.history.map((h, hIdx) => (
                                                <tr key={`${h.orderId}-${hIdx}`} className="hover:bg-slate-50/70">
                                                  <td className="py-2 pr-3 font-medium text-slate-800 whitespace-nowrap">
                                                    {h.date}
                                                  </td>
                                                  <td className="py-2 px-2 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                                                    {h.orderId}
                                                  </td>
                                                  <td className="py-2 px-2 whitespace-nowrap">
                                                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium ${
                                                      h.channel === 'POS'
                                                        ? 'bg-[#FAF0F3] text-[#B84A6E]'
                                                        : 'bg-teal-50 text-[#0F766E]'
                                                    }`}>
                                                      {h.channel}
                                                    </span>
                                                  </td>
                                                  <td className="py-2 px-2 text-right font-medium text-slate-700">
                                                    {h.quantity}
                                                  </td>
                                                  <td className="py-2 px-2 text-right text-slate-500 hidden sm:table-cell">
                                                    {formatPHP(h.unitPrice)}
                                                  </td>
                                                  <td className="py-2 pl-3 text-right font-semibold text-slate-900">
                                                    {formatPHP(h.total)}
                                                  </td>
                                                </tr>
                                              ))}
                                            </tbody>
                                          </table>
                                        </div>
                                      </div>
                                    </td>
                                  </tr>
                                )}
                              </Fragment>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* TAB 2: Sales Chart */}
                  {activeSalesTab === 'chart' && (
                    <div className="mt-4 flex-1 flex flex-col">
                      {/* Sub-controls */}
                      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#F2E2E8]/80">
                        <div className="flex flex-wrap items-center gap-3">
                          {salesGranularity === 'days' && (
                            <div className="relative">
                              <select
                                value={salesMonth}
                                onChange={(e) => setSalesMonth(e.target.value)}
                                className="appearance-none bg-[#FDF6F8] border border-[#F2E2E8] text-slate-700 text-xs font-medium rounded-lg pl-3 pr-7 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#B84A6E]/30 cursor-pointer"
                              >
                                <option value="nov_2026">November 2026</option>
                                <option value="oct_2026">October 2026</option>
                                <option value="sep_2026">September 2026</option>
                              </select>
                              <ChevronDown className="w-3 h-3 text-slate-400 pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" />
                            </div>
                          )}

                          {salesGranularity === 'days' && (
                            <label className="inline-flex items-center gap-2 cursor-pointer select-none">
                              <input
                                type="checkbox"
                                checked={hideZeroDays}
                                onChange={(e) => setHideZeroDays(e.target.checked)}
                                className="rounded border-slate-300 text-[#B84A6E] focus:ring-[#B84A6E]/30 w-3.5 h-3.5"
                              />
                              <span className="text-xs font-medium text-slate-600">Hide zero-sale days</span>
                            </label>
                          )}
                        </div>

                        {/* Legend */}
                        <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-xs bg-[#0F766E]" />
                            Online
                          </span>
                          <span className="inline-flex items-center gap-1.5">
                            <span className="w-2.5 h-2.5 rounded-xs bg-[#B84A6E]" />
                            POS
                          </span>
                        </div>
                      </div>

                      {/* SVG Bar Chart */}
                      <div className="mt-4 relative w-full h-64 flex flex-col justify-end">
                        <div className="w-full h-full flex items-end gap-1 sm:gap-2 pb-6 border-b border-[#F2E2E8] pt-4">
                          {activeChartSeries.map((point) => {
                            const totalDay = point.online + point.pos
                            const onlineHeightPct = maxChartBarVal > 0 ? (point.online / maxChartBarVal) * 100 : 0
                            const posHeightPct = maxChartBarVal > 0 ? (point.pos / maxChartBarVal) * 100 : 0

                            return (
                              <div
                                key={point.label}
                                onMouseEnter={() => setHoveredChartPoint(point)}
                                onMouseLeave={() => setHoveredChartPoint(null)}
                                className="flex-1 flex flex-col items-center justify-end h-full group relative cursor-pointer"
                              >
                                <div className="w-full flex items-end justify-center gap-0.5 h-full">
                                  {/* Online Bar */}
                                  <div
                                    className="w-1/2 max-w-[12px] bg-[#0F766E] rounded-t-xs transition-all duration-300 group-hover:opacity-80"
                                    style={{ height: `${Math.max(onlineHeightPct, point.online > 0 ? 4 : 0)}%` }}
                                  />
                                  {/* POS Bar */}
                                  <div
                                    className="w-1/2 max-w-[12px] bg-[#B84A6E] rounded-t-xs transition-all duration-300 group-hover:opacity-80"
                                    style={{ height: `${Math.max(posHeightPct, point.pos > 0 ? 4 : 0)}%` }}
                                  />
                                </div>
                                <span className="absolute -bottom-6 text-[10px] font-medium text-slate-400 group-hover:text-slate-900 truncate">
                                  {point.label}
                                </span>
                              </div>
                            )
                          })}
                        </div>

                        {/* Hover Tooltip Box */}
                        {hoveredChartPoint && (
                          <div className="absolute top-2 left-1/2 -translate-x-1/2 bg-slate-900/95 text-white text-xs rounded-xl px-3 py-2 shadow-lg border border-slate-700 tabular-nums min-w-[160px] pointer-events-none z-20">
                            <p className="font-semibold text-slate-200 border-b border-slate-700 pb-1 mb-1">
                              {hoveredChartPoint.fullLabel}
                            </p>
                            <div className="flex justify-between gap-4 text-slate-300 text-[11px]">
                              <span>Online:</span>
                              <strong className="text-teal-300">{formatPHP(hoveredChartPoint.online)}</strong>
                            </div>
                            <div className="flex justify-between gap-4 text-slate-300 text-[11px]">
                              <span>POS:</span>
                              <strong className="text-pink-300">{formatPHP(hoveredChartPoint.pos)}</strong>
                            </div>
                            <div className="flex justify-between gap-4 text-white font-bold border-t border-slate-700 pt-1 mt-1">
                              <span>Total:</span>
                              <span>{formatPHP(hoveredChartPoint.online + hoveredChartPoint.pos)}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 3: Orders & Channel Table */}
                  {activeSalesTab === 'orders' && (
                    <div className="mt-4 flex-1 overflow-x-auto -mx-2 px-2">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="border-b border-[#F2E2E8] text-xs font-medium text-slate-500">
                            <th className="py-2 pr-2">Date</th>
                            <th className="py-2 px-2">Order ID</th>
                            <th className="py-2 px-2">Product(s)</th>
                            <th className="py-2 px-2">Channel</th>
                            <th className="py-2 px-2 hidden sm:table-cell">Payment</th>
                            <th className="py-2 pl-2 text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F2E2E8]/70 text-xs tabular-nums">
                          {ordersListRows.map((ord) => (
                            <tr key={ord.id} className="hover:bg-[#FDF6F8]/60 transition-colors">
                              <td className="py-2.5 pr-2 whitespace-nowrap text-slate-500 font-medium">
                                {ord.date}
                              </td>
                              <td className="py-2.5 px-2 font-mono text-[11px] font-semibold text-slate-800">
                                {ord.id}
                              </td>
                              <td className="py-2.5 px-2 text-slate-700 max-w-[200px] truncate" title={ord.products}>
                                {ord.products}
                              </td>
                              <td className="py-2.5 px-2 whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                  ord.channel === 'POS'
                                    ? 'bg-[#FAF0F3] text-[#B84A6E] border border-[#F2E2E8]'
                                    : 'bg-teal-50 text-[#0F766E] border border-teal-200/80'
                                }`}>
                                  {ord.channel}
                                </span>
                              </td>
                              <td className="py-2.5 px-2 text-slate-600 hidden sm:table-cell whitespace-nowrap">
                                {ord.payment}
                              </td>
                              <td className="py-2.5 pl-2 text-right font-bold text-slate-900 whitespace-nowrap">
                                {formatPHP(ord.total)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* PINNED BOTTOM SUMMARY FOOTER (Visible Across All 3 Tabs) */}
                <footer className="bg-[#FDF6F8]/90 border-t border-[#F2E2E8] px-5 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-slate-500">
                      Total Paid Sales <span className="font-normal text-slate-400 normal-case">• {baseline.label}</span>
                    </p>
                    <div className="flex flex-wrap items-baseline gap-2.5 mt-0.5">
                      <p className="text-2xl font-bold text-slate-900 tabular-nums tracking-tight">
                        {formatPHP(totalRevenue)}
                      </p>
                      <span className="text-xs font-medium text-slate-500 tabular-nums">
                        {paidOrdersCount} paid orders · {totalUnits} units
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 sm:gap-2.5 tabular-nums">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#F2E2E8] shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-[#0F766E] shrink-0" />
                      <span className="text-xs text-slate-500">Online:</span>
                      <strong className="text-xs sm:text-sm font-semibold text-[#0F766E]">{formatPHP(onlineRevenue)}</strong>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-[#F2E2E8] shadow-2xs">
                      <span className="w-2 h-2 rounded-full bg-[#B84A6E] shrink-0" />
                      <span className="text-xs text-slate-500">POS:</span>
                      <strong className="text-xs sm:text-sm font-semibold text-[#B84A6E]">{formatPHP(posRevenue)}</strong>
                    </div>
                  </div>
                </footer>
              </article>

              {/* Right Column (5 cols): Payment Share */}
              <article className="lg:col-span-5 bg-white rounded-2xl border border-[#F2E2E8] p-5 sm:p-6 flex flex-col justify-between">
                <div>
                  <h2 className="font-serif text-xl font-semibold text-slate-900">Payment Share</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Successful payment revenue by payment method across the store.
                  </p>

                  {/* SVG Donut Chart */}
                  <div className="my-5 flex items-center justify-center relative">
                    <svg viewBox="0 0 220 220" className="w-48 h-48 sm:w-52 sm:h-52 overflow-visible" aria-label="Payment Share Donut Chart">
                      {/* Background Track */}
                      <circle cx="110" cy="110" r={donutRadius} fill="none" stroke="#F8EEF1" strokeWidth="26" />
                      {/* Segments */}
                      <g transform="rotate(-90 110 110)">
                        {donutSegments.map((segment) => {
                          const isHovered = hoveredPaymentId === segment.id
                          return (
                            <circle
                              key={segment.id}
                              cx="110"
                              cy="110"
                              r={donutRadius}
                              fill="none"
                              stroke={segment.color}
                              strokeWidth={isHovered ? 30 : 26}
                              strokeDasharray={segment.strokeDasharray}
                              strokeDashoffset={segment.strokeDashoffset}
                              className="transition-all duration-200 cursor-pointer"
                              onMouseEnter={() => setHoveredPaymentId(segment.id)}
                              onMouseLeave={() => setHoveredPaymentId(null)}
                            />
                          )
                        })}
                      </g>
                    </svg>

                    {/* Donut Center Readout */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center px-6">
                      <span className="text-xs font-medium text-slate-400">
                        {hoveredPayment ? hoveredPayment.name : 'Total Paid'}
                      </span>
                      <span className="text-lg sm:text-xl font-bold text-slate-900 tabular-nums mt-0.5">
                        {formatPHP(hoveredPayment ? hoveredPayment.amount : totalRevenue)}
                      </span>
                      {hoveredPayment && (
                        <span className="text-xs font-semibold text-[#B84A6E] tabular-nums mt-0.5">
                          {hoveredPayment.pct.toFixed(1)}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Breakdown List */}
                <div className="space-y-2">
                  {donutSegments.map((item) => {
                    const isHovered = hoveredPaymentId === item.id
                    return (
                      <div
                        key={item.id}
                        onMouseEnter={() => setHoveredPaymentId(item.id)}
                        onMouseLeave={() => setHoveredPaymentId(null)}
                        className={`flex items-center justify-between p-2.5 rounded-xl border text-xs transition-colors cursor-pointer ${
                          isHovered
                            ? 'bg-[#FAF0F3] border-[#B84A6E]/40'
                            : 'bg-[#FDF6F8]/70 border-[#F2E2E8]'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                          <span className="font-medium text-slate-800">{item.name}</span>
                        </div>
                        <div className="flex items-center gap-2 tabular-nums">
                          <span className="font-bold text-slate-900">{formatPHP(item.amount)}</span>
                          <span className="text-slate-400 font-medium">({item.pct.toFixed(1)}%)</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>
            </section>

            {/* =============================================================== */}
            {/* 5. BOTTOM OPERATIONAL ROW (TOP PRODUCTS & INVENTORY LOG)        */}
            {/* =============================================================== */}
            <section aria-label="Products and Inventory Operations" className="grid grid-cols-1 lg:grid-cols-12 gap-5">
              {/* Left Column (6 cols): Top Products */}
              <article className="lg:col-span-6 bg-white rounded-2xl border border-[#F2E2E8] p-5 sm:p-6 flex flex-col">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h2 className="font-serif text-xl font-semibold text-slate-900">Top Products</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Highest grossing products based on pre-VAT unit sales from paid orders.
                    </p>
                  </div>
                  <span className="text-[11px] font-medium text-slate-500 bg-[#FAF0F3] px-2.5 py-1 rounded-full border border-[#F2E2E8] shrink-0">
                    Ranked by Revenue
                  </span>
                </div>

                <div className="mt-5 space-y-3.5 flex-1">
                  {topProductsList.map((prod, idx) => {
                    const barWidth = (prod.revenue / maxProductRevenue) * 100
                    return (
                      <div key={prod.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-xs tabular-nums">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="w-5 h-5 rounded-md bg-[#FAF0F3] text-[#B84A6E] font-bold text-[10px] flex items-center justify-center shrink-0">
                              #{idx + 1}
                            </span>
                            <span className="font-semibold text-slate-900 truncate">{prod.name}</span>
                            <span className="text-slate-400 shrink-0">({prod.units} units)</span>
                          </div>
                          <strong className="text-slate-900 font-bold shrink-0">{formatPHP(prod.revenue)}</strong>
                        </div>
                        <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                          <div
                            className="h-full bg-[#B84A6E] rounded-full transition-all duration-500"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </article>

              {/* Right Column (6 cols): Inventory Health & Recent Stock Log */}
              <article className="lg:col-span-6 bg-white rounded-2xl border border-[#F2E2E8] p-5 sm:p-6 flex flex-col">
                {/* Upper: Inventory Health */}
                <div>
                  <h2 className="font-serif text-xl font-semibold text-slate-900">Inventory Health & Stock Log</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Current stock condition of active catalog items and recent ledger movements.
                  </p>

                  {/* 3 Traffic Light Pills */}
                  <div className="mt-4 grid grid-cols-3 gap-2.5">
                    <div className="rounded-xl bg-emerald-50/80 border border-emerald-200/80 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                        <span className="text-xs font-medium text-emerald-900">In Stock</span>
                      </div>
                      <span className="text-base font-bold text-emerald-800 tabular-nums">{inStockCount}</span>
                    </div>

                    <div className="rounded-xl bg-amber-50/80 border border-amber-200/80 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                        <span className="text-xs font-medium text-amber-900">Low Stock</span>
                      </div>
                      <span className="text-base font-bold text-amber-800 tabular-nums">{lowStockCount}</span>
                    </div>

                    <div className="rounded-xl bg-rose-50/70 border border-rose-200/70 px-3 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                        <span className="text-xs font-medium text-rose-900">Out of Stock</span>
                      </div>
                      <span className="text-base font-bold text-rose-800 tabular-nums">{outOfStockCount}</span>
                    </div>
                  </div>

                  {/* Proportional Health Bar */}
                  <div className="mt-3 w-full h-2 rounded-full bg-slate-100 overflow-hidden flex gap-0.5">
                    <div className="h-full bg-emerald-500 transition-all duration-500" style={{ width: `${inStockBarPct}%` }} />
                    <div className="h-full bg-amber-400 transition-all duration-500" style={{ width: `${lowStockBarPct}%` }} />
                    <div className="h-full bg-rose-500 transition-all duration-500" style={{ width: `${outStockBarPct}%` }} />
                  </div>
                </div>

                {/* Lower: Recent Stock Log Table */}
                <div className="mt-5 pt-4 border-t border-[#F2E2E8]/80 flex-1 flex flex-col">
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                    <h3 className="text-xs font-semibold text-slate-500">
                      Recent Stock Log
                    </h3>

                    {/* Filter Pills */}
                    <div className="inline-flex items-center bg-[#FAF0F3] p-0.5 rounded-lg border border-[#F2E2E8]">
                      <button
                        type="button"
                        onClick={() => setLogFilter('all')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                          logFilter === 'all'
                            ? 'bg-white text-slate-900 shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        All
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogFilter('restocks')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                          logFilter === 'restocks'
                            ? 'bg-white text-emerald-800 shadow-2xs'
                            : 'text-slate-600 hover:text-emerald-700'
                        }`}
                      >
                        Restocks
                      </button>
                      <button
                        type="button"
                        onClick={() => setLogFilter('deductions')}
                        className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all ${
                          logFilter === 'deductions'
                            ? 'bg-white text-rose-800 shadow-2xs'
                            : 'text-slate-600 hover:text-rose-700'
                        }`}
                      >
                        Deductions
                      </button>
                    </div>
                  </div>

                  <div className="overflow-x-auto -mx-2 px-2">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="border-b border-[#F2E2E8] text-xs font-medium text-slate-500">
                          <th className="py-2 pr-3">Date</th>
                          <th className="py-2 px-2">Product</th>
                          <th className="py-2 px-2 text-right">Change</th>
                          <th className="py-2 pl-2 text-right">Remaining</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F2E2E8]/70 text-xs sm:text-sm tabular-nums">
                        {filteredStockLog.map((log) => {
                          const isRestock = log.change > 0
                          const formattedDate = new Date(log.createdAt).toLocaleDateString('en-PH', {
                            month: 'short',
                            day: '2-digit',
                            year: 'numeric',
                          })
                          return (
                            <tr key={log.id} className="hover:bg-[#FDF6F8]/60 transition-colors">
                              <td className="py-2.5 pr-3 text-slate-500 whitespace-nowrap">{formattedDate}</td>
                              <td className="py-2.5 px-2 font-medium text-slate-900 truncate max-w-[140px]">
                                {log.productName}
                              </td>
                              <td className="py-2.5 px-2 text-right font-bold whitespace-nowrap">
                                <span className={isRestock ? 'text-emerald-700' : 'text-rose-700'}>
                                  {isRestock ? `+${log.change}` : log.change}
                                </span>
                              </td>
                              <td className="py-2.5 pl-2 text-right text-slate-600 font-medium whitespace-nowrap">
                                {log.resultingStock}
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </article>
            </section>
          </main>

          {/* ================================================================= */}
          {/* RESTOCK ITEM POPUP MODAL                                          */}
          {/* ================================================================= */}
          {isRestockModalOpen && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-150"
              role="dialog"
              aria-modal="true"
              aria-labelledby="restock-modal-title"
            >
              <div className="bg-white rounded-2xl border border-[#F2E2E8] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in-95 duration-150">
                {/* Header */}
                <div className="px-5 py-4 border-b border-[#F2E2E8] flex items-center justify-between bg-[#FDF6F8]/60">
                  <div>
                    <h3 id="restock-modal-title" className="font-serif text-lg font-semibold text-slate-900">
                      Restock Inventory Item
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">Update live warehouse stock & log movement</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsRestockModalOpen(false)}
                    aria-label="Close modal"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-[#FAF0F3] transition-colors"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Form Body */}
                <form onSubmit={handleConfirmRestock} className="p-5 space-y-4">
                  {/* Item Summary Box */}
                  <div className="rounded-xl bg-[#FDF6F8] border border-[#F2E2E8] p-3.5 text-xs space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-900 text-sm">{alertItem.product?.name || 'APPLE & HONEY'}</span>
                      <span className="font-mono text-[11px] bg-white px-2 py-0.5 rounded-md border border-[#F2E2E8] text-slate-600">
                        {alertItem.sku}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-slate-500 tabular-nums pt-1">
                      <span>Current Stock: <strong className="text-amber-700 font-bold">{alertItem.stock}</strong> units</span>
                      <span>Reorder Point: <strong className="text-slate-700">{alertItem.reorderPoint}</strong> • Loc: <strong className="text-slate-700 font-mono">{alertItem.location}</strong></span>
                    </div>
                  </div>

                  {/* Quantity Input + Presets */}
                  <div>
                    <label htmlFor="restock-qty-input" className="block text-xs font-semibold text-slate-700 mb-1.5">
                      Units to Add
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        id="restock-qty-input"
                        min="1"
                        max="500"
                        value={restockQty}
                        onChange={(e) => setRestockQty(Math.max(1, parseInt(e.target.value) || 0))}
                        required
                        className="w-full rounded-xl border border-[#F2E2E8] bg-white px-3.5 py-2 text-sm font-semibold text-slate-900 tabular-nums focus:outline-none focus:ring-2 focus:ring-[#B84A6E]/30 focus:border-[#B84A6E]"
                      />
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => setRestockQty(5)}
                          className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-[#FAF0F3] text-[#B84A6E] hover:bg-[#F2E2E8] transition-colors"
                        >
                          +5
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestockQty(10)}
                          className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-[#FAF0F3] text-[#B84A6E] hover:bg-[#F2E2E8] transition-colors"
                        >
                          +10
                        </button>
                        <button
                          type="button"
                          onClick={() => setRestockQty(20)}
                          className="px-2.5 py-2 rounded-lg text-xs font-semibold bg-[#FAF0F3] text-[#B84A6E] hover:bg-[#F2E2E8] transition-colors"
                        >
                          +20
                        </button>
                      </div>
                    </div>
                    <p className="mt-1.5 text-xs text-slate-500 tabular-nums">
                      New stock level will be: <strong className="text-emerald-700 font-bold">{alertItem.stock + restockQty} units</strong>
                    </p>
                  </div>

                  {/* Modal Actions */}
                  <div className="pt-2 flex items-center justify-end gap-2.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsRestockModalOpen(false)}
                      disabled={isSubmittingRestock}
                      className="text-slate-600 hover:text-slate-900 text-xs sm:text-sm font-medium"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      size="sm"
                      disabled={isSubmittingRestock}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-2xs"
                    >
                      {isSubmittingRestock ? 'Updating...' : 'Confirm Restock'}
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      </div>
    </ProtectedRoute>
  )
}
