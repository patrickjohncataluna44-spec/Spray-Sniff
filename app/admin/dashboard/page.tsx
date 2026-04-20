'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import {
  AlertTriangle,
  BarChart3,
  Boxes,
  ReceiptText,
  ShoppingCart,
} from 'lucide-react'
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, XAxis, YAxis } from 'recharts'
import { Button } from '@/components/ui/button'
import { ProtectedRoute } from '@/components/protected-route'
import { AdminSidebar } from '@/components/admin-sidebar'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  buildChannelMixData,
  buildInventoryHealthData,
  buildSalesTrendData,
  isSuccessfulPaymentOrder,
} from '@/lib/analytics'
import { formatPHP } from '@/lib/currency'
import { useAuth } from '@/lib/auth-context'
import { useStore } from '@/lib/store-context'

const salesTrendConfig = {
  online: {
    label: 'Online',
    color: '#dd729b',
  },
  pos: {
    label: 'POS',
    color: '#f2a7c0',
  },
} satisfies ChartConfig

const channelMixColors = ['#dd729b', '#f2a7c0']
const inventoryHealthColors = ['#e888a8', '#f2b5c8', '#9e4c6d']

export default function AdminDashboard() {
  const { isAdmin, user } = useAuth()
  const { inventory, isRealtimeRefreshing, lastSyncedAt, orders, posTransactions } = useStore()
  const isStaffView = user?.role === 'STAFF'
  const successfulPayments = useMemo(
    () => orders.filter(isSuccessfulPaymentOrder),
    [orders],
  )
  const activeInventory = useMemo(
    () => inventory.filter((item) => !item.isArchived),
    [inventory],
  )
  const todayKey = new Date().toDateString()

  const totalRevenue = successfulPayments.reduce((sum, order) => sum + order.total, 0)
  const totalTax = successfulPayments.reduce((sum, order) => sum + order.tax, 0)
  const successfulPaymentCount = successfulPayments.length
  const todayRevenue = successfulPayments
    .filter((order) => new Date(order.createdAt).toDateString() === todayKey)
    .reduce((sum, order) => sum + order.total, 0)
  const pendingPaymentOrders = orders.filter((order) => order.paymentStatus !== 'Paid')
  const lowStockCount = activeInventory.filter(
    (item) => item.stock > 0 && item.stock <= item.reorderPoint,
  ).length
  const outOfStockCount = activeInventory.filter((item) => item.stock === 0).length
  const openOnlineOrders = orders.filter(
    (order) => order.source === 'ONLINE' && order.status !== 'Delivered',
  ).length
  const fulfillmentQueueCount = orders.filter(
    (order) =>
      order.source === 'ONLINE' &&
      ['Pending', 'Processing', 'Ready for Dispatch'].includes(order.status),
  ).length
  const todayPosTransactions = posTransactions.filter(
    (transaction) => new Date(transaction.createdAt).toDateString() === todayKey,
  )
  const todayPosRevenue = todayPosTransactions.reduce(
    (sum, transaction) => sum + transaction.total,
    0,
  )
  const recentOrders = [...orders]
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .slice(0, 5)
  const recentOperationalOrders = [...orders]
    .filter((order) => order.source === 'ONLINE' && order.status !== 'Delivered')
    .sort(
      (left, right) =>
        new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
    )
    .slice(0, 5)
  const recentTransactions = posTransactions.slice(0, 4)
  const salesTrendData = useMemo(() => buildSalesTrendData(orders, 7), [orders])
  const channelMixData = useMemo(
    () => buildChannelMixData(orders).filter((entry) => entry.value > 0),
    [orders],
  )
  const inventoryHealthData = useMemo(
    () => buildInventoryHealthData(activeInventory),
    [activeInventory],
  )
  const highlightedOrders = isStaffView ? recentOperationalOrders : recentOrders
  const lastSyncLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString('en-PH', {
        hour: 'numeric',
        minute: '2-digit',
        second: '2-digit',
      })
    : 'Waiting for first sync'

  const stats = isStaffView
    ? [
        {
          label: 'Open Online Orders',
          value: openOnlineOrders.toString(),
          caption: `${fulfillmentQueueCount} currently need fulfillment`,
          icon: ShoppingCart,
        },
        {
          label: 'Today POS Sales',
          value: todayPosTransactions.length.toString(),
          caption: `${formatPHP(todayPosRevenue)} processed in store today`,
          icon: ReceiptText,
        },
        {
          label: 'Low Stock Alerts',
          value: lowStockCount.toString(),
          caption: `${outOfStockCount} items are fully out of stock`,
          icon: AlertTriangle,
        },
        {
          label: 'Active Inventory',
          value: activeInventory.length.toString(),
          caption: 'Shared across storefront and POS availability',
          icon: Boxes,
        },
      ]
    : [
        {
          label: 'Paid Revenue',
          value: formatPHP(totalRevenue),
          caption: 'Successful online and POS payments only',
          icon: BarChart3,
        },
        {
          label: 'Today Revenue',
          value: formatPHP(todayRevenue),
          caption: `${successfulPaymentCount} successful payment(s) recorded`,
          icon: ReceiptText,
        },
        {
          label: 'Pending Payments',
          value: pendingPaymentOrders.length.toString(),
          caption: 'Orders still waiting for payment collection',
          icon: ShoppingCart,
        },
        {
          label: 'Tax Collected',
          value: formatPHP(totalTax),
          caption: 'Collected from successful payments',
          icon: BarChart3,
        },
        {
          label: 'Inventory Alerts',
          value: `${lowStockCount + outOfStockCount}`,
          caption: `${lowStockCount} low stock, ${outOfStockCount} out of stock`,
          icon: AlertTriangle,
        },
      ]

  return (
    <ProtectedRoute requiredRole={['ADMIN', 'STAFF']}>
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <div className="flex-1">
          <div className="border-b border-border bg-card">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-foreground/50">
                    {isStaffView ? 'Staff Operations' : 'Store Intelligence'}
                  </p>
                  <h1 className="font-serif text-3xl text-foreground">
                    {isStaffView ? 'Operations Dashboard' : 'Dashboard'}
                  </h1>
                  <p className="mt-2 text-sm text-foreground/60">
                    {isStaffView
                      ? 'Today’s fulfillment queue, low-stock items, and in-store activity from the shared store dataset.'
                      : 'Real-time inventory, transaction, and availability tracking from the same store dataset.'}
                  </p>
                  <div className="mt-4 inline-flex items-center gap-3 rounded-full border border-border bg-background px-4 py-2 text-xs text-foreground/65">
                    <span
                      className={`h-2.5 w-2.5 rounded-full ${
                        isRealtimeRefreshing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
                      }`}
                    />
                    <span>
                      {isRealtimeRefreshing
                        ? 'Syncing live admin data...'
                        : `Live from Supabase. Last sync ${lastSyncLabel}.`}
                    </span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href="/admin/pos">Open POS</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href={isStaffView ? '/admin/orders' : '/admin/inventory'}>
                      {isStaffView ? 'Review Orders' : 'Review Inventory'}
                    </Link>
                  </Button>
                  {isAdmin && (
                    <Button variant="outline" asChild>
                      <Link href="/admin/reports">View Reports</Link>
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6 mb-10">
              {stats.map((stat) => {
                const Icon = stat.icon
                return (
                  <div key={stat.label} className="rounded-2xl border border-border bg-card p-6">
                    <div className="flex items-center justify-between mb-4">
                      <p className="text-sm font-medium text-foreground/60">{stat.label}</p>
                      <Icon className="w-5 h-5 text-accent" />
                    </div>
                    <p className="font-serif text-3xl text-foreground mb-2">{stat.value}</p>
                    <p className="text-xs text-foreground/50">{stat.caption}</p>
                  </div>
                )
              })}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-8 mb-10">
              <section className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-6">
                  <h2 className="font-serif text-2xl text-foreground">7-Day Sales Trend</h2>
                  <p className="mt-2 text-sm text-foreground/60">
                    {isStaffView
                      ? 'Daily activity split between online orders and POS transactions.'
                      : 'Daily paid revenue split between online orders and POS transactions.'}
                  </p>
                </div>

                <ChartContainer config={salesTrendConfig} className="h-[300px] w-full">
                  <BarChart data={salesTrendData}>
                    <CartesianGrid vertical={false} />
                    <XAxis
                      dataKey="label"
                      tickLine={false}
                      axisLine={false}
                      tickMargin={8}
                    />
                    <YAxis
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `P${Math.round(value / 1000)}k`}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          indicator="dot"
                          formatter={(value, name) => (
                            <div className="flex w-full items-center justify-between gap-6">
                              <span className="text-muted-foreground">{String(name)}</span>
                              <span className="font-medium text-foreground">
                                {formatPHP(Number(value))}
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <ChartLegend content={<ChartLegendContent />} />
                    <Bar
                      dataKey="online"
                      stackId="sales"
                      fill="var(--color-online)"
                      radius={[6, 6, 0, 0]}
                    />
                    <Bar
                      dataKey="pos"
                      stackId="sales"
                      fill="var(--color-pos)"
                      radius={[6, 6, 0, 0]}
                    />
                  </BarChart>
                </ChartContainer>
              </section>

              <section className="rounded-2xl border border-border bg-card p-6">
                <div className="mb-6">
                  <h2 className="font-serif text-2xl text-foreground">
                    {isStaffView ? 'Channel Activity' : 'Sales Mix'}
                  </h2>
                  <p className="mt-2 text-sm text-foreground/60">
                    {isStaffView
                      ? 'Quick view of how the store is moving across online and POS.'
                      : 'Quick view of where successful payment revenue is coming from right now.'}
                  </p>
                </div>

                <div className="grid gap-8">
                  <ChartContainer
                    config={{
                      online: { label: 'Online', color: '#dd729b' },
                      pos: { label: 'POS', color: '#f2a7c0' },
                    }}
                    className="h-[220px] w-full"
                  >
                    <PieChart>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            hideLabel
                            formatter={(value, name) => (
                              <div className="flex w-full items-center justify-between gap-6">
                                <span className="text-muted-foreground">{String(name)}</span>
                                <span className="font-medium text-foreground">
                                  {formatPHP(Number(value))}
                                </span>
                              </div>
                            )}
                          />
                        }
                      />
                      <Pie
                        data={channelMixData}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={55}
                        outerRadius={88}
                        paddingAngle={4}
                      >
                        {channelMixData.map((entry, index) => (
                          <Cell
                            key={entry.key}
                            fill={channelMixColors[index % channelMixColors.length]}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>

                  <div className="space-y-3">
                    {channelMixData.map((entry, index) => (
                      <div
                        key={entry.key}
                        className="flex items-center justify-between rounded-xl border border-border bg-background/70 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: channelMixColors[index % channelMixColors.length] }}
                          />
                          <span className="font-medium text-foreground">{entry.label}</span>
                        </div>
                        <span className="font-medium text-foreground">
                          {formatPHP(entry.value)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-[1.3fr_0.7fr] gap-8">
              <section className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-serif text-2xl text-foreground">
                    {isStaffView ? 'Orders Requiring Attention' : 'Recent Orders'}
                  </h2>
                  <Button variant="ghost" size="sm" asChild>
                    <Link href="/admin/orders">View all</Link>
                  </Button>
                </div>

                <div className="space-y-3">
                  {highlightedOrders.length === 0 ? (
                    <div className="rounded-xl border border-border bg-background/70 p-4 text-sm text-foreground/60">
                      {isStaffView
                        ? 'No online orders currently need staff attention.'
                        : 'No recent orders are available yet.'}
                    </div>
                  ) : (
                    highlightedOrders.map((order) => (
                      <div
                        key={order.id}
                        className="flex flex-col gap-3 rounded-xl border border-border bg-background/70 p-4 md:flex-row md:items-center md:justify-between"
                      >
                        <div>
                          <p className="font-medium text-foreground">{order.id}</p>
                          <p className="text-sm text-foreground/60">{order.customerName}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground/70">
                            {order.source}
                          </span>
                          <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                            {order.status}
                          </span>
                          <span className="font-medium text-foreground">{formatPHP(order.total)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <div className="space-y-8">
                <section className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-serif text-xl text-foreground">POS Activity</h2>
                    <Button variant="ghost" size="sm" asChild>
                      <Link href="/admin/pos">Open terminal</Link>
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {recentTransactions.map((transaction) => (
                      <div
                        key={transaction.id}
                        className="rounded-xl border border-border bg-background/70 p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <p className="font-medium text-foreground">{transaction.id}</p>
                          <p className="text-sm text-foreground/60">
                            {transaction.paymentMethod}
                          </p>
                        </div>
                        <p className="mt-2 text-sm text-foreground/60">
                          {transaction.itemsCount} item(s) processed by {transaction.cashierName}
                        </p>
                        <p className="mt-3 font-medium text-foreground">
                          {formatPHP(transaction.total)}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="font-serif text-xl text-foreground">Inventory Health</h2>
                    <Boxes className="w-5 h-5 text-accent" />
                  </div>

                  <ChartContainer
                    config={{
                      inStock: { label: 'In Stock', color: '#e888a8' },
                      lowStock: { label: 'Low Stock', color: '#f2b5c8' },
                      outOfStock: { label: 'Out of Stock', color: '#9e4c6d' },
                    }}
                    className="h-[220px] w-full"
                  >
                    <PieChart>
                      <ChartTooltip
                        content={
                          <ChartTooltipContent
                            hideLabel
                            formatter={(value, name) => (
                              <div className="flex w-full items-center justify-between gap-6">
                                <span className="text-muted-foreground">{String(name)}</span>
                                <span className="font-medium text-foreground">{Number(value)}</span>
                              </div>
                            )}
                          />
                        }
                      />
                      <Pie
                        data={inventoryHealthData}
                        dataKey="value"
                        nameKey="label"
                        innerRadius={45}
                        outerRadius={80}
                        paddingAngle={4}
                      >
                        {inventoryHealthData.map((entry, index) => (
                          <Cell
                            key={entry.key}
                            fill={inventoryHealthColors[index % inventoryHealthColors.length]}
                          />
                        ))}
                      </Pie>
                    </PieChart>
                  </ChartContainer>

                  <div className="mt-6 space-y-3">
                    {inventoryHealthData.map((entry, index) => (
                      <div
                        key={entry.key}
                        className="flex items-center justify-between rounded-xl border border-border bg-background/70 p-4"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: inventoryHealthColors[index % inventoryHealthColors.length] }}
                          />
                          <span className="font-medium text-foreground">{entry.label}</span>
                        </div>
                        <span className="font-medium text-foreground">{entry.value}</span>
                      </div>
                    ))}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
