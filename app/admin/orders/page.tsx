'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProtectedRoute } from '@/components/protected-route'
import { AdminSidebar } from '@/components/admin-sidebar'
import { useAuth } from '@/lib/auth-context'
import { formatPHP } from '@/lib/currency'
import { ONLINE_ORDER_STATUSES, type OrderRecord, type OrderStatus, useStore } from '@/lib/store-context'
import { toast } from '@/hooks/use-toast'

const ALL_STATUSES = ['All Status', ...ONLINE_ORDER_STATUSES, 'Completed']
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

  if (order.paymentMethod === 'Cash on Delivery') {
    return order.paymentStatus === 'Paid'
      ? 'COD payment has been collected.'
      : 'Collect payment from the customer upon delivery.'
  }

  return order.paymentStatus === 'Paid'
    ? 'Paid online successfully.'
    : 'Online payment is still waiting for confirmation.'
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

  const filteredOrders = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    return orders.filter((order) => {
      const matchesSearch =
        query.length === 0 ||
        order.id.toLowerCase().includes(query) ||
        order.customerName.toLowerCase().includes(query) ||
        order.customerEmail.toLowerCase().includes(query)
      const matchesStatus =
        statusFilter === 'All Status' || order.status === statusFilter
      const matchesChannel =
        channelFilter === 'All Channels' || order.source === channelFilter
      const matchesPayment =
        paymentFilter === 'All Payments' || order.paymentStatus === paymentFilter

      return matchesSearch && matchesStatus && matchesChannel && matchesPayment
    })
  }, [channelFilter, orders, paymentFilter, searchQuery, statusFilter])

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

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid gap-4 md:grid-cols-[1.2fr_0.8fr_0.8fr_0.8fr] mb-6">
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                placeholder="Search by order ID, customer, or email..."
                className="px-4 py-2 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                className="px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {ALL_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <select
                value={channelFilter}
                onChange={(event) => setChannelFilter(event.target.value)}
                className="px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              >
                  {ALL_CHANNELS.map((channel) => (
                    <option key={channel} value={channel}>
                      {channel}
                    </option>
                  ))}
                </select>
              <select
                value={paymentFilter}
                onChange={(event) => setPaymentFilter(event.target.value)}
                className="px-4 py-2 bg-background border border-border rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {ALL_PAYMENT_STATES.map((paymentState) => (
                  <option key={paymentState} value={paymentState}>
                    {paymentState}
                  </option>
                ))}
              </select>
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
                          </div>
                        </td>
                        <td className="py-4 px-6 font-medium text-foreground">
                          {formatPHP(order.total)}
                        </td>
                        <td className="py-4 px-6">
                          <span className="inline-flex rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold text-accent">
                            {order.status}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <p className="text-sm text-foreground">
                            {order.timeline[order.timeline.length - 1]?.note || 'No activity yet'}
                          </p>
                          <p className="text-xs text-foreground/50">
                            {order.timeline[order.timeline.length - 1]?.createdAt
                              ? new Date(order.timeline[order.timeline.length - 1].createdAt).toLocaleString()
                              : 'Not recorded'}
                          </p>
                        </td>
                        <td className="py-4 px-6">
                          <div className="space-y-3">
                            {order.source === 'ONLINE' ? (
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
                            ) : (
                              <span className="text-xs text-foreground/50">
                                Walk-in orders complete at checkout
                              </span>
                            )}

                            {order.paymentStatus === 'Pending' ? (
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
