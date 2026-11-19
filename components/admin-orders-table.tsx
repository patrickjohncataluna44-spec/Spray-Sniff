'use client'

import { Package, ReceiptText, RotateCcw, Truck } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  formatPosPaymentMeta,
  getChannelLabel,
  getChannelTone,
  getOrderStatusLabel,
  getPaymentDescription,
  getPaymentMethodLabel,
  getPaymentStateLabel,
  getPaymentStateTone,
  getStatusTone,
  isDeliveryStage,
  needsRefundFollowUp,
  type ChannelView,
} from '@/lib/admin-orders-formatters'
import { formatPHP } from '@/lib/currency'
import { type Product } from '@/lib/products'
import {
  canActorVoidPosOrder,
  type OrderRecord,
  type OrderStatus,
  type PosTransaction,
  type StoreActor,
} from '@/lib/store-engine'

const PRE_DELIVERY_ORDER_STATUSES: OrderStatus[] = ['Pending', 'Processing']

interface AdminOrdersTableProps {
  channelView: ChannelView
  orders: OrderRecord[]
  posTransactionsByOrderId: Map<string, PosTransaction>
  actor: Pick<StoreActor, 'id' | 'name' | 'role'> | null
  getProductById: (productId: string) => Product | undefined
  statusUpdatingOrderId: string | null
  paymentUpdatingOrderId: string | null
  refundingOrderId: string | null
  onStatusChange: (orderId: string, nextStatus: string) => void
  onManageDelivery: (order: OrderRecord) => void
  onRecordPayment: (order: OrderRecord) => void
  onRequestCancelOrVoid: (order: OrderRecord) => void
  onIssueRefund: (order: OrderRecord) => void
  onViewPosReceipt: (order: OrderRecord) => void
  onResetFilters?: () => void
}

function getLastTimelineEntry(order: OrderRecord) {
  return order.timeline[order.timeline.length - 1]
}

export function AdminOrdersTable({
  channelView,
  orders,
  posTransactionsByOrderId,
  actor,
  getProductById,
  statusUpdatingOrderId,
  paymentUpdatingOrderId,
  refundingOrderId,
  onStatusChange,
  onManageDelivery,
  onRecordPayment,
  onRequestCancelOrVoid,
  onIssueRefund,
  onViewPosReceipt,
  onResetFilters,
}: AdminOrdersTableProps) {
  const showChannelColumn = channelView === 'all'
  const isPosOnly = channelView === 'pos'
  const isAdmin = actor?.role === 'ADMIN'

  if (orders.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card px-6 py-12 text-center">
        <p className="text-sm font-medium text-foreground">
          {isPosOnly
            ? 'No walk-in / POS transactions match your current filter.'
            : channelView === 'online'
              ? 'No online orders match your current filter.'
              : 'No orders match your current filter.'}
        </p>
        <p className="mt-1 text-xs text-foreground/60">
          Try clearing the search query or switching status filters.
        </p>
        {onResetFilters && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResetFilters}
            className="mt-4"
          >
            Clear filters
          </Button>
        )}
      </div>
    )
  }

  return (
    <div data-ui="orders-table" className="rounded-2xl border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            {/* taste-skill-ignore: table header rule */}
            <tr className="border-b border-border text-xs text-foreground/60">
              <th className="py-3.5 px-5 text-left font-medium">
                {isPosOnly ? 'Receipt ID' : 'Order'}
              </th>
              {showChannelColumn && (
                <th className="py-3.5 px-4 text-left font-medium">Channel</th>
              )}
              <th className="py-3.5 px-5 text-left font-medium">
                {isPosOnly ? 'Walk-in customer' : 'Customer'}
              </th>
              <th className="py-3.5 px-5 text-left font-medium">Payment</th>
              <th className="py-3.5 px-5 text-right font-medium">Amount</th>
              <th className="py-3.5 px-5 text-left font-medium">
                {isPosOnly ? 'Sale status' : 'Fulfillment'}
              </th>
              <th className="py-3.5 px-5 text-left font-medium">
                {isPosOnly ? 'Cashier & activity' : 'Last activity'}
              </th>
              <th className="py-3.5 px-5 text-left font-medium">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border" /* taste-skill-ignore: table row rules */>
            {orders.map((order) => {
              const lastEntry = getLastTimelineEntry(order)
              const posTransaction = posTransactionsByOrderId.get(order.id)
              const posMeta = order.source === 'POS' ? formatPosPaymentMeta(order) : null
              const canVoidPos =
                order.source === 'POS' &&
                canActorVoidPosOrder(order, actor).allowed
              const canCancelOnline =
                order.source === 'ONLINE' &&
                isAdmin &&
                order.status !== 'Cancelled' &&
                !isDeliveryStage(order.status) &&
                order.status !== 'Delivered' &&
                order.status !== 'Completed'
              const isPreDeliveryOnline =
                order.source === 'ONLINE' &&
                order.status !== 'Cancelled' &&
                !isDeliveryStage(order.status) &&
                order.status !== 'Delivered' &&
                order.status !== 'Completed'

              const displayEmail =
                order.source === 'POS' && order.customerEmail === 'walk-in@sprayandsniff.local'
                  ? 'In-store counter'
                  : order.customerEmail

              return (
                <tr
                  key={order.id}
                  className="align-top transition-colors hover:bg-muted/35"
                >
                  {/* Order / Receipt ID & Item Thumbnails */}
                  <td className="py-4 px-5">
                    <p className="text-xs font-semibold tabular-nums text-foreground whitespace-nowrap">
                      {order.id}
                    </p>
                    <p className="mt-0.5 text-xs text-foreground/55 whitespace-nowrap">
                      {new Date(order.createdAt).toLocaleString()}
                    </p>
                    <div className="mt-2.5 flex items-center gap-1.5">
                      {order.items.slice(0, 3).map((item, idx) => {
                        const product = getProductById(item.productId)
                        const imageUrl = item.image || product?.images?.[0]
                        return (
                          <div
                            key={`${order.id}-thumb-${idx}`}
                            className="relative h-7 w-7 shrink-0 overflow-hidden rounded-md border border-border/80 bg-muted/40"
                            title={`${item.productName} (${item.size}ml x ${item.quantity})`}
                          >
                            {imageUrl ? (
                              <Image
                                src={imageUrl}
                                alt={item.productName}
                                fill
                                className="object-cover"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[9px] text-foreground/45">
                                {item.quantity}x
                              </div>
                            )}
                          </div>
                        )
                      })}
                      {order.items.length > 3 && (
                        <span className="text-[11px] font-medium text-foreground/55 whitespace-nowrap">
                          +{order.items.length - 3} more
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Channel Badge (only in All view) */}
                  {showChannelColumn && (
                    <td className="py-4 px-4">
                      <span
                        className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${getChannelTone(order)}`}
                      >
                        {getChannelLabel(order)}
                      </span>
                    </td>
                  )}

                  {/* Customer */}
                  <td className="py-4 px-5">
                    <p className="font-medium text-foreground">{order.customerName}</p>
                    <p className="mt-0.5 text-xs text-foreground/60">{displayEmail}</p>
                  </td>

                  {/* Payment */}
                  <td className="py-4 px-5">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="inline-flex shrink-0 whitespace-nowrap rounded-full border border-border bg-muted/70 px-2.5 py-0.5 text-xs font-medium text-foreground/80">
                          {getPaymentMethodLabel(order)}
                        </span>
                        <span
                          className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${getPaymentStateTone(order)}`}
                        >
                          {getPaymentStateLabel(order)}
                        </span>
                      </div>
                      <p className="max-w-56 text-xs leading-relaxed text-foreground/60">
                        {getPaymentDescription(order)}
                      </p>
                      {order.source === 'POS' ? (
                        posMeta?.shortRef ? (
                          <p className="text-[11px] tabular-nums text-foreground/50 whitespace-nowrap">
                            Ref: {posMeta.shortRef}
                          </p>
                        ) : null
                      ) : order.paymentSummary?.reference ? (
                        <p className="max-w-56 truncate text-[11px] tabular-nums text-foreground/50">
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
                            onClick={() => onIssueRefund(order)}
                            className="h-7 gap-1.5 border-amber-300 bg-amber-50 text-xs text-amber-900 hover:bg-amber-100"
                          >
                            <RotateCcw className="h-3 w-3" />
                            {refundingOrderId === order.id ? 'Refunding...' : 'Issue Refund'}
                          </Button>
                        ) : (
                          <span className="inline-flex shrink-0 whitespace-nowrap rounded-full border border-amber-200 bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-800">
                            Refund follow-up needed
                          </span>
                        )
                      ) : null}
                    </div>
                  </td>

                  {/* Amount */}
                  <td className="py-4 px-5 text-right tabular-nums whitespace-nowrap">
                    <p className="font-semibold text-foreground">{formatPHP(order.total)}</p>
                    <p className="mt-0.5 text-[11px] text-foreground/55">
                      Sub {formatPHP(order.subtotal)} · VAT {formatPHP(order.tax)}
                    </p>
                    {order.shipping > 0 && (
                      <p className="text-[11px] text-foreground/55">
                        Ship {formatPHP(order.shipping)}
                      </p>
                    )}
                  </td>

                  {/* Fulfillment / Sale Status */}
                  <td className="py-4 px-5">
                    <span
                      className={`inline-flex shrink-0 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium ${getStatusTone(order.status)}`}
                    >
                      {getOrderStatusLabel(order)}
                    </span>
                    {order.source === 'ONLINE' && (order.courier || order.trackingNumber) && (
                      <div className="mt-2 space-y-0.5 text-xs text-foreground/70">
                        {order.courier && (
                          <p className="inline-flex items-center gap-1 font-medium text-foreground">
                            <Truck className="h-3 w-3 shrink-0 text-foreground/50" />
                            <span>{order.courier}</span>
                          </p>
                        )}
                        {order.trackingNumber && (
                          <p className="text-[11px] tabular-nums text-foreground/55 select-all whitespace-nowrap">
                            {order.trackingNumber}
                          </p>
                        )}
                      </div>
                    )}
                  </td>

                  {/* Last Activity / Cashier */}
                  <td className="py-4 px-5">
                    {order.source === 'POS' && posTransaction?.cashierName && (
                      <p className="mb-0.5 text-xs font-medium text-foreground/75">
                        Cashier: {posTransaction.cashierName}
                      </p>
                    )}
                    {lastEntry ? (
                      <>
                        <p className="max-w-56 text-xs leading-relaxed text-foreground/80">
                          {lastEntry.note}
                        </p>
                        <p className="mt-0.5 text-[11px] text-foreground/50 whitespace-nowrap">
                          {new Date(lastEntry.createdAt).toLocaleString()}
                        </p>
                      </>
                    ) : posMeta?.cleanNote ? (
                      <p className="max-w-56 text-xs text-foreground/75">{posMeta.cleanNote}</p>
                    ) : (
                      <p className="text-xs text-foreground/45">No activity recorded</p>
                    )}
                  </td>

                  {/* Actions */}
                  <td className="py-4 px-5">
                    {order.source === 'ONLINE' ? (
                      <div className="space-y-2.5">
                        {isPreDeliveryOnline && (
                          <select
                            value={order.status}
                            aria-label={`Update status for ${order.id}`}
                            onChange={(event) => onStatusChange(order.id, event.target.value)}
                            disabled={statusUpdatingOrderId === order.id}
                            className="h-8 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {PRE_DELIVERY_ORDER_STATUSES.map((status) => (
                              <option key={status} value={status}>
                                {status}
                              </option>
                            ))}
                          </select>
                        )}

                        {order.status !== 'Cancelled' ? (
                          isAdmin ? (
                            <div className="flex flex-wrap items-center gap-1.5">
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => onManageDelivery(order)}
                                className="h-8 text-xs"
                              >
                                Manage Delivery
                              </Button>
                              {canCancelOnline && (
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  className="h-8 border-rose-200 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                                  onClick={() => onRequestCancelOrVoid(order)}
                                >
                                  Cancel Order
                                </Button>
                              )}
                            </div>
                          ) : (
                            <p className="text-xs text-foreground/50">
                              Delivery managed by admin
                            </p>
                          )
                        ) : (
                          <p className="text-xs text-foreground/50">
                            Cancelled — order locked
                          </p>
                        )}

                        {order.paymentStatus === 'Pending' && order.status !== 'Cancelled' && (
                          <div>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={paymentUpdatingOrderId === order.id}
                              onClick={() => onRecordPayment(order)}
                              className="h-8 text-xs"
                            >
                              {paymentUpdatingOrderId === order.id
                                ? 'Recording...'
                                : order.paymentMethod === 'Cash on Delivery'
                                  ? 'Mark COD Paid'
                                  : 'Mark Paid'}
                            </Button>
                          </div>
                        )}

                        <div>
                          <Link
                            href={`/track?num=${encodeURIComponent(order.trackingNumber || order.id)}`}
                            target="_blank"
                            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline whitespace-nowrap"
                          >
                            <Package className="h-3.5 w-3.5" />
                            View Live Tracking
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-1.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => onViewPosReceipt(order)}
                            className="h-8 gap-1.5 text-xs"
                          >
                            <ReceiptText className="h-3.5 w-3.5" />
                            View Receipt
                          </Button>
                          {canVoidPos && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              className="h-8 border-rose-200 text-xs text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                              onClick={() => onRequestCancelOrVoid(order)}
                            >
                              Void POS Sale
                            </Button>
                          )}
                        </div>
                        {order.status === 'Cancelled' && (
                          <p className="text-xs text-foreground/50">
                            Voided · stock restored
                          </p>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
