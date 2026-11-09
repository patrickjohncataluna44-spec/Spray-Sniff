export type TrackingStatus =
  | 'order_placed'
  | 'preparing_to_ship'
  | 'picked_up'
  | 'in_transit'
  | 'out_for_delivery'
  | 'delivered'
  | 'failed_attempt'
  | 'exception'

export interface TrackingEvent {
  id: string
  datetime: string
  status: string
  stage: TrackingStatus
  location: string
  description: string
  /** 'store' for internal fulfillment milestones, 'courier' for live ParcelsApp satellite scans. */
  source?: 'store' | 'courier'
  /** Carrier name or code when originated from an external courier scan. */
  carrier?: string
  /** Name of the store admin who recorded this update, when known. */
  recordedBy?: string
  /** The order status this update moved the order away from. */
  previousStatus?: string
}

export interface CourierInfo {
  code: string
  name: string
  slug?: string
  logoUrl?: string
  phone?: string
  website?: string
  externalTrackingUrl?: string
}

export interface TrackingResult {
  trackingNumber: string
  carrier: CourierInfo
  status: TrackingStatus
  statusText: string
  orderId?: string
  origin?: string
  destination?: string
  estimatedDelivery?: string
  lastUpdated: string
  daysInTransit?: number
  isLiveCourier?: boolean
  events: TrackingEvent[]
}

/**
 * The delivery stages a customer sees on the tracker, in order.
 * Shared by the tracker stepper and the admin delivery dialog so the two can
 * never drift apart.
 */
export const DELIVERY_STAGES: {
  stage: TrackingStatus
  status: string
  label: string
}[] = [
  { stage: 'order_placed', status: 'Pending', label: 'Order Placed' },
  { stage: 'preparing_to_ship', status: 'Processing', label: 'Preparing to Ship' },
  { stage: 'picked_up', status: 'Shipped', label: 'Picked Up' },
  { stage: 'in_transit', status: 'In Transit', label: 'In Transit' },
  { stage: 'out_for_delivery', status: 'Out for Delivery', label: 'Out for Delivery' },
  { stage: 'delivered', status: 'Delivered', label: 'Delivered' },
]

/** Maps a stored order status onto the delivery stage the customer tracker shows. */
export function mapOrderStatusToDeliveryStage(status: string): TrackingStatus {
  switch (status) {
    case 'Pending':
      return 'order_placed'
    case 'Processing':
      return 'preparing_to_ship'
    case 'Shipped':
      return 'picked_up'
    case 'In Transit':
      return 'in_transit'
    case 'Out for Delivery':
      return 'out_for_delivery'
    case 'Delivered':
    case 'Completed':
      return 'delivered'
    case 'Cancelled':
      return 'exception'
    default:
      return 'order_placed'
  }
}

export function getDeliveryStageIndex(status: TrackingStatus): number {
  const index = DELIVERY_STAGES.findIndex((entry) => entry.stage === status)
  return index === -1 ? 0 : index
}

/**
 * Delivery statuses that appear as checkpoints in the tracker's event log.
 * Non-delivery activity (payments, cancellations) is filtered out so it is not
 * mistaken for a courier scan.
 */
export const TRACKABLE_EVENT_STATUSES = new Set([
  'Pending',
  'Processing',
  'Shipped',
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'Completed',
  'Cancelled',
])

/** Maps ParcelsApp raw status strings or event checkpoints to standard TrackingStatus */
export function mapParcelsStateToDeliveryStage(raw: string | undefined | null): TrackingStatus {
  if (!raw) return 'in_transit'
  const lower = raw.trim().toLowerCase()

  if (
    lower === 'delivered' ||
    lower.includes('delivered') ||
    lower.includes('successfully received')
  ) {
    return 'delivered'
  }

  if (
    lower === 'out_for_delivery' ||
    lower.includes('out for delivery') ||
    lower.includes('with delivery courier') ||
    lower.includes('with rider')
  ) {
    return 'out_for_delivery'
  }

  if (
    lower === 'picked_up' ||
    lower === 'pickup' ||
    lower.includes('picked up') ||
    lower.includes('accepted at') ||
    lower.includes('parcel received at branch') ||
    lower.includes('shipment collected')
  ) {
    return 'picked_up'
  }

  if (
    lower.includes('failed attempt') ||
    lower.includes('delivery attempt failed') ||
    lower.includes('unsuccessful delivery')
  ) {
    return 'failed_attempt'
  }

  if (
    lower === 'exception' ||
    lower === 'alert' ||
    lower.includes('returned') ||
    lower.includes('held') ||
    lower.includes('damaged') ||
    lower.includes('cancelled')
  ) {
    return 'exception'
  }

  if (lower === 'order_placed' || lower === 'pending') {
    return 'order_placed'
  }

  if (lower === 'preparing_to_ship' || lower === 'processing') {
    return 'preparing_to_ship'
  }

  return 'in_transit'
}

/** Delivery status progression ranks for forward-only updates */
export const DELIVERY_STATUS_RANK: Record<string, number> = {
  Pending: 0,
  Processing: 1,
  Shipped: 2,
  'In Transit': 3,
  'Out for Delivery': 4,
  Delivered: 5,
  Completed: 5,
}

/** Maps a TrackingStatus back to the store order status */
export function mapDeliveryStageToOrderStatus(stage: TrackingStatus): string | null {
  switch (stage) {
    case 'picked_up':
      return 'Shipped'
    case 'in_transit':
      return 'In Transit'
    case 'out_for_delivery':
      return 'Out for Delivery'
    case 'delivered':
      return 'Delivered'
    default:
      return null
  }
}
