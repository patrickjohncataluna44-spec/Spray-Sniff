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
  /** Name of the store admin who recorded this update, when known. */
  recordedBy?: string
  /** The order status this update moved the order away from. */
  previousStatus?: string
}

export interface CourierInfo {
  code: string
  name: string
  logoUrl?: string
  phone?: string
  website?: string
}

export interface TrackingResult {
  trackingNumber: string
  carrier: CourierInfo
  status: TrackingStatus
  statusText: string
  origin?: string
  destination?: string
  estimatedDelivery?: string
  lastUpdated: string
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
