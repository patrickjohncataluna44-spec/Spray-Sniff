'use client'

import Link from 'next/link'
import { useDeferredValue, useMemo, useState } from 'react'
import { Star } from 'lucide-react'
import { ProtectedRoute } from '@/components/protected-route'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'
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
import { useAuth } from '@/lib/auth-context'
import { formatPHP } from '@/lib/currency'
import { type OrderRecord, useStore } from '@/lib/store-context'
import { toast } from '@/hooks/use-toast'

const statusTone: Record<string, string> = {
  Pending: 'bg-[#ffe5de] text-[#b85b48]',
  Processing: 'bg-[#fff0be] text-[#8f6b26]',
  Shipped: 'bg-[#ffe8d9] text-[#9c624d]',
  'In Transit': 'bg-[#ffe0c2] text-[#8a5a24]',
  'Out for Delivery': 'bg-[#ffd6a6] text-[#7d5a1f]',
  Delivered: 'bg-[#e6f4ea] text-[#2f7a4e]',
  Cancelled: 'bg-slate-200 text-slate-700',
}

const ORDER_STATUS_FILTERS = [
  'All Orders',
  'Pending',
  'Processing',
  'Shipped',
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
] as const

type PendingOrderAction =
  | {
      type: 'cancel'
      order: OrderRecord
    }
  | null

function getPaymentMethodLabel(order: OrderRecord) {
  if (order.paymentMethod === 'Cash on Delivery') {
    return 'Cash on Delivery'
  }

  return order.paymentMethod
}

function getPaymentStateTone(paymentStatus: OrderRecord['paymentStatus']) {
  return paymentStatus === 'Paid'
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-amber-100 text-amber-700'
}

function getOrderSearchValue(order: OrderRecord) {
  return [
    order.id,
    order.paymentSummary?.reference ?? '',
    order.paymentSummary?.checkoutSessionId ?? '',
  ]
    .join(' ')
    .trim()
    .toLowerCase()
}

function getLastTimelineEntry(order: OrderRecord) {
  return order.timeline[order.timeline.length - 1]
}

export default function OrdersPage() {
  const { user } = useAuth()
  const { cancelOwnOrder, getAvailableStock, orders, isStoreLoading } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] =
    useState<(typeof ORDER_STATUS_FILTERS)[number]>('All Orders')
  const [pendingAction, setPendingAction] = useState<PendingOrderAction>(null)
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null)
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase())

  const userOrders = useMemo(
    () => orders.filter((order) => order.source === 'ONLINE'),
    [orders],
  )

  const filteredOrders = useMemo(() => {
    return userOrders.filter((order) => {
      const matchesSearch =
        deferredSearchQuery.length === 0 || getOrderSearchValue(order).includes(deferredSearchQuery)
      const matchesStatus = statusFilter === 'All Orders' || order.status === statusFilter

      return matchesSearch && matchesStatus
    })
  }, [deferredSearchQuery, statusFilter, userOrders])

  const handleConfirmedAction = async () => {
    if (!pendingAction) {
      return
    }

    const action = pendingAction
    setPendingAction(null)
    setSubmittingOrderId(action.order.id)

    try {
      const result = await cancelOwnOrder(action.order.id)

      toast({
        title: result.ok ? 'Order cancelled' : 'Unable to cancel order',
        description: result.message,
        variant: result.ok ? 'default' : 'destructive',
      })
    } finally {
      setSubmittingOrderId(null)
    }
  }

  return (
    <ProtectedRoute requiredRole="USER">
      <StorefrontShell>
        <StorefrontPageHero
          eyebrow="Order History"
          title="My Orders"
          description="Search your online perfume orders by order ID, payment reference, or PayMongo session, then manage the steps you are allowed to handle yourself."
        />

        <section className="px-4 pb-16 pt-2 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            {isStoreLoading ? (
              <div className="storefront-panel rounded-[2rem] p-12 text-center flex flex-col items-center justify-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-base text-foreground/70">Loading your orders...</p>
              </div>
            ) : userOrders.length === 0 ? (
              <div className="storefront-panel rounded-[2rem] p-12 text-center">
                <p className="text-2xl text-foreground">No online orders are linked to {user?.email} yet.</p>
                <Button className="mt-6 h-11 rounded-2xl bg-primary px-6 text-primary-foreground hover:bg-[#ff8a73]" asChild>
                  <Link href="/shop">Browse Perfumes</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                <article className="storefront-panel rounded-[2rem] p-6 sm:p-8">
                  <div className="grid gap-4 lg:grid-cols-[1.25fr_0.75fr]">
                    <div>
                      <p className="storefront-eyebrow">Self-Service Search</p>
                      <h2 className="mt-3 text-3xl text-foreground">Find The Right Order Fast</h2>
                      <p className="mt-3 max-w-2xl text-sm leading-7 text-foreground/62">
                        Search by order ID, your payment reference, or PayMongo session ID. Cancel only pending or
                        processing orders, and confirm receipt once a parcel is out for delivery.
                      </p>
                    </div>

                    <div className="rounded-[1.5rem] bg-muted/28 p-4 text-sm text-foreground/62">
                      <p className="font-semibold text-foreground">Visible records</p>
                      <p className="mt-2">{filteredOrders.length} matching order(s)</p>
                      <p className="mt-1">{userOrders.length} total online order(s)</p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-[1.2fr_0.8fr]">
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(event) => setSearchQuery(event.target.value)}
                      aria-label="Search your orders by order ID, payment reference, or PayMongo session ID"
                      placeholder="Search by order ID, payment reference, or PayMongo session ID..."
                      className="w-full rounded-2xl border border-border/70 bg-white/80 px-4 py-3 text-foreground placeholder:text-foreground/45 focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                    <select
                      value={statusFilter}
                      aria-label="Filter your orders by status"
                      onChange={(event) =>
                        setStatusFilter(event.target.value as (typeof ORDER_STATUS_FILTERS)[number])
                      }
                      className="w-full rounded-2xl border border-border/70 bg-white/80 px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                      {ORDER_STATUS_FILTERS.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                  </div>
                </article>

                {filteredOrders.length === 0 ? (
                  <div className="storefront-panel rounded-[2rem] p-10 text-center">
                    <p className="text-2xl text-foreground">No orders matched that search or status filter.</p>
                    <p className="mt-3 text-sm leading-7 text-foreground/60">
                      Try a different order ID, payment reference, or PayMongo session ID.
                    </p>
                  </div>
                ) : (
                  filteredOrders.map((order) => {
                    const lastTimelineEntry = getLastTimelineEntry(order)
                    const actionAvailability = order.actionAvailability

                    return (
                      <article key={order.id} className="storefront-panel rounded-[2rem] p-6 sm:p-8">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <p className="storefront-eyebrow">{order.id}</p>
                            <h2 className="mt-3 text-3xl text-foreground">{order.status}</h2>
                            <p className="mt-2 text-sm text-foreground/55">
                              Placed on {new Date(order.createdAt).toLocaleString()}
                            </p>
                            {lastTimelineEntry ? (
                              <p className="mt-3 text-sm text-foreground/60">
                                Latest update: {lastTimelineEntry.note}
                              </p>
                            ) : null}
                          </div>

                          <div className="md:text-right">
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                statusTone[order.status] ?? 'bg-muted text-foreground'
                              }`}
                            >
                              {order.status}
                            </span>
                            <p className="mt-2 text-xs text-foreground/50">
                              Price: <span className="font-medium text-foreground">{formatPHP(order.subtotal)}</span> &bull; VAT (12%): <span className="font-medium text-foreground">{formatPHP(order.tax)}</span>
                            </p>
                            <p className="mt-1 text-sm text-foreground/60">
                              Total: <span className="font-bold text-foreground text-base">{formatPHP(order.total)}</span>
                            </p>
                          </div>
                        </div>

                        <div className="mt-8 grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                          <div className="space-y-4">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/48">
                              Tracking Timeline
                            </h3>
                            {order.timeline.map((entry) => (
                              <div
                                key={`${order.id}-${entry.status}-${entry.createdAt}`}
                                className="rounded-[1.5rem] bg-muted/28 p-4"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <p className="font-semibold text-foreground">{entry.status}</p>
                                  <p className="text-xs text-foreground/48">
                                    {new Date(entry.createdAt).toLocaleString()}
                                  </p>
                                </div>
                                <p className="mt-2 text-sm leading-7 text-foreground/62">{entry.note}</p>
                              </div>
                            ))}
                          </div>

                          <div className="space-y-4">
                            <div className="rounded-[1.5rem] bg-muted/28 p-5">
                              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/48">
                                Payment & Transaction
                              </h3>
                              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                                <div>
                                  <p className="text-xs uppercase tracking-[0.18em] text-foreground/42">
                                    Payment Method
                                  </p>
                                  <p className="mt-2 font-semibold text-foreground">
                                    {getPaymentMethodLabel(order)}
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs uppercase tracking-[0.18em] text-foreground/42">
                                    Payment Status
                                  </p>
                                  <span
                                    className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getPaymentStateTone(order.paymentStatus)}`}
                                  >
                                    {order.paymentStatus}
                                  </span>
                                </div>
                                {order.paymentSummary?.paymentGateway ? (
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-foreground/42">
                                      Gateway
                                    </p>
                                    <p className="mt-2 font-semibold text-foreground">
                                      {order.paymentSummary.paymentGateway}
                                    </p>
                                  </div>
                                ) : null}
                                {order.paymentSummary?.paymentChannel ? (
                                  <div>
                                    <p className="text-xs uppercase tracking-[0.18em] text-foreground/42">
                                      Channel
                                    </p>
                                    <p className="mt-2 font-semibold text-foreground">
                                      {order.paymentSummary.paymentChannel}
                                    </p>
                                  </div>
                                ) : null}
                                {order.paymentSummary?.reference ? (
                                  <div className="sm:col-span-2">
                                    <p className="text-xs uppercase tracking-[0.18em] text-foreground/42">
                                      Payment Reference
                                    </p>
                                    <p className="mt-2 break-all font-medium text-foreground/72">
                                      {order.paymentSummary.reference}
                                    </p>
                                  </div>
                                ) : null}
                                {order.paymentSummary?.checkoutSessionId ? (
                                  <div className="sm:col-span-2">
                                    <p className="text-xs uppercase tracking-[0.18em] text-foreground/42">
                                      PayMongo Session
                                    </p>
                                    <p className="mt-2 break-all font-medium text-foreground/72">
                                      {order.paymentSummary.checkoutSessionId}
                                    </p>
                                  </div>
                                ) : null}
                                {order.paymentSummary?.paidAt ? (
                                  <div className="sm:col-span-2">
                                    <p className="text-xs uppercase tracking-[0.18em] text-foreground/42">
                                      Paid At
                                    </p>
                                    <p className="mt-2 font-medium text-foreground/72">
                                      {new Date(order.paymentSummary.paidAt).toLocaleString()}
                                    </p>
                                  </div>
                                ) : null}
                              </div>

                              {actionAvailability?.needsRefundFollowUp ? (
                                <div className="mt-4 rounded-[1.25rem] border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                                  This order was already paid. Your cancellation is recorded, and our staff will
                                  follow up on the refund separately.
                                </div>
                              ) : null}
                            </div>

                            <div className="rounded-[1.5rem] bg-muted/28 p-5">
                              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/48">
                                Account Actions
                              </h3>
                              <div className="mt-4 flex flex-wrap gap-3">
                                {actionAvailability?.canCancel ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    className="rounded-2xl border-rose-200 bg-white text-rose-700 hover:bg-rose-50"
                                    disabled={submittingOrderId === order.id}
                                    onClick={() => setPendingAction({ type: 'cancel', order })}
                                  >
                                    {submittingOrderId === order.id ? 'Updating...' : 'Cancel Order'}
                                  </Button>
                                ) : null}
                                <Link
                                  href={"/track?num=" + encodeURIComponent(order.trackingNumber || order.id)}
                                  className="inline-flex items-center justify-center rounded-2xl border border-border/80 bg-background px-4 py-2 text-sm font-medium text-foreground hover:bg-muted transition"
                                >
                                  Track Delivery
                                </Link>
                              </div>

                              {order.courier || order.trackingNumber ? (
                                <div className="mt-4 rounded-[1.25rem] bg-muted/28 p-4 text-sm">
                                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-foreground/48">
                                    Delivery
                                  </p>
                                  {order.courier ? (
                                    <p className="mt-2 text-foreground/70">
                                      Courier: <span className="font-medium text-foreground">{order.courier}</span>
                                    </p>
                                  ) : null}
                                  {order.trackingNumber ? (
                                    <p className="mt-1 text-foreground/70">
                                      Tracking number:{' '}
                                      <span className="font-medium text-foreground select-all">
                                        {order.trackingNumber}
                                      </span>
                                    </p>
                                  ) : null}
                                  {order.deliveryNotes ? (
                                    <p className="mt-2 text-foreground/60">{order.deliveryNotes}</p>
                                  ) : null}
                                </div>
                              ) : null}

                              {!actionAvailability?.canCancel && actionAvailability?.cancelBlockedReason ? (
                                <p className="mt-4 text-sm leading-7 text-foreground/60">
                                  Cancel order: {actionAvailability.cancelBlockedReason}
                                </p>
                              ) : null}
                              <p className="mt-2 text-sm leading-7 text-foreground/60">
                                Delivery progress is updated by our store team. Contact support if your
                                parcel has already arrived.
                              </p>
                            </div>

                            <div className="space-y-4">
                              <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/48">
                                Ordered Items
                              </h3>
                              {order.items.map((item) => (
                                <div
                                  key={`${order.id}-${item.productId}-${item.size}`}
                                  className="rounded-[1.5rem] bg-muted/28 p-4"
                                >
                                  <div className="flex items-center justify-between gap-4">
                                    <div>
                                      <p className="font-semibold text-foreground">{item.productName}</p>
                                      <p className="text-sm text-foreground/55">
                                        {item.quantity} x {item.size}ml &bull; {formatPHP(item.unitPrice)} each ({formatPHP(item.unitPrice * item.quantity)})
                                      </p>
                                    </div>
                                    {order.status === 'Delivered' ? (
                                      <Link
                                        href={`/products/${item.productId}`}
                                        className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-semibold text-primary transition hover:bg-primary/20"
                                      >
                                        <Star className="h-3 w-3 fill-primary text-primary" />
                                        Rate & Review
                                      </Link>
                                    ) : null}
                                  </div>
                                  <p className="mt-2 text-sm text-foreground/58">
                                    Current store availability: {getAvailableStock(item.productId)} unit(s)
                                  </p>
                                </div>
                              ))}
                            </div>

                            <div className="rounded-2xl border border-border/70 bg-white/70 p-4 space-y-2.5 text-xs">
                              <div className="flex items-center justify-between">
                                <h3 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/50">
                                  Payment Breakdown
                                </h3>
                                <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                                  BIR 12%
                                </span>
                              </div>
                              <div className="space-y-1.5 text-foreground/75">
                                <div className="flex justify-between items-center">
                                  <span className="text-foreground/60">Price (Subtotal)</span>
                                  <span className="font-mono font-medium text-foreground">{formatPHP(order.subtotal)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-foreground/60">VAT (12%)</span>
                                  <span className="font-mono font-medium text-foreground">{formatPHP(order.tax)}</span>
                                </div>
                                <div className="flex justify-between items-center">
                                  <span className="text-foreground/60">Shipping</span>
                                  <span className="font-mono font-medium text-foreground">
                                    {order.shipping === 0 ? <span className="text-emerald-600 font-semibold uppercase text-[10px]">Free</span> : formatPHP(order.shipping)}
                                  </span>
                                </div>
                                <div className="border-t border-border/70 pt-2 flex justify-between items-baseline font-semibold text-foreground">
                                  <span className="text-xs uppercase tracking-wider">Total Amount</span>
                                  <span className="text-base font-bold font-serif text-primary">{formatPHP(order.total)}</span>
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </article>
                    )
                  })
                )}
              </div>
            )}
          </div>
        </section>

        <AlertDialog
          open={pendingAction !== null}
          onOpenChange={(open) => {
            if (!open) {
              setPendingAction(null)
            }
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingAction?.order.paymentStatus === 'Paid'
                  ? 'This will cancel the order immediately. Because payment was already recorded, the refund will still need staff follow-up.'
                  : 'This will cancel the order immediately and restore the reserved stock.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Order</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleConfirmedAction()}>
                Cancel Order
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </StorefrontShell>
    </ProtectedRoute>
  )
}
