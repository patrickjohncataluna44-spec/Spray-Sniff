'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Globe, Layers, RefreshCw, Store } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { AdminDeliveryDialog } from '@/components/admin-delivery-dialog'
import { AdminOrdersTable } from '@/components/admin-orders-table'
import { AdminSidebar } from '@/components/admin-sidebar'
import { PosReceiptModal } from '@/components/pos-receipt-modal'
import { ProtectedRoute } from '@/components/protected-route'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from '@/hooks/use-toast'
import { type ChannelView } from '@/lib/admin-orders-formatters'
import { useAuth } from '@/lib/auth-context'
import { getBrowserAuthHeaders } from '@/lib/client-auth-headers'
import { formatPHP } from '@/lib/currency'
import { type OrderRecord, type OrderStatus, useStore } from '@/lib/store-context'

const ALL_PAYMENT_STATES = ['All Payments', 'Paid', 'Pending']

function parseChannelParam(raw: string | null): ChannelView {
  if (raw === 'pos' || raw === 'all' || raw === 'online') {
    return raw
  }
  return 'online'
}

function AdminOrdersContent() {
  const { user } = useAuth()
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const {
    adminCancelOrder,
    getProductById,
    markOrderPaymentPaid,
    orders,
    posTransactions,
    refreshStore,
    updateOrderStatus,
  } = useStore()

  const channelParam = parseChannelParam(searchParams.get('channel'))
  const [channelView, setChannelView] = useState<ChannelView>(channelParam)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [paymentFilter, setPaymentFilter] = useState('All Payments')
  const [paymentUpdatingOrderId, setPaymentUpdatingOrderId] = useState<string | null>(null)
  const [statusUpdatingOrderId, setStatusUpdatingOrderId] = useState<string | null>(null)
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null)
  const [deliveryOrder, setDeliveryOrder] = useState<OrderRecord | null>(null)
  const [receiptOrder, setReceiptOrder] = useState<OrderRecord | null>(null)
  const [adminCancelOrderTarget, setAdminCancelOrderTarget] = useState<OrderRecord | null>(null)
  const [adminCancelReason, setAdminCancelReason] = useState('')
  const [isAdminCancelling, setIsAdminCancelling] = useState(false)
  const [isSyncingDeliveries, setIsSyncingDeliveries] = useState(false)

  useEffect(() => {
    setChannelView(channelParam)
  }, [channelParam])

  const handleSelectChannel = (nextChannel: ChannelView) => {
    setChannelView(nextChannel)
    setStatusFilter('all')
    const params = new URLSearchParams(searchParams.toString())
    params.set('channel', nextChannel)
    router.replace(`${pathname}?${params.toString()}`, { scroll: false })
  }

  const posTransactionsByOrderId = useMemo(
    () => new Map(posTransactions.map((tx) => [tx.orderId, tx])),
    [posTransactions],
  )

  const onlineOrders = useMemo(
    () => orders.filter((order) => order.source === 'ONLINE'),
    [orders],
  )
  const posOrders = useMemo(
    () => orders.filter((order) => order.source === 'POS'),
    [orders],
  )

  const channelBaseOrders = useMemo(() => {
    if (channelView === 'online') return onlineOrders
    if (channelView === 'pos') return posOrders
    return orders
  }, [channelView, onlineOrders, orders, posOrders])

  const summaryMetrics = useMemo(() => {
    if (channelView === 'online') {
      const needsPacking = onlineOrders.filter(
        (o) => o.status === 'Pending' || o.status === 'Processing',
      ).length
      const inTransit = onlineOrders.filter(
        (o) => o.status === 'Shipped' || o.status === 'In Transit' || o.status === 'Out for Delivery',
      ).length
      const unpaidCod = onlineOrders.filter(
        (o) =>
          o.paymentMethod === 'Cash on Delivery' &&
          o.paymentStatus === 'Pending' &&
          o.status !== 'Cancelled',
      ).length
      const delivered = onlineOrders.filter(
        (o) => o.status === 'Delivered' || o.status === 'Completed',
      ).length
      return [
        { label: 'Needs Packing', value: String(needsPacking), detail: 'Pending & Processing' },
        { label: 'In Courier Transit', value: String(inTransit), detail: 'Shipped through Delivery' },
        { label: 'Unpaid COD', value: String(unpaidCod), detail: 'Awaiting collection' },
        { label: 'Delivered', value: String(delivered), detail: 'Completed fulfillment' },
      ]
    }

    if (channelView === 'pos') {
      const activePos = posOrders.filter((o) => o.status !== 'Cancelled')
      const cashSales = activePos.filter((o) => o.paymentMethod === 'Cash')
      const qrSales = activePos.filter((o) => o.paymentMethod === 'QR Pay')
      const voidedPos = posOrders.filter((o) => o.status === 'Cancelled').length
      const cashTotal = cashSales.reduce((sum, o) => sum + o.total, 0)
      const qrTotal = qrSales.reduce((sum, o) => sum + o.total, 0)
      return [
        { label: 'Completed Sales', value: String(activePos.length), detail: 'Active counter receipts' },
        { label: 'Cash Sales', value: String(cashSales.length), detail: formatPHP(cashTotal) },
        { label: 'QR Pay Sales', value: String(qrSales.length), detail: formatPHP(qrTotal) },
        { label: 'Voided', value: String(voidedPos), detail: 'Cancelled walk-in sales' },
      ]
    }

    const unpaidActive = orders.filter(
      (o) => o.paymentStatus === 'Pending' && o.status !== 'Cancelled',
    ).length
    const completedAll = orders.filter(
      (o) => o.status === 'Delivered' || o.status === 'Completed',
    ).length
    return [
      { label: 'Online Orders', value: String(onlineOrders.length), detail: 'Web checkout & delivery' },
      { label: 'POS / Walk-In', value: String(posOrders.length), detail: 'In-store register sales' },
      { label: 'Unpaid Active', value: String(unpaidActive), detail: 'Pending payment' },
      { label: 'Completed / Delivered', value: String(completedAll), detail: 'All fulfilled orders' },
    ]
  }, [channelView, onlineOrders, orders, posOrders])

  const tabs = useMemo(() => {
    if (channelView === 'online') {
      return [
        { id: 'all', label: 'All Online', count: onlineOrders.length },
        { id: 'Pending', label: 'Pending', count: onlineOrders.filter((o) => o.status === 'Pending').length },
        { id: 'Processing', label: 'Processing', count: onlineOrders.filter((o) => o.status === 'Processing').length },
        { id: 'Shipped', label: 'Shipped', count: onlineOrders.filter((o) => o.status === 'Shipped').length },
        { id: 'In Transit', label: 'In Transit', count: onlineOrders.filter((o) => o.status === 'In Transit').length },
        { id: 'Out for Delivery', label: 'Out for Delivery', count: onlineOrders.filter((o) => o.status === 'Out for Delivery').length },
        { id: 'Unpaid', label: 'Unpaid', count: onlineOrders.filter((o) => o.paymentStatus === 'Pending' && o.status !== 'Cancelled').length },
        { id: 'Delivered', label: 'Delivered', count: onlineOrders.filter((o) => o.status === 'Delivered' || o.status === 'Completed').length },
        { id: 'Cancelled', label: 'Cancelled', count: onlineOrders.filter((o) => o.status === 'Cancelled').length },
      ]
    }

    if (channelView === 'pos') {
      return [
        { id: 'all', label: 'All POS', count: posOrders.length },
        { id: 'Completed', label: 'Completed', count: posOrders.filter((o) => o.status !== 'Cancelled').length },
        { id: 'Cash', label: 'Cash', count: posOrders.filter((o) => o.paymentMethod === 'Cash' && o.status !== 'Cancelled').length },
        { id: 'QR Pay', label: 'QR Pay', count: posOrders.filter((o) => o.paymentMethod === 'QR Pay' && o.status !== 'Cancelled').length },
        { id: 'Voided', label: 'Voided', count: posOrders.filter((o) => o.status === 'Cancelled').length },
      ]
    }

    return [
      { id: 'all', label: 'All Orders', count: orders.length },
      { id: 'Unpaid', label: 'Unpaid', count: orders.filter((o) => o.paymentStatus === 'Pending' && o.status !== 'Cancelled').length },
      { id: 'Active', label: 'In Progress', count: orders.filter((o) => o.status !== 'Delivered' && o.status !== 'Completed' && o.status !== 'Cancelled').length },
      { id: 'Completed', label: 'Completed / Delivered', count: orders.filter((o) => o.status === 'Delivered' || o.status === 'Completed').length },
      { id: 'Cancelled', label: 'Cancelled / Voided', count: orders.filter((o) => o.status === 'Cancelled').length },
    ]
  }, [channelView, onlineOrders, orders, posOrders])

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return channelBaseOrders.filter((order) => {
      const matchingTx = posTransactionsByOrderId.get(order.id)
      const matchesSearch =
        query.length === 0 ||
        order.id.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.customerEmail.toLowerCase().includes(query) ||
        order.trackingNumber?.toLowerCase().includes(query) ||
        order.courier?.toLowerCase().includes(query) ||
        matchingTx?.cashierName.toLowerCase().includes(query) ||
        order.paymentSummary?.reference?.toLowerCase().includes(query) ||
        order.paymentSummary?.checkoutSessionId?.toLowerCase().includes(query)

      let matchesStatus = true
      if (statusFilter === 'Pending') matchesStatus = order.status === 'Pending'
      else if (statusFilter === 'Processing') matchesStatus = order.status === 'Processing'
      else if (statusFilter === 'Shipped') matchesStatus = order.status === 'Shipped'
      else if (statusFilter === 'In Transit') matchesStatus = order.status === 'In Transit'
      else if (statusFilter === 'Out for Delivery') matchesStatus = order.status === 'Out for Delivery'
      else if (statusFilter === 'Unpaid') matchesStatus = order.paymentStatus === 'Pending' && order.status !== 'Cancelled'
      else if (statusFilter === 'Delivered') matchesStatus = order.status === 'Delivered' || order.status === 'Completed'
      else if (statusFilter === 'Cancelled') matchesStatus = order.status === 'Cancelled'
      else if (statusFilter === 'Completed') {
        matchesStatus =
          channelView === 'pos'
            ? order.status !== 'Cancelled'
            : order.status === 'Completed' || order.status === 'Delivered'
      } else if (statusFilter === 'Cash') {
        matchesStatus = order.paymentMethod === 'Cash' && order.status !== 'Cancelled'
      } else if (statusFilter === 'QR Pay') {
        matchesStatus = order.paymentMethod === 'QR Pay' && order.status !== 'Cancelled'
      } else if (statusFilter === 'Voided') {
        matchesStatus = order.status === 'Cancelled'
      } else if (statusFilter === 'Active') {
        matchesStatus =
          order.status !== 'Delivered' &&
          order.status !== 'Completed' &&
          order.status !== 'Cancelled'
      }

      const matchesPayment =
        paymentFilter === 'All Payments' || order.paymentStatus === paymentFilter

      return matchesSearch && matchesStatus && matchesPayment
    })
  }, [channelBaseOrders, channelView, paymentFilter, posTransactionsByOrderId, searchQuery, statusFilter])

  const handleStatusChange = async (orderId: string, nextStatus: string) => {
    try {
      setStatusUpdatingOrderId(orderId)
      const result = await updateOrderStatus(
        orderId,
        nextStatus as OrderStatus,
        user?.name || 'Store team',
      )

      toast({
        title: result.ok ? 'Order updated' : 'Unable to update order',
        description: result.message,
        variant: result.ok ? 'default' : 'destructive',
      })
    } finally {
      setStatusUpdatingOrderId(null)
    }
  }

  const handleRecordPayment = async (order: OrderRecord) => {
    try {
      setPaymentUpdatingOrderId(order.id)
      const result = await markOrderPaymentPaid(
        order.id,
        user?.name || 'Store team',
        order.paymentMethod === 'Cash on Delivery'
          ? 'Cash on Delivery payment collected and verified by admin.'
          : 'Payment collected and verified by admin.',
      )

      toast({
        title: result.ok ? 'Payment recorded' : 'Unable to record payment',
        description: result.message,
        variant: result.ok ? 'default' : 'destructive',
      })
    } finally {
      setPaymentUpdatingOrderId(null)
    }
  }

  const handleConfirmAdminCancel = async () => {
    if (!adminCancelOrderTarget) return
    const isPos = adminCancelOrderTarget.source === 'POS'
    try {
      setIsAdminCancelling(true)
      const result = await adminCancelOrder(
        adminCancelOrderTarget.id,
        adminCancelReason.trim() ||
          (isPos
            ? `POS sale voided by ${user?.name || 'Staff'}.`
            : `Cancelled by admin (${user?.name || 'Staff'}).`),
      )
      toast({
        title: result.ok
          ? isPos
            ? 'POS sale voided'
            : 'Order cancelled'
          : 'Unable to complete action',
        description: result.message,
        variant: result.ok ? 'default' : 'destructive',
      })
      if (result.ok) {
        setAdminCancelOrderTarget(null)
        setAdminCancelReason('')
      }
    } finally {
      setIsAdminCancelling(false)
    }
  }

  const handleVoidFromReceiptModal = async (orderId: string, reason: string) => {
    const result = await adminCancelOrder(orderId, reason)
    toast({
      title: result.ok ? 'POS sale voided' : 'Unable to void POS sale',
      description: result.message,
      variant: result.ok ? 'default' : 'destructive',
    })
    return result.ok
  }

  const handleIssueRefund = async (order: OrderRecord) => {
    if (!order.paymentSummary?.checkoutSessionId) {
      toast({
        title: 'No PayMongo session found',
        description: 'This order has no linked PayMongo checkout session to refund.',
        variant: 'destructive',
      })
      return
    }

    const confirmed = window.confirm(
      `Issue full refund of ${formatPHP(order.total)} for order ${order.id}?\n\nThis will send the money back to the customer's GCash / QR Ph via PayMongo.`,
    )
    if (!confirmed) return

    try {
      setRefundingOrderId(order.id)
      const response = await fetch('/api/paymongo/refund', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checkoutSessionId: order.paymentSummary.checkoutSessionId,
          reason: 'others',
          notes: `Admin refund for cancelled order ${order.id} by ${user?.name ?? 'admin'}.`,
        }),
      })

      const result = (await response.json().catch(() => null)) as {
        ok?: boolean
        message?: string
        refundId?: string
        error?: string
      } | null

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? result?.message ?? 'Refund failed.')
      }

      toast({
        title: 'Refund issued',
        description: result.message ?? `Refund sent back to customer. Refund ID: ${result.refundId}`,
      })
    } catch (error) {
      toast({
        title: 'Refund failed',
        description: error instanceof Error ? error.message : 'Unable to process the refund.',
        variant: 'destructive',
      })
    } finally {
      setRefundingOrderId(null)
    }
  }

  const handleSyncDeliveries = async () => {
    try {
      setIsSyncingDeliveries(true)
      const headers = await getBrowserAuthHeaders()
      const response = await fetch('/api/admin/delivery/sync', {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json',
        },
      })

      const result = (await response.json().catch(() => null)) as {
        ok?: boolean
        message?: string
        error?: string
      } | null

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? result?.message ?? 'Courier sync failed.')
      }

      await refreshStore()
      toast({
        title: 'Courier sync complete',
        description: result.message || 'Active shipments checked against Parcels API v5.',
      })
    } catch (error) {
      toast({
        title: 'Courier sync failed',
        description: error instanceof Error ? error.message : 'Unable to synchronize deliveries.',
        variant: 'destructive',
      })
    } finally {
      setIsSyncingDeliveries(false)
    }
  }

  const resetFilters = () => {
    setSearchQuery('')
    setStatusFilter('all')
    setPaymentFilter('All Payments')
  }

  const activeReceiptOrder = receiptOrder
    ? orders.find((o) => o.id === receiptOrder.id) ?? receiptOrder
    : null
  const activeReceiptTransaction = activeReceiptOrder
    ? posTransactionsByOrderId.get(activeReceiptOrder.id) ?? null
    : null

  const channelButtons: Array<{
    id: ChannelView
    label: string
    count: number
    icon: typeof Globe
  }> = [
    { id: 'online', label: 'Online Orders', count: onlineOrders.length, icon: Globe },
    { id: 'pos', label: 'POS / Walk-In', count: posOrders.length, icon: Store },
    { id: 'all', label: 'All', count: orders.length, icon: Layers },
  ]

  return (
    <ProtectedRoute requiredRole={['ADMIN', 'STAFF']}>
      <div data-ui="orders-workspace" className="flex min-h-dvh bg-background">
        <AdminSidebar />
        <div className="flex-1 min-w-0">
          {/* taste-skill-ignore: page header divider */}
          <div className="border-b border-border bg-card">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex items-center gap-4 mb-3">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin/dashboard" className="flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Link>
                </Button>
              </div>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h1 className="font-serif text-3xl text-foreground">Orders</h1>
                  <p className="mt-1.5 text-sm text-foreground/60">
                    Online delivery fulfillment and in-store POS sales organized in separate workspaces.
                  </p>
                </div>

                {/* Primary Channel Workspace Switcher */}
                <div
                  role="tablist"
                  aria-label="Order channel workspace"
                  className="inline-flex flex-wrap items-center gap-1 rounded-xl border border-border bg-background p-1"
                >
                  {channelButtons.map((channel) => {
                    const Icon = channel.icon
                    const isActive = channelView === channel.id
                    return (
                      <button
                        key={channel.id}
                        type="button"
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => handleSelectChannel(channel.id)}
                        className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors whitespace-nowrap ${
                          isActive
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground/70 hover:bg-muted hover:text-foreground'
                        }`}
                      >
                        <Icon className="h-4 w-4 shrink-0" />
                        <span>{channel.label}</span>
                        <span
                          className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${
                            isActive
                              ? 'bg-white/20 text-white'
                              : 'bg-muted text-foreground/65'
                          }`}
                        >
                          {channel.count}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
            {/* Compact Operational Summary Strip (Flat 1px border, tabular figures) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {summaryMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-xl border border-border bg-card px-4 py-3.5"
                >
                  <p className="text-xs font-medium text-foreground/60">{metric.label}</p>
                  <p className="mt-1 text-2xl font-semibold tabular-nums text-foreground">
                    {metric.value}
                  </p>
                  <p className="mt-0.5 text-xs text-foreground/55">{metric.detail}</p>
                </div>
              ))}
            </div>

            {/* Toolbar & Context-Aware Filter Pills */}
            <div className="space-y-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1 max-w-xl">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    aria-label="Search orders by ID, receipt, customer, email, tracking, or reference"
                    placeholder={
                      channelView === 'pos'
                        ? 'Search POS receipt ID, customer, cashier, or ref...'
                        : 'Search order ID, tracking number, customer, or reference...'
                    }
                    className="h-10 w-full rounded-xl border border-border bg-card px-4 text-sm text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>

                <div className="flex flex-wrap items-center gap-2.5">
                  <select
                    value={paymentFilter}
                    aria-label="Filter orders by payment state"
                    onChange={(event) => setPaymentFilter(event.target.value)}
                    className="h-10 rounded-xl border border-border bg-card px-3.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  >
                    {ALL_PAYMENT_STATES.map((paymentState) => (
                      <option key={paymentState} value={paymentState}>
                        {paymentState}
                      </option>
                    ))}
                  </select>

                  {user?.role === 'ADMIN' && channelView !== 'pos' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={isSyncingDeliveries}
                      onClick={handleSyncDeliveries}
                      className="h-10 gap-1.5 rounded-xl border-border text-xs font-medium"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isSyncingDeliveries ? 'animate-spin' : ''}`} />
                      {isSyncingDeliveries ? 'Syncing...' : 'Sync Courier Updates'}
                    </Button>
                  )}

                  {channelView === 'pos' && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      asChild
                      className="h-10 rounded-xl border-border text-xs font-medium"
                    >
                      <Link href="/admin/pos">New POS Sale</Link>
                    </Button>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {tabs.map((tab) => {
                  const isActive = statusFilter === tab.id
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setStatusFilter(tab.id)}
                      className={`inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-lg border px-3.5 py-2 text-xs font-medium transition-colors ${
                        isActive
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-card text-foreground/70 hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      <span>{tab.label}</span>
                      <span
                        className={`inline-flex min-w-5 items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-bold tabular-nums ${
                          isActive
                            ? 'bg-white/20 text-white'
                            : 'bg-muted text-foreground/65'
                        }`}
                      >
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="flex items-center justify-between text-xs text-foreground/60">
              <span>
                Showing <strong className="text-foreground tabular-nums">{filteredOrders.length}</strong> of{' '}
                <strong className="text-foreground tabular-nums">{channelBaseOrders.length}</strong>{' '}
                {channelView === 'online'
                  ? 'online orders'
                  : channelView === 'pos'
                    ? 'POS sales'
                    : 'total records'}
              </span>
              {(searchQuery || statusFilter !== 'all' || paymentFilter !== 'All Payments') && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="font-medium text-primary hover:underline"
                >
                  Clear filters
                </button>
              )}
            </div>

            <AdminOrdersTable
              channelView={channelView}
              orders={filteredOrders}
              posTransactionsByOrderId={posTransactionsByOrderId}
              actor={user ? { id: user.id, name: user.name, role: user.role } : null}
              getProductById={getProductById}
              statusUpdatingOrderId={statusUpdatingOrderId}
              paymentUpdatingOrderId={paymentUpdatingOrderId}
              refundingOrderId={refundingOrderId}
              onStatusChange={handleStatusChange}
              onManageDelivery={setDeliveryOrder}
              onRecordPayment={handleRecordPayment}
              onRequestCancelOrVoid={(order) => {
                setAdminCancelOrderTarget(order)
                setAdminCancelReason('')
              }}
              onIssueRefund={handleIssueRefund}
              onViewPosReceipt={setReceiptOrder}
              onResetFilters={resetFilters}
            />
          </div>
        </div>
      </div>

      <AdminDeliveryDialog
        key={deliveryOrder?.id ?? 'no-order'}
        order={deliveryOrder}
        open={deliveryOrder !== null}
        onOpenChange={(open) => {
          if (!open) {
            setDeliveryOrder(null)
          }
        }}
      />

      <PosReceiptModal
        open={activeReceiptOrder !== null}
        onOpenChange={(open) => {
          if (!open) {
            setReceiptOrder(null)
          }
        }}
        order={activeReceiptOrder}
        transaction={activeReceiptTransaction}
        actor={user ? { role: user.role } : null}
        onVoidSale={handleVoidFromReceiptModal}
      />

      <AlertDialog
        open={adminCancelOrderTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setAdminCancelOrderTarget(null)
            setAdminCancelReason('')
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {adminCancelOrderTarget?.source === 'POS'
                ? `Void POS Sale ${adminCancelOrderTarget.id}?`
                : `Cancel Order ${adminCancelOrderTarget?.id}?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {adminCancelOrderTarget?.source === 'POS'
                ? 'This will void the walk-in POS sale and automatically restore the sold stock back to inventory.'
                : 'This will mark the order as Cancelled and automatically restore the perfume inventory.'}
              {adminCancelOrderTarget?.paymentStatus === 'Paid' && (
                <span className="mt-2 block font-medium text-amber-700">
                  {adminCancelOrderTarget.source === 'POS' && adminCancelOrderTarget.paymentMethod === 'Cash'
                    ? 'Note: Cash payment was collected at checkout. Refund the cash amount from your register drawer.'
                    : `Note: Payment was recorded via ${adminCancelOrderTarget.paymentMethod}. Issue a refund after cancellation if needed.`}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <label className="mb-1 block text-xs font-semibold text-foreground/70">
              {adminCancelOrderTarget?.source === 'POS'
                ? 'Void Reason (Optional)'
                : 'Cancellation Reason (Optional)'}
            </label>
            <Input
              placeholder={
                adminCancelOrderTarget?.source === 'POS'
                  ? 'e.g., Wrong item or size entered'
                  : 'e.g., Customer requested cancellation via support'
              }
              value={adminCancelReason}
              onChange={(e) => setAdminCancelReason(e.target.value)}
              className="text-sm"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isAdminCancelling}>Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault()
                handleConfirmAdminCancel()
              }}
              disabled={isAdminCancelling}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isAdminCancelling
                ? adminCancelOrderTarget?.source === 'POS'
                  ? 'Voiding...'
                  : 'Cancelling...'
                : adminCancelOrderTarget?.source === 'POS'
                  ? 'Confirm Void'
                  : 'Confirm Cancellation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  )
}

export default function AdminOrdersPage() {
  return (
    <Suspense
      fallback={
        <ProtectedRoute requiredRole={['ADMIN', 'STAFF']}>
          <div className="flex min-h-dvh bg-background">
            <AdminSidebar />
            <div className="flex-1 p-8 text-sm text-foreground/60">Loading orders...</div>
          </div>
        </ProtectedRoute>
      }
    >
      <AdminOrdersContent />
    </Suspense>
  )
}
