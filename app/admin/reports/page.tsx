'use client'

import { useMemo } from 'react'
import Link from 'next/link'
import { ArrowLeft, BarChart3 } from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  XAxis,
  YAxis,
} from 'recharts'
import { AdminSidebar } from '@/components/admin-sidebar'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  buildInventoryHealthData,
  buildOrderStatusData,
  buildPaymentBreakdownData,
  buildSalesTrendData,
  buildStockMovementData,
  buildTopProductData,
  isSuccessfulPaymentOrder,
} from '@/lib/analytics'
import { formatPHP } from '@/lib/currency'
import { useStore } from '@/lib/store-context'

const salesReportConfig = {
  online: {
    label: 'Online',
    color: '#dd729b',
  },
  pos: {
    label: 'POS',
    color: '#f2a7c0',
  },
} satisfies ChartConfig

const productRevenueConfig = {
  revenue: {
    label: 'Revenue',
    color: '#dd729b',
  },
} satisfies ChartConfig

const stockMovementConfig = {
  change: {
    label: 'Net Movement',
    color: '#f2a7c0',
  },
} satisfies ChartConfig

const paymentColors = ['#dd729b', '#f2a7c0', '#f7bfd1', '#c86b8d', '#9e4c6d']
const statusColors = ['#e888a8', '#f2b5c8', '#f7cad8', '#9e4c6d', '#7f6172']
const inventoryColors = ['#e888a8', '#f2b5c8', '#9e4c6d']

export default function ReportsPage() {
  const { catalog, getInventoryRecord, inventory, orders, posTransactions, stockMovements } = useStore()
  const activeInventory = useMemo(
    () => inventory.filter((item) => !item.isArchived),
    [inventory],
  )
  const activeCatalog = useMemo(
    () => catalog.filter((product) => !getInventoryRecord(product.id)?.isArchived),
    [catalog, getInventoryRecord],
  )
  const successfulPayments = useMemo(
    () => orders.filter(isSuccessfulPaymentOrder),
    [orders],
  )

  const totalRevenue = successfulPayments.reduce((sum, order) => sum + order.total, 0)
  const onlineRevenue = successfulPayments
    .filter((order) => order.source === 'ONLINE')
    .reduce((sum, order) => sum + order.total, 0)
  const posRevenue = successfulPayments
    .filter((order) => order.source === 'POS')
    .reduce((sum, order) => sum + order.total, 0)
  const taxCollected = successfulPayments.reduce((sum, order) => sum + order.tax, 0)
  const inventoryCoverage =
    activeCatalog.length === 0
      ? 0
      : Math.round((activeInventory.length / activeCatalog.length) * 100)
  const salesTrendData = useMemo(() => buildSalesTrendData(orders, 7), [orders])
  const paymentBreakdown = useMemo(() => buildPaymentBreakdownData(orders), [orders])
  const orderStatusData = useMemo(() => buildOrderStatusData(orders), [orders])
  const topProductData = useMemo(() => buildTopProductData(orders), [orders])
  const stockMovementData = useMemo(
    () => buildStockMovementData(stockMovements),
    [stockMovements],
  )
  const inventoryHealthData = useMemo(
    () => buildInventoryHealthData(activeInventory),
    [activeInventory],
  )

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <div className="flex-1">
          <div className="border-b border-border bg-card">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex items-center gap-4 mb-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin/dashboard" className="flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Link>
                </Button>
              </div>

              <h1 className="font-serif text-3xl text-foreground">Reports</h1>
              <p className="mt-2 text-sm text-foreground/60">
                Business reporting for inventory movement, sales performance, tax analytics, and stock accuracy.
              </p>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4 mb-10">
              <div className="rounded-2xl border border-border bg-card p-6">
                <BarChart3 className="h-5 w-5 text-accent mb-4" />
                <p className="text-sm font-medium text-foreground/60">Paid Revenue</p>
                <p className="mt-2 font-serif text-3xl text-foreground">{formatPHP(totalRevenue)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="text-sm font-medium text-foreground/60">Online Paid Revenue</p>
                <p className="mt-2 font-serif text-3xl text-foreground">{formatPHP(onlineRevenue)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="text-sm font-medium text-foreground/60">POS Paid Revenue</p>
                <p className="mt-2 font-serif text-3xl text-foreground">{formatPHP(posRevenue)}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="text-sm font-medium text-foreground/60">Tax Collected</p>
                <p className="mt-2 font-serif text-3xl text-foreground">{formatPHP(taxCollected)}</p>
              </div>
            </div>

            <div className="grid gap-8 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-serif text-2xl text-foreground mb-2">Sales Performance</h2>
                <p className="mb-6 text-sm text-foreground/60">
                  Seven-day paid revenue comparison between online sales and point-of-sale activity.
                </p>

                <ChartContainer config={salesReportConfig} className="h-[320px] w-full">
                  <BarChart data={salesTrendData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
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
                    <Bar dataKey="online" stackId="sales" fill="var(--color-online)" radius={[6, 6, 0, 0]} />
                    <Bar dataKey="pos" stackId="sales" fill="var(--color-pos)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ChartContainer>
              </section>

              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-serif text-2xl text-foreground mb-2">Payment Share</h2>
                <p className="mb-6 text-sm text-foreground/60">
                  Successful payment revenue by payment method across the store.
                </p>

                <ChartContainer
                  config={
                    Object.fromEntries(
                      paymentBreakdown.map((entry, index) => [
                        entry.key,
                        {
                          label: entry.label,
                          color: paymentColors[index % paymentColors.length],
                        },
                      ]),
                    ) as ChartConfig
                  }
                  className="h-[280px] w-full"
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
                      data={paymentBreakdown}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={58}
                      outerRadius={100}
                      paddingAngle={3}
                    >
                      {paymentBreakdown.map((entry, index) => (
                        <Cell
                          key={entry.key}
                          fill={paymentColors[index % paymentColors.length]}
                        />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>

                <div className="mt-6 space-y-3">
                  {paymentBreakdown.map((entry, index) => (
                    <div
                      key={entry.key}
                      className="flex items-center justify-between rounded-xl border border-border bg-background/70 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: paymentColors[index % paymentColors.length] }}
                        />
                        <span className="font-medium text-foreground">{entry.label}</span>
                      </div>
                      <span className="font-medium text-foreground">{formatPHP(entry.value)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-8 rounded-xl border border-border bg-background/70 p-4">
                  <p className="text-sm font-medium text-foreground/60">Inventory Accuracy Coverage</p>
                  <p className="mt-2 font-serif text-3xl text-foreground">{inventoryCoverage}%</p>
                  <p className="mt-2 text-sm text-foreground/60">
                    Active sellable catalog items are matched to live inventory records for stock-level reporting.
                  </p>
                </div>
              </section>
            </div>

            <div className="mt-8 grid gap-8 xl:grid-cols-[1fr_1fr]">
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-serif text-2xl text-foreground mb-2">Top Products</h2>
                <p className="mb-6 text-sm text-foreground/60">
                  Highest grossing products based on recorded sales.
                </p>

                <ChartContainer config={productRevenueConfig} className="h-[320px] w-full">
                  <BarChart data={topProductData} layout="vertical" margin={{ left: 24 }}>
                    <CartesianGrid horizontal={false} />
                    <XAxis
                      type="number"
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(value) => `P${Math.round(value / 1000)}k`}
                    />
                    <YAxis
                      type="category"
                      dataKey="name"
                      tickLine={false}
                      axisLine={false}
                      width={110}
                    />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          indicator="dot"
                          formatter={(value) => (
                            <span className="font-medium text-foreground">
                              {formatPHP(Number(value))}
                            </span>
                          )}
                        />
                      }
                    />
                    <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 8, 8, 0]} />
                  </BarChart>
                </ChartContainer>

                <div className="mt-6 space-y-3">
                  {topProductData.map((item) => (
                    <div
                      key={item.name}
                      className="flex items-center justify-between rounded-xl border border-border bg-background/70 p-4"
                    >
                      <div>
                        <p className="font-medium text-foreground">{item.name}</p>
                        <p className="text-sm text-foreground/60">
                          {item.quantity} unit(s) sold
                        </p>
                      </div>
                      <span className="font-medium text-foreground">{formatPHP(item.revenue)}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-serif text-2xl text-foreground mb-2">Order Status Mix</h2>
                <p className="mb-6 text-sm text-foreground/60">
                  Fulfillment stage breakdown across online orders and POS completions.
                </p>

                <ChartContainer
                  config={
                    Object.fromEntries(
                      orderStatusData.map((entry, index) => [
                        entry.key,
                        {
                          label: entry.label,
                          color: statusColors[index % statusColors.length],
                        },
                      ]),
                    ) as ChartConfig
                  }
                  className="h-[280px] w-full"
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
                                {Number(value)} order(s)
                              </span>
                            </div>
                          )}
                        />
                      }
                    />
                    <Pie
                      data={orderStatusData}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={58}
                      outerRadius={100}
                      paddingAngle={3}
                    >
                      {orderStatusData.map((entry, index) => (
                        <Cell key={entry.key} fill={statusColors[index % statusColors.length]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ChartContainer>

                <div className="mt-6 space-y-3">
                  {orderStatusData.map((entry, index) => (
                    <div
                      key={entry.key}
                      className="flex items-center justify-between rounded-xl border border-border bg-background/70 p-4"
                    >
                      <div className="flex items-center gap-3">
                        <span
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: statusColors[index % statusColors.length] }}
                        />
                        <span className="font-medium text-foreground">{entry.label}</span>
                      </div>
                      <span className="font-medium text-foreground">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="mt-8 grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-serif text-2xl text-foreground mb-2">Inventory Movement</h2>
                <p className="mb-6 text-sm text-foreground/60">
                  Recent stock increases and decreases affecting inventory accuracy.
                </p>

                <ChartContainer config={stockMovementConfig} className="h-[320px] w-full">
                  <BarChart data={stockMovementData}>
                    <CartesianGrid vertical={false} />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                    <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
                    <ChartTooltip
                      cursor={false}
                      content={
                        <ChartTooltipContent
                          indicator="dot"
                          formatter={(value, name, item) => {
                            const payload = item?.payload as { fullLabel?: string; resultingStock?: number }
                            return (
                              <div className="grid gap-1">
                                <span className="font-medium text-foreground">
                                  {payload.fullLabel || String(name)}
                                </span>
                                <span className="text-muted-foreground">
                                  Change: {Number(value) > 0 ? '+' : ''}
                                  {Number(value)}
                                </span>
                                <span className="text-muted-foreground">
                                  Remaining stock: {payload.resultingStock ?? 0}
                                </span>
                              </div>
                            )
                          }}
                        />
                      }
                    />
                    <Bar dataKey="change" radius={[6, 6, 0, 0]}>
                      {stockMovementData.map((entry) => (
                        <Cell
                          key={entry.id}
                          fill={entry.change >= 0 ? '#f2a7c0' : '#9e4c6d'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ChartContainer>
              </section>

              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-serif text-2xl text-foreground mb-2">Inventory Health</h2>
                <p className="mb-6 text-sm text-foreground/60">
                  Current stock condition of the active tracked product catalog.
                </p>

                <ChartContainer
                  config={{
                    inStock: { label: 'In Stock', color: '#e888a8' },
                    lowStock: { label: 'Low Stock', color: '#f2b5c8' },
                    outOfStock: { label: 'Out of Stock', color: '#9e4c6d' },
                  }}
                  className="h-[280px] w-full"
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
                      innerRadius={58}
                      outerRadius={100}
                      paddingAngle={3}
                    >
                      {inventoryHealthData.map((entry, index) => (
                        <Cell key={entry.key} fill={inventoryColors[index % inventoryColors.length]} />
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
                          style={{ backgroundColor: inventoryColors[index % inventoryColors.length] }}
                        />
                        <span className="font-medium text-foreground">{entry.label}</span>
                      </div>
                      <span className="font-medium text-foreground">{entry.value}</span>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="mt-8 rounded-2xl border border-border bg-card p-6">
              <h2 className="font-serif text-2xl text-foreground mb-6">Low Stock Watchlist</h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {activeInventory
                  .filter((item) => item.stock <= item.reorderPoint)
                  .map((item) => (
                    <div
                      key={item.productId}
                      className="rounded-xl border border-border bg-background/70 p-4"
                    >
                      <p className="font-medium text-foreground">{item.sku}</p>
                      <p className="mt-2 text-sm text-foreground/60">
                        Stock: {item.stock} | Reorder point: {item.reorderPoint}
                      </p>
                      <p className="mt-2 text-xs text-foreground/50">Location: {item.location}</p>
                    </div>
                  ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
