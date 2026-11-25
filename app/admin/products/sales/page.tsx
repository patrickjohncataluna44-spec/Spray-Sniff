'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import {
  ArrowLeft,
  ArrowUpRight,
  Boxes,
  Edit,
  ExternalLink,
  Layers,
  Package,
  ReceiptText,
  Search,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Trophy,
} from 'lucide-react'
import { AdminSidebar } from '@/components/admin-sidebar'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { formatPHP } from '@/lib/currency'
import { useAuth } from '@/lib/auth-context'
import { useStore } from '@/lib/store-context'
import type { Product } from '@/lib/products'

type TimeframeFilter = 'all' | 'month' | 'last30' | 'last7'
type ChannelFilter = 'all' | 'online' | 'pos'
type SortField = 'revenue' | 'units' | 'stock' | 'name'

export default function ProductSalesPage() {
  const { user } = useAuth()
  const { catalog, getAvailableStock, getAvailabilityStatus, orders } = useStore()

  const [timeframe, setTimeframe] = useState<TimeframeFilter>('all')
  const [channel, setChannel] = useState<ChannelFilter>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [sortBy, setSortBy] = useState<SortField>('revenue')

  // Filter orders based on timeframe and channel, excluding cancelled orders
  const filteredOrders = useMemo(() => {
    const now = new Date()
    const thisYear = now.getFullYear()
    const thisMonth = now.getMonth()

    return orders.filter((order) => {
      if (order.status === 'Cancelled') return false

      if (channel === 'online' && order.source !== 'ONLINE') return false
      if (channel === 'pos' && order.source !== 'POS') return false

      const orderDate = new Date(order.createdAt)
      if (isNaN(orderDate.getTime())) return true

      if (timeframe === 'month') {
        return orderDate.getFullYear() === thisYear && orderDate.getMonth() === thisMonth
      }
      if (timeframe === 'last30') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
        return orderDate >= thirtyDaysAgo
      }
      if (timeframe === 'last7') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
        return orderDate >= sevenDaysAgo
      }

      return true
    })
  }, [orders, timeframe, channel])

  // Aggregate product sales
  const productSalesList = useMemo(() => {
    const salesMap = new Map<
      string,
      {
        revenue: number
        unitsSold: number
        ordersCount: number
        onlineUnits: number
        posUnits: number
      }
    >()

    filteredOrders.forEach((order) => {
      order.items?.forEach((item) => {
        if (!item.productId) return
        const existing = salesMap.get(item.productId) || {
          revenue: 0,
          unitsSold: 0,
          ordersCount: 0,
          onlineUnits: 0,
          posUnits: 0,
        }

        const qty = item.quantity || 1
        const lineTotal = (item.unitPrice || 0) * qty

        existing.revenue += lineTotal
        existing.unitsSold += qty
        existing.ordersCount += 1
        if (order.source === 'ONLINE') {
          existing.onlineUnits += qty
        } else {
          existing.posUnits += qty
        }

        salesMap.set(item.productId, existing)
      })
    })

    // Compute total sales across all catalog products to calculate percentage share
    let totalGrossRevenue = 0
    salesMap.forEach((v) => {
      totalGrossRevenue += v.revenue
    })

    return catalog.map((product) => {
      const stats = salesMap.get(product.id) || {
        revenue: 0,
        unitsSold: 0,
        ordersCount: 0,
        onlineUnits: 0,
        posUnits: 0,
      }

      const sharePercent =
        totalGrossRevenue > 0
          ? Math.round((stats.revenue / totalGrossRevenue) * 100)
          : 0

      const availableStock = getAvailableStock(product.id)
      const stockStatus = getAvailabilityStatus(product.id)

      return {
        product,
        revenue: stats.revenue,
        unitsSold: stats.unitsSold,
        ordersCount: stats.ordersCount,
        onlineUnits: stats.onlineUnits,
        posUnits: stats.posUnits,
        sharePercent,
        stock: availableStock,
        stockStatus,
      }
    })
  }, [catalog, filteredOrders, getAvailableStock, getAvailabilityStatus])
  

  // Search and Sort
  const processedProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase()
    let list = productSalesList.filter(({ product }) => {
      if (!q) return true
      return (
        product.name.toLowerCase().includes(q) ||
        product.brand.toLowerCase().includes(q) ||
        product.category.toLowerCase().includes(q)
      )
    })

    list.sort((a, b) => {
      if (sortBy === 'revenue') return b.revenue - a.revenue
      if (sortBy === 'units') return b.unitsSold - a.unitsSold
      if (sortBy === 'stock') return b.stock - a.stock
      if (sortBy === 'name') return a.product.name.localeCompare(b.product.name)
      return 0
    })

    return list
  }, [productSalesList, searchQuery, sortBy])

  // High-level KPIs
  const totalRevenue = useMemo(
    () => productSalesList.reduce((acc, p) => acc + p.revenue, 0),
    [productSalesList],
  )
  const totalUnits = useMemo(
    () => productSalesList.reduce((acc, p) => acc + p.unitsSold, 0),
    [productSalesList],
  )
  const topProduct = useMemo(() => {
    const sorted = [...productSalesList].sort((a, b) => b.revenue - a.revenue)
    return sorted.length > 0 && sorted[0].revenue > 0 ? sorted[0] : null
  }, [productSalesList])

  const top3Podium = useMemo(() => {
    return [...productSalesList]
      .filter((p) => p.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)
  }, [productSalesList])

  const onlineUnitsTotal = useMemo(
    () => productSalesList.reduce((acc, p) => acc + p.onlineUnits, 0),
    [productSalesList],
  )
  const posUnitsTotal = useMemo(
    () => productSalesList.reduce((acc, p) => acc + p.posUnits, 0),
    [productSalesList],
  )

  return (
    <ProtectedRoute requiredRole={['ADMIN', 'STAFF']}>
      <div className="flex min-h-[100dvh] bg-[#F7F5F6]">
        <AdminSidebar />

        <div className="flex-1 overflow-x-hidden">
          {/* Header */}
          <header className="border-b border-[#EBE6E8] bg-white">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <div className="mb-4 flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin/dashboard" className="flex items-center gap-2 text-[#5C4A52] hover:text-[#2D1B22]">
                    <ArrowLeft className="h-4 w-4" />
                    Back to Dashboard
                  </Link>
                </Button>
              </div>

              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h1 className="font-serif text-3xl font-bold text-[#2D1B22]">
                    Product Sales & Top Performers
                  </h1>
                  <p className="mt-1 text-sm text-[#7D6B73]">
                    Live revenue rankings, units sold, and channel volume across all studio fragrances.
                  </p>
                </div>

                <div className="flex items-center gap-2.5">
                  <Button variant="outline" size="sm" asChild className="border-[#E0D5D9] text-[#2D1B22] hover:bg-[#F9F5F6]">
                    <Link href="/admin/inventory" className="flex items-center gap-1.5">
                      <Boxes className="w-4 h-4 text-[#8A223B]" />
                      <span>Manage Stock</span>
                    </Link>
                  </Button>
                  <Button size="sm" asChild className="bg-[#8A223B] hover:bg-[#521323] text-white">
                    <Link href="/admin/products/new" className="flex items-center gap-1.5">
                      <Package className="w-4 h-4" />
                      <span>Add Product</span>
                    </Link>
                  </Button>
                </div>
              </div>

              {/* Navigation Tabs between Catalog and Sales */}
              <div className="mt-6 flex items-center gap-6 border-b border-[#EBE6E8]">
                <Link
                  href="/admin/products"
                  className="border-b-2 border-transparent pb-3 text-sm font-medium text-[#7D6B73] hover:text-[#2D1B22] transition-colors"
                >
                  Catalog & Stock
                </Link>
                <Link
                  href="/admin/products/sales"
                  className="border-b-2 border-[#8A223B] pb-3 text-sm font-semibold text-[#8A223B]"
                >
                  Sales Performance & Rankings
                </Link>
              </div>
            </div>
          </header>

          {/* Main Body */}
          <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-6">
            {/* KPI Summary Cards */}
            <section data-ui="sales-kpi-summary" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* 1. Top Seller */}
              <div className="bg-white rounded-2xl border border-[#EBE6E8] p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-[#7D6B73]">
                  <span>#1 Best Seller</span>
                  <Trophy className="w-4 h-4 text-amber-600" />
                </div>
                <div className="mt-3">
                  <p className="font-serif text-lg font-bold text-[#2D1B22] truncate">
                    {topProduct?.product.name || 'No sales yet'}
                  </p>
                  <p className="text-xs text-[#8A223B] font-semibold mt-0.5 tabular-nums">
                    {topProduct ? formatPHP(topProduct.revenue) : '₱0.00'}
                  </p>
                </div>
                <p className="text-[11px] text-[#8E7881] mt-2">
                  {topProduct ? `${topProduct.unitsSold} bottles sold` : 'Waiting for first order'}
                </p>
              </div>

              {/* 2. Total Revenue */}
              <div className="bg-white rounded-2xl border border-[#EBE6E8] p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-[#7D6B73]">
                  <span>Gross Sales Volume</span>
                  <TrendingUp className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="mt-3">
                  <p className="font-serif text-2xl font-bold text-[#2D1B22] tabular-nums">
                    {formatPHP(totalRevenue)}
                  </p>
                </div>
                <p className="text-[11px] text-[#8E7881] mt-2">
                  From {filteredOrders.length} non-cancelled orders
                </p>
              </div>

              {/* 3. Bottles Sold */}
              <div className="bg-white rounded-2xl border border-[#EBE6E8] p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-[#7D6B73]">
                  <span>Bottles Sold</span>
                  <Package className="w-4 h-4 text-[#8A223B]" />
                </div>
                <div className="mt-3">
                  <p className="font-serif text-2xl font-bold text-[#2D1B22] tabular-nums">
                    {totalUnits}
                  </p>
                </div>
                <p className="text-[11px] text-[#8E7881] mt-2">
                  Across all catalog perfumes
                </p>
              </div>

              {/* 4. Channel Split */}
              <div className="bg-white rounded-2xl border border-[#EBE6E8] p-5 flex flex-col justify-between">
                <div className="flex items-center justify-between text-xs text-[#7D6B73]">
                  <span>Channel Breakdown</span>
                  <Layers className="w-4 h-4 text-[#5C4A52]" />
                </div>
                <div className="mt-2 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-[#5C4A52]">
                      <ShoppingCart className="w-3 h-3 text-[#8A223B]" /> Online:
                    </span>
                    <span className="font-semibold text-[#2D1B22] tabular-nums">{onlineUnitsTotal} units</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1 text-[#5C4A52]">
                      <ReceiptText className="w-3 h-3 text-[#A05E1A]" /> POS Walk-in:
                    </span>
                    <span className="font-semibold text-[#2D1B22] tabular-nums">{posUnitsTotal} units</span>
                  </div>
                </div>
                <p className="text-[11px] text-[#8E7881] mt-1">
                  {totalUnits > 0 ? `${Math.round((onlineUnitsTotal / totalUnits) * 100)}% online / ${Math.round((posUnitsTotal / totalUnits) * 100)}% POS` : 'No channel volume'}
                </p>
              </div>
            </section>

            {/* Top 3 Best Sellers Podium Cards */}
            {top3Podium.length > 0 && (
              <section data-ui="top-3-podium">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="font-serif text-lg font-bold text-[#2D1B22] flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#8A223B]" />
                    <span>Top Studio Performers</span>
                  </h2>
                  <span className="text-xs text-[#8E7881]">Ranked by total revenue</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {top3Podium.map(({ product, revenue, unitsSold, sharePercent, stock }, idx) => {
                    const rankColors = [
                      { badge: 'bg-[#4A1521] text-white', border: 'border-[#4A1521]/20', label: '#1 Top Fragrance' },
                      { badge: 'bg-[#6B2032] text-white', border: 'border-[#EBE6E8]', label: '#2 Best Performer' },
                      { badge: 'bg-[#8A223B] text-white', border: 'border-[#EBE6E8]', label: '#3 Best Performer' },
                    ]
                    const currentRank = rankColors[idx] || rankColors[2]

                    return (
                      <div
                        key={product.id}
                        className={`bg-white rounded-2xl border ${currentRank.border} p-5 flex flex-col justify-between transition-colors`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-3">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${currentRank.badge}`}>
                              {currentRank.label}
                            </span>
                            <span className="text-xs font-bold text-[#8A223B] tabular-nums">
                              {sharePercent}% of sales
                            </span>
                          </div>

                          <div className="flex items-center gap-3.5 mb-4">
                            <div className="w-14 h-14 rounded-xl overflow-hidden bg-[#FBF7F8] border border-[#EFEAE6] shrink-0 p-1 flex items-center justify-center">
                              <Image
                                src={product.images?.[0] || '/products/velvet-petals-1.jpg'}
                                alt={product.name}
                                width={52}
                                height={52}
                                className="object-contain w-full h-full"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="font-serif text-base font-bold text-[#2D1B22] truncate">
                                {product.name}
                              </p>
                              <p className="text-xs text-[#8E7881]">{product.brand}</p>
                              <p className="text-xs font-bold text-[#2D1B22] tabular-nums mt-1">
                                {formatPHP(revenue)}
                              </p>
                            </div>
                          </div>

                          <div className="space-y-1.5 pt-2 border-t border-[#F3ECEE] text-xs">
                            <div className="flex items-center justify-between text-[#5C4A52]">
                              <span>Units Sold:</span>
                              <span className="font-semibold text-[#2D1B22] tabular-nums">{unitsSold} bottles</span>
                            </div>
                            <div className="flex items-center justify-between text-[#5C4A52]">
                              <span>On-Hand Stock:</span>
                              <span className={`font-semibold tabular-nums ${stock <= 5 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                {stock} available
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="pt-4 mt-4 border-t border-[#F3ECEE] flex items-center justify-between gap-2">
                          <Button variant="ghost" size="sm" asChild className="text-xs text-[#8A223B] hover:text-[#521323] p-0 h-auto">
                            <Link href={`/admin/products/${encodeURIComponent(product.id)}`} className="flex items-center gap-1">
                              <span>Edit Product</span>
                              <ArrowUpRight className="w-3.5 h-3.5" />
                            </Link>
                          </Button>
                          <Button variant="ghost" size="sm" asChild className="text-xs text-[#7D6B73] hover:text-[#2D1B22] p-0 h-auto">
                            <Link href="/admin/inventory">
                              <span>Restock</span>
                            </Link>
                          </Button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* Filters Bar */}
            <section data-ui="sales-filters" className="flex flex-wrap items-center justify-between gap-4 bg-white rounded-2xl border border-[#EBE6E8] p-4">
              <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8E7881]" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search fragrance by name, brand, notes..."
                    className="w-full pl-9 pr-3 py-1.5 text-xs rounded-xl bg-[#F7F5F6] border border-[#EAE4E6] text-[#2D1B22] placeholder:text-[#8E7881] focus:outline-none focus:ring-1 focus:ring-[#8A223B]"
                  />
                </div>

                {/* Timeframe */}
                <select
                  value={timeframe}
                  onChange={(e) => setTimeframe(e.target.value as TimeframeFilter)}
                  className="text-xs font-medium text-[#5C4A52] bg-[#F7F5F6] border border-[#EAE4E6] rounded-xl px-3 py-2 focus:outline-none"
                >
                  <option value="all">All Time Sales</option>
                  <option value="month">This Month</option>
                  <option value="last30">Last 30 Days</option>
                  <option value="last7">Last 7 Days</option>
                </select>

                {/* Channel */}
                <select
                  value={channel}
                  onChange={(e) => setChannel(e.target.value as ChannelFilter)}
                  className="text-xs font-medium text-[#5C4A52] bg-[#F7F5F6] border border-[#EAE4E6] rounded-xl px-3 py-2 focus:outline-none"
                >
                  <option value="all">All Channels</option>
                  <option value="online">Online Orders</option>
                  <option value="pos">POS Walk-in</option>
                </select>
              </div>

              {/* Sort by */}
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8E7881]">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortField)}
                  className="text-xs font-medium text-[#5C4A52] bg-[#F7F5F6] border border-[#EAE4E6] rounded-xl px-3 py-2 focus:outline-none"
                >
                  <option value="revenue">Highest Revenue</option>
                  <option value="units">Most Bottles Sold</option>
                  <option value="stock">On-Hand Stock</option>
                  <option value="name">Fragrance Name</option>
                </select>
              </div>
            </section>

            {/* Complete Product Sales Table */}
            <section data-ui="sales-table-card" className="bg-white rounded-2xl border border-[#EBE6E8] overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-[#FAF7F8] border-b border-[#EBE6E8] text-[#7D6B73] font-medium">
                    <tr>
                      <th className="px-5 py-3.5 w-12 text-center">#</th>
                      <th className="px-5 py-3.5">Fragrance Product</th>
                      <th className="px-5 py-3.5">Category</th>
                      <th className="px-5 py-3.5 text-center">Channels</th>
                      <th className="px-5 py-3.5 text-right">Bottles Sold</th>
                      <th className="px-5 py-3.5 text-right">Revenue</th>
                      <th className="px-5 py-3.5 text-right">Share</th>
                      <th className="px-5 py-3.5 text-center">Inventory</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-[#F3ECEE]">
                    {processedProducts.length > 0 ? (
                      processedProducts.map(({ product, revenue, unitsSold, onlineUnits, posUnits, sharePercent, stock, stockStatus }, idx) => {
                        const rank = idx + 1

                        return (
                          <tr key={product.id} className="hover:bg-[#FAF7F8]/80 transition-colors">
                            {/* Rank */}
                            <td className="px-5 py-4 text-center font-bold text-[#8E7881] tabular-nums">
                              {rank <= 3 ? (
                                <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-[11px] font-bold ${
                                  rank === 1
                                    ? 'bg-[#4A1521] text-white'
                                    : rank === 2
                                      ? 'bg-[#7D2338] text-white'
                                      : 'bg-[#A03048] text-white'
                                }`}>
                                  {rank}
                                </span>
                              ) : (
                                rank
                              )}
                            </td>

                            {/* Fragrance Details */}
                            <td className="px-5 py-4">
                              <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-xl overflow-hidden bg-[#FBF7F8] border border-[#EFEAE6] shrink-0 p-1 flex items-center justify-center">
                                  <Image
                                    src={product.images?.[0] || '/products/velvet-petals-1.jpg'}
                                    alt={product.name}
                                    width={36}
                                    height={36}
                                    className="object-contain w-full h-full"
                                  />
                                </div>
                                <div className="min-w-0 max-w-[200px]">
                                  <Link
                                    href={`/admin/products/${encodeURIComponent(product.id)}`}
                                    className="font-semibold text-[#2D1B22] hover:text-[#8A223B] transition-colors truncate block"
                                  >
                                    {product.name}
                                  </Link>
                                  <p className="text-[11px] text-[#8E7881] truncate">{product.brand}</p>
                                </div>
                              </div>
                            </td>

                            {/* Category */}
                            <td className="px-5 py-4 text-[#5C4A52]">
                              {product.category || 'Eau de Parfum'}
                            </td>

                            {/* Channel Breakdown */}
                            <td className="px-5 py-4 text-center">
                              <div className="inline-flex items-center gap-1.5 text-[10px]">
                                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-[#8A223B] font-semibold" title={`${onlineUnits} online units`}>
                                  {onlineUnits} web
                                </span>
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 font-semibold" title={`${posUnits} POS units`}>
                                  {posUnits} pos
                                </span>
                              </div>
                            </td>

                            {/* Units Sold */}
                            <td className="px-5 py-4 text-right">
                              <span className="font-bold text-[#2D1B22] tabular-nums">
                                {unitsSold}
                              </span>
                              <span className="text-[10px] text-[#8E7881] block">bottles</span>
                            </td>

                            {/* Revenue */}
                            <td className="px-5 py-4 text-right font-bold text-[#2D1B22] tabular-nums text-sm">
                              {formatPHP(revenue)}
                            </td>

                            {/* Share % */}
                            <td className="px-5 py-4 text-right font-medium text-[#5C4A52] tabular-nums">
                              {sharePercent}%
                            </td>

                            {/* Inventory */}
                            <td className="px-5 py-4 text-center">
                              <span
                                className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-semibold ${
                                  stock === 0
                                    ? 'bg-rose-100 text-rose-800'
                                    : stock <= 5
                                      ? 'bg-amber-100 text-amber-800'
                                      : 'bg-emerald-100 text-emerald-800'
                                }`}
                              >
                                {stock} on hand
                              </span>
                            </td>

                            {/* Actions */}
                            <td className="px-5 py-4 text-right">
                              <div className="flex items-center justify-end gap-2">
                                <Button variant="ghost" size="sm" asChild className="h-7 px-2 text-xs text-[#8A223B] hover:text-[#521323]">
                                  <Link href={`/admin/products/${encodeURIComponent(product.id)}`}>
                                    <Edit className="w-3.5 h-3.5 mr-1" />
                                    <span>Edit</span>
                                  </Link>
                                </Button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan={9} className="py-12 text-center text-[#8E7881]">
                          <p className="font-serif text-base text-[#2D1B22]">No fragrances found</p>
                          <p className="text-xs mt-1">Try adjusting your search query or timeframe filter.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  )
}
