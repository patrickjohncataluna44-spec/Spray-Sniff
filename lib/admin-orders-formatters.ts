import { formatPHP } from '@/lib/currency'
import {
  DELIVERY_ORDER_STATUSES,
  parsePosReceiptMetadata,
  type OrderRecord,
  type OrderStatus,
} from '@/lib/store-engine'

export type ChannelView = 'online' | 'pos' | 'all'

export interface FormattedPosPaymentMeta {
  shortRef?: string
  cashDetail?: string
  cleanNote?: string
}

/**
 * Checks whether an order is currently in any courier delivery stage.
 */
export function isDeliveryStage(status: OrderStatus): boolean {
  return (DELIVERY_ORDER_STATUSES as readonly OrderStatus[]).includes(status)
}

/**
 * Human-readable sales channel label for order badges.
 */
export function getChannelLabel(order: Pick<OrderRecord, 'source'>): string {
  return order.source === 'POS' ? 'Walk-In / POS' : 'Online'
}

/**
 * Tonal badge classes for channel pills.
 */
export function getChannelTone(order: Pick<OrderRecord, 'source'>): string {
  return order.source === 'POS'
    ? 'bg-stone-100 text-stone-800 border border-stone-200/90'
    : 'bg-sky-50 text-sky-800 border border-sky-200/80'
}

/**
 * Concise payment method display label.
 */
export function getPaymentMethodLabel(order: Pick<OrderRecord, 'paymentMethod'>): string {
  if (order.paymentMethod === 'Cash on Delivery') {
    return 'COD'
  }
  return order.paymentMethod
}

/**
 * Tonal badge classes for payment state pills.
 */
export function getPaymentStateTone(order: Pick<OrderRecord, 'paymentStatus' | 'status' | 'source'>): string {
  if (order.source === 'POS' && order.status === 'Cancelled') {
    return 'bg-slate-100 text-slate-700 border border-slate-200/90'
  }
  return order.paymentStatus === 'Paid'
    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
    : 'bg-amber-50 text-amber-800 border border-amber-200/80'
}

/**
 * Display label for the payment state badge.
 */
export function getPaymentStateLabel(order: Pick<OrderRecord, 'paymentStatus' | 'status' | 'source' | 'paymentMethod'>): string {
  if (order.source === 'POS' && order.status === 'Cancelled') {
    return order.paymentMethod === 'Cash' ? 'Refunded' : 'Voided'
  }
  return order.paymentStatus
}

/**
 * Tonal badge classes for fulfillment / POS status pills.
 */
export function getStatusTone(status: OrderRecord['status']): string {
  if (status === 'Cancelled') {
    return 'bg-slate-100 text-slate-700 border border-slate-200/90'
  }
  if (status === 'Delivered' || status === 'Completed') {
    return 'bg-emerald-50 text-emerald-800 border border-emerald-200/80'
  }
  return 'bg-accent/12 text-foreground border border-accent/25'
}

/**
 * Concise status text shown inside the Status pill.
 */
export function getOrderStatusLabel(order: Pick<OrderRecord, 'source' | 'status'>): string {
  if (order.source === 'POS') {
    return order.status === 'Cancelled' ? 'Voided' : 'Completed'
  }
  return order.status
}

/**
 * Strips internal storage tokens (e.g. `|cash|[POS-CASH:...]|[POS-REF:...]`)
 * from POS order notes and payment references for clean table display.
 */
export function formatPosPaymentMeta(order: OrderRecord): FormattedPosPaymentMeta {
  const combinedSource = [order.notes, order.paymentSummary?.reference].filter(Boolean).join(' | ')
  const parsed = parsePosReceiptMetadata(combinedSource)

  const refMatch = order.paymentSummary?.reference?.match(/\[POS-REF:([^\]]+)\]/)
  const sessionId = order.paymentSummary?.checkoutSessionId
  const rawPaymongoRef = parsed.paymongoRef
  const cleanDirectRef =
    order.paymentSummary?.reference &&
    !order.paymentSummary.reference.includes('|') &&
    !order.paymentSummary.reference.includes('[POS-')
      ? order.paymentSummary.reference
      : undefined

  const rawRef = refMatch?.[1] || rawPaymongoRef || sessionId || cleanDirectRef
  const shortRef = rawRef
    ? rawRef.length > 22
      ? `${rawRef.slice(0, 18)}...`
      : rawRef
    : undefined

  const cashDetail =
    parsed.tenderedAmount !== undefined &&
    parsed.changeAmount !== undefined &&
    parsed.changeAmount > 0
      ? `Tendered ${formatPHP(parsed.tenderedAmount)} · Change ${formatPHP(parsed.changeAmount)}`
      : undefined

  const cleanNote = parsePosReceiptMetadata(order.notes).cashierNote

  return {
    shortRef,
    cashDetail,
    cleanNote,
  }
}

/**
 * Concise operational payment note shown below payment badges.
 */
export function getPaymentDescription(order: OrderRecord): string {
  if (order.source === 'POS') {
    if (order.status === 'Cancelled') {
      return order.paymentMethod === 'Cash'
        ? 'Voided at backoffice. Cash refunded at drawer.'
        : 'POS sale voided. Verify manual PayMongo refund if needed.'
    }
    const { cashDetail } = formatPosPaymentMeta(order)
    return cashDetail || 'Walk-in payment settled at counter.'
  }

  if (order.status === 'Cancelled') {
    return order.paymentStatus === 'Paid'
      ? 'Cancelled after payment. Refund follow-up required.'
      : 'Cancelled before payment collection.'
  }

  if (order.paymentMethod === 'Cash on Delivery') {
    return order.paymentStatus === 'Paid'
      ? 'COD payment collected.'
      : 'Collect payment upon delivery.'
  }

  return order.paymentStatus === 'Paid'
    ? 'Paid online via checkout.'
    : 'Awaiting online payment confirmation.'
}

/**
 * Determines whether a cancelled order still needs refund follow-up.
 */
export function needsRefundFollowUp(order: OrderRecord): boolean {
  if (order.source === 'POS' && order.paymentMethod === 'Cash') {
    return false
  }
  return (
    order.actionAvailability?.needsRefundFollowUp ??
    (order.status === 'Cancelled' && order.paymentStatus === 'Paid')
  )
}
