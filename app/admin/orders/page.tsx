'use client'

import { useMemo, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProtectedRoute } from '@/components/protected-route'
import { AdminSidebar } from '@/components/admin-sidebar'
import { useAuth } from '@/lib/auth-context'
import { formatPHP } from '@/lib/currency'
import { ONLINE_ORDER_STATUSES, type OrderRecord, type OrderStatus, useStore } from '@/lib/store-context'
import { toast } from '@/hooks/use-toast'

const ALL_STATUSES = ['All Status', ...ONLINE_ORDER_STATUSES, 'Cancelled', 'Completed']
const ALL_CHANNELS = ['All Channels', 'ONLINE', 'POS']
const ALL_PAYMENT_STATES = ['All Payments', 'Paid', 'Pending']

function getChannelLabel(order: OrderRecord) {
  return order.source === 'POS' ? 'Walk-in / POS' : 'Online'
}

function getChannelTone(order: OrderRecord) {
  return order.source === 'POS'
    ? 'bg-violet-100 text-violet-700'
    : 'bg-sky-100 text-sky-700'
}

function getPaymentMethodLabel(order: OrderRecord) {
  if (order.paymentMethod === 'Cash on Delivery') {
    return 'COD'
  }

  if (order.paymentMethod === 'PayMongo') {
    return 'PayMongo'
  }

  return order.paymentMethod
}

function getPaymentStateTone(paymentStatus: OrderRecord['paymentStatus']) {
  return paymentStatus === 'Paid'
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-amber-100 text-amber-700'
}

function getPaymentDescription(order: OrderRecord) {
  if (order.source === 'POS') {
    return 'Walk-in payment recorded at checkout.'
  }

  if (order.status === 'Cancelled') {
    return order.paymentStatus === 'Paid'
      ? 'Order cancelled after payment. Manual refund follow-up is still required.'
      : 'Order cancelled before payment collection.'
  }

  if (order.paymentMethod === 'Cash on Delivery') {
    return order.paymentStatus === 'Paid'
      ? 'COD payment has been collected.'
      : 'Collect payment from the customer upon delivery.'
  }

  return order.paymentStatus === 'Paid'
    ? 'Paid online successfully.'
    : 'Online payment is still waiting for confirmation.'
}

function getStatusTone(status: OrderRecord['status']) {
  if (status === 'Cancelled') {
    return 'bg-slate-200 text-slate-700'
  }

  return 'bg-accent/10 text-accent'
}

function getLastTimelineEntry(order: OrderRecord) {
  return order.timeline[order.timeline.length - 1]
}

function needsRefundFollowUp(order: OrderRecord) {
  return order.actionAvailability?.needsRefundFollowUp ?? (order.status === 'Cancelled' && order.paymentStatus === 'Paid')
}

export default function AdminOrdersPage() {
  const { user } = useAuth()
  const { markOrderPaymentPaid, orders, updateOrderStatus } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState('All Status')
  const [channelFilter, setChannelFilter] = useState('All Channels')
  const [paymentFilter, setPaymentFilter] = useState('All Payments')
  const [paymentUpdatingOrderId, setPaymentUpdatingOrderId] = useState<string | null>(null)
  const [statusUpdatingOrderId, setStatusUpdatingOrderId] = useState<string | null>(null)
  const [refundingOrderId, setRefundingOrderId] = useState<string | null>(null)

  const counts = useMemo(() => {
    return {
      all: orders.length,
      pending: orders.filter((o) => o.status === 'Pending').length,
      processing: orders.filter((o) => o.status === 'Processing').length,
      shipped: orders.filter((o) => o.status === 'Shipped').length,
      delivery: orders.filter((o) => o.status === 'Out for Delivery').length,
      unpaid: orders.filter((o) => o.paymentStatus === 'Pending' && o.status !== 'Cancelled').length,
      completed: orders.filter((o) => o.status === 'Completed' || o.status === 'Delivered').length,
      cancelled: orders.filter((o) => o.status === 'Cancelled').length,
    }
  }, [orders])

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return orders.filter((order) => {
      const matchesSearch =
        query.length === 0 ||
        order.id.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.customerEmail.toLowerCase().includes(query) ||
        order.paymentSummary?.reference?.toLowerCase().includes(query) ||
        order.paymentSummary?.checkoutSessionId?.toLowerCase().includes(query)

      let matchesStatus = true
      if (statusFilter === 'Pending') matchesStatus = order.status === 'Pending'
      else if (statusFilter === 'Processing') matchesStatus = order.status === 'Processing'
      else if (statusFilter === 'Shipped') matchesStatus = order.status === 'Shipped'
      else if (statusFilter === 'Out for Delivery') matchesStatus = order.status === 'Out for Delivery'
      else if (statusFilter === 'Unpaid') matchesStatus = order.paymentStatus === 'Pending' && order.status !== 'Cancelled'
      else if (statusFilter === 'Completed') matchesStatus = order.status === 'Completed' || order.status === 'Delivered'
      else if (statusFilter === 'Cancelled') matchesStatus = order.status === 'Cancelled'

      const matchesChannel =
        channelFilter === 'All Channels' || order.source === channelFilter
      const matchesPayment =
        paymentFilter === 'All Payments' || order.paymentStatus === paymentFilter

      return matchesSearch && matchesStatus && matchesChannel && matchesPayment
    })
  }, [channelFilter, orders, paymentFilter, searchQuery, statusFilter])

  const tabs = [
    { id: 'All Status', label: 'All', count: counts.all },
    { id: 'Pending', label: 'Pending', count: counts.pending },
    { id: 'Processing', label: 'Processing', count: counts.processing },
    { id: 'Shipped', label: 'Shipped', count: counts.shipped },
    { id: 'Out for Delivery', label: 'Delivery', count: counts.delivery },
    { id: 'Unpaid', label: 'Unpaid', count: counts.unpaid },
    { id: 'Completed', label: 'Completed', count: counts.completed },
    { id: 'Cancelled', label: 'Cancelled', count: counts.cancelled },
  ]

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

      const result = await response.json().catch(() => null) as {
        ok?: boolean
        message?: string
        refundId?: string
        error?: string
      } | null

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? result?.message ?? 'Refund failed.')
      }

      toast({
        title: '✅ Refund issued',
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

  return (
    <ProtectedRoute requiredRole={['ADMIN', 'STAFF']}>
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
              <h1 className="font-serif text-3xl text-foreground">Orders</h1>
              <p className="mt-2 text-sm text-foreground/60">
                Manage customer orders from processing through delivery, plus completed POS sales.
              </p>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="mb-8 space-y-6">
              <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                <div className="relative flex-1 max-w-xl">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    aria-label="Search orders by order ID, customer, email, reference, or PayMongo session"
                    placeholder="Search by order ID, customer, email, or payment reference..."
                    className="w-full px-4 py-2.5 bg-background border border-border rounded-xl text-sm text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                  />
                </div>

                <div className="flex items-center gap-3">
                  <select
                    value={channelFilter}
                    aria-label="Filter orders by channel"
                    onChange={(event) => setChannelFilter(event.target.value)}
                    className="px-4 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                  >
                    {ALL_CHANNELS.map((channel) => (
                      <option key={channel} value={channel}>
                        {channel}
                      </option>
                    ))}
                  </select>
                  <select
                    value={paymentFilter}
                    aria-label="Filter orders by payment state"
                    onChange={(event) => setPaymentFilter(event.target.value)}
                    className="px-4 py-2 bg-background border border-border rounded-xl text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent transition-all"
                  >
                    {ALL_PAYMENT_STATES.map((paymentState) => (
                      <option key={paymentState} value={paymentState}>
                        {paymentState}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-1 overflow-x-auto pb-2 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {tabs.map((tab) => {
                  const isActive = statusFilter === tab.id
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setStatusFilter(tab.id)}
                      className={`flex items-center gap-2.5 shrink-0 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        isActive
                          ? 'bg-primary text-primary-foreground shadow-[0_8px_20px_rgba(var(--primary-rgb),0.25)]'
                          : 'text-foreground/60 hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {tab.label}
                      <span className={`inline-flex items-center justify-center min-w-5 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                        isActive ? 'bg-white/20 text-white' : 'bg-muted-foreground/10 text-muted-foreground'
                      }`}>
                        {tab.count}
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="bg-card rounded-2xl border border-border overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-4 px-6 font-medium text-foreground/60">Order</th>
                      <th className="text-left py-4 px-6 font-medium text-foreground/60">Customer</th>
                      <th className="text-left py-4 px-6 font-medium text-foreground/60">Channel</th>
                      <th className="text-left py-4 px-6 font-medium text-foreground/60">Payment</th>
                      <th className="text-left py-4 px-6 font-medium text-foreground/60">Amount</th>
                      <th className="text-left py-4 px-6 font-medium text-foreground/60">Status</th>
                      <th className="text-left py-4 px-6 font-medium text-foreground/60">Last Activity</th>
                      <th className="text-left py-4 px-6 font-medium text-foreground/60">Update</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((order) => (
                      <tr key={order.id} className="border-b border-border last:border-0 hover:bg-muted/50">
                        <td className="py-4 px-6">
                          <p className="font-medium text-foreground">{order.id}</p>
                          <p className="text-xs text-foreground/60">
                            {new Date(order.createdAt).toLocaleString()}
                          </p>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-foreground">{order.customerName}</p>
                          <p className="text-xs text-foreground/60">{order.customerEmail}</p>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getChannelTone(order)}`}>
                            {getChannelLabel(order)}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <div className="space-y-2">
                            <span className="inline-flex rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground/70">
                              {getPaymentMethodLabel(order)}
                            </span>
                            <div>
                              <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getPaymentStateTone(order.paymentStatus)}`}>
                                {order.paymentStatus}
                              </span>
                            </div>
                            <p className="max-w-52 text-xs text-foreground/55">
                              {getPaymentDescription(order)}
                            </p>
                            {order.paymentSummary?.reference ? (
                              <p className="max-w-52 break-all text-[11px] text-foreground/50">
                                Ref: {order.paymentSummary.reference}
                              </p>
                            ) : null}
                            {needsRefundFollowUp(order) ? (
                              order.paymentSummary?.checkoutSessionId ? (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  disabled={refundingOrderId === order.id}
                                  onClick={() => handleIssueRefund(order)}
                                  className="border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100"
                                >
                                  {refundingOrderId === order.id ? (
                                    <><RefreshCw className="mr-1.5 h-3 w-3 animate-spin" />Refunding...</>
                                  ) : (
                                    '⮐ Issue Refund'
                                  )}
                                </Button>
                              ) : (
                                <span className="inline-flex rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                                  Refund follow-up needed
                                </span>
                              )
                            ) : null}
                          </div>
                        </td>
                        <td className="py-4 px-6 font-medium text-foreground">
                          {formatPHP(order.total)}
                        </td>
                        <td className="py-4 px-6">
                          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getStatusTone(order.status)}`}>
                            {order.status}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          {getLastTimelineEntry(order) ? (
                            <>
                              <p className="text-sm text-foreground">
                                {getLastTimelineEntry(order)?.note}
                              </p>
                              <p className="text-xs text-foreground/50">
                                {new Date(getLastTimelineEntry(order)?.createdAt ?? order.createdAt).toLocaleString()}
                              </p>
                            </>
                          ) : (
                            <p className="text-sm text-foreground/50">No activity yet</p>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <div className="space-y-3">
                            {order.source === 'ONLINE' && order.status !== 'Cancelled' ? (
                              <select
                                value={order.status}
                                onChange={(event) => handleStatusChange(order.id, event.target.value)}
                                disabled={statusUpdatingOrderId === order.id}
                                className="rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
                              >
                                {ONLINE_ORDER_STATUSES.map((status) => (
                                  <option key={status} value={status}>
                                    {status}
                                  </option>
                                ))}
                              </select>
                            ) : order.status === 'Cancelled' ? (
                              <span className="text-xs text-foreground/50">
                                Customer cancellation locked this order.
                              </span>
                            ) : (
                              <span className="text-xs text-foreground/50">
                                Walk-in orders complete at checkout
                              </span>
                            )}

                            {order.paymentStatus === 'Pending' && order.status !== 'Cancelled' ? (
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                disabled={paymentUpdatingOrderId === order.id}
                                onClick={() => handleRecordPayment(order)}
                              >
                                {paymentUpdatingOrderId === order.id
                                  ? 'Recording...'
                                  : order.paymentMethod === 'Cash on Delivery'
                                    ? 'Mark COD Paid'
                                    : 'Mark Paid'}
                              </Button>
                            ) : order.status === 'Cancelled' && order.paymentStatus === 'Pending' ? (
                              <span className="text-xs text-foreground/50">
                                Payment collection stops after cancellation.
                              </span>
                            ) : (
                              <span className="text-xs font-medium text-emerald-700">
                                Payment already recorded in Supabase
                              </span>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="mt-6 text-sm text-foreground/60">
              Showing {filteredOrders.length} of {orders.length} order records
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
