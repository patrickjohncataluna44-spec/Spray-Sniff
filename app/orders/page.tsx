'use client'

import Link from 'next/link'
import { useDeferredValue, useMemo, useState } from 'react'
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
  'Out for Delivery': 'bg-[#ffd6a6] text-[#7d5a1f]',
  Delivered: 'bg-[#e6f4ea] text-[#2f7a4e]',
  Cancelled: 'bg-slate-200 text-slate-700',
}

const ORDER_STATUS_FILTERS = [
  'All Orders',
  'Pending',
  'Processing',
  'Shipped',
  'Out for Delivery',
  'Delivered',
  'Cancelled',
] as const

type PendingOrderAction =
  | {
      type: 'cancel'
      order: OrderRecord
    }
  | {
      type: 'confirm'
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
  const { cancelOwnOrder, confirmOwnDelivery, getAvailableStock, orders } = useStore()
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
      const result =
        action.type === 'cancel'
          ? await cancelOwnOrder(action.order.id)
          : await confirmOwnDelivery(action.order.id)

      toast({
        title: result.ok
          ? action.type === 'cancel'
            ? 'Order cancelled'
            : 'Delivery confirmed'
          : action.type === 'cancel'
            ? 'Unable to cancel order'
            : 'Unable to confirm delivery',
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
            {userOrders.length === 0 ? (
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
                            <p className="mt-3 text-sm text-foreground/60">
                              Total: <span className="font-semibold text-foreground">{formatPHP(order.total)}</span>
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
                                {actionAvailability?.canConfirmReceived ? (
                                  <Button
                                    type="button"
                                    className="rounded-2xl bg-primary text-primary-foreground hover:bg-[#ff8a73]"
                                    disabled={submittingOrderId === order.id}
                                    onClick={() => setPendingAction({ type: 'confirm', order })}
                                  >
                                    {submittingOrderId === order.id ? 'Updating...' : 'Confirm Received'}
                                  </Button>
                                ) : null}
                              </div>

                              {!actionAvailability?.canCancel && actionAvailability?.cancelBlockedReason ? (
                                <p className="mt-4 text-sm leading-7 text-foreground/60">
                                  Cancel order: {actionAvailability.cancelBlockedReason}
                                </p>
                              ) : null}
                              {!actionAvailability?.canConfirmReceived &&
                              actionAvailability?.confirmBlockedReason ? (
                                <p className="mt-2 text-sm leading-7 text-foreground/60">
                                  Confirm receipt: {actionAvailability.confirmBlockedReason}
                                </p>
                              ) : null}
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
                                    <p className="font-semibold text-foreground">{item.productName}</p>
                                    <p className="text-sm text-foreground/55">
                                      {item.quantity} x {item.size}ml
                                    </p>
                                  </div>
                                  <p className="mt-2 text-sm text-foreground/58">
                                    Current store availability: {getAvailableStock(item.productId)} unit(s)
                                  </p>
                                </div>
                              ))}
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
              <AlertDialogTitle>
                {pendingAction?.type === 'cancel' ? 'Cancel this order?' : 'Confirm delivery received?'}
              </AlertDialogTitle>
              <AlertDialogDescription>
                {pendingAction?.type === 'cancel'
                  ? pendingAction.order.paymentStatus === 'Paid'
                    ? 'This will cancel the order immediately. Because payment was already recorded, the refund will still need staff follow-up.'
                    : 'This will cancel the order immediately and restore the reserved stock.'
                  : 'Use this only after the parcel has reached you safely. The order will move to Delivered.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Keep Order</AlertDialogCancel>
              <AlertDialogAction onClick={() => void handleConfirmedAction()}>
                {pendingAction?.type === 'cancel' ? 'Cancel Order' : 'Confirm Received'}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </StorefrontShell>
    </ProtectedRoute>
  )
}
