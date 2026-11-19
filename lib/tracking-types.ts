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
  /** UTC offset reported by carrier (`+HH:MM` / `-HH:MM`), omitted when unknown per Parcels v5. */
  utcOffset?: string
  /** IANA timezone supplied by carrier when known (e.g. `Asia/Manila`). */
  timezone?: string
  /** Carrier milestone code when provided (e.g. `DEP`, `ARR`, `DLV`). */
  eventCode?: string
  /** IATA station or airport code associated with the scan. */
  station?: string
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

export interface DeliveryEstimateSummary {
  medianDays: number
  meanDays?: number
  typicalDays?: {
    min?: number
    max?: number
  }
  remainingStatus?: string
  remainingDays?: {
    mean?: number
    median?: number
    min?: number
    max?: number
  }
  estimatedDeliveryAt?: {
    from?: string
    to?: string
  }
  confidenceLevel?: string
}

export interface TrackingInputRequirementSummary {
  required?: string[]
  anyOf?: string[]
  conditional?: string[]
}

export interface TrackingResult {
  trackingNumber: string
  carrier: CourierInfo
  status: TrackingStatus
  statusText: string
  orderId?: string
  requestId?: string
  isProcessing?: boolean
  expiresAt?: string
  origin?: string
  destination?: string
  originCode?: string
  destinationCode?: string
  transportMode?: string
  estimatedDelivery?: string
  deliveryEstimate?: DeliveryEstimateSummary
  lastUpdated: string
  daysInTransit?: number
  isLiveCourier?: boolean
  shipmentError?: string
  acceptedFields?: string[]
  inputRequirements?: TrackingInputRequirementSummary
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
  return DELIVERY_STAGES.findIndex((entry) => entry.stage === status)
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

const ISO_WITH_TZ_RE = /(Z|[+-]\d{2}:\d{2})$/i
const UTC_OFFSET_RE = /^[+-]\d{2}:\d{2}$/

/**
 * Returns an epoch timestamp (ms) suitable for chronological sorting across
 * UTC store milestones and Parcels v5 carrier events.
 *
 * In Parcels API v5, `date` is local wall-clock time without a suffix. When
 * `utcOffset` is known (`+HH:MM`), subtracting it yields true UTC. When
 * `utcOffset` is absent, we do not treat it as true UTC for display, but
 * fall back to a deterministic parse so event lists remain chronologically ordered.
 */
export function toComparableTimestampMs(datetime: string, utcOffset?: string): number {
  const trimmed = datetime.trim()
  if (!trimmed) return 0

  if (ISO_WITH_TZ_RE.test(trimmed)) {
    const ms = Date.parse(trimmed)
    return Number.isNaN(ms) ? 0 : ms
  }

  if (utcOffset && UTC_OFFSET_RE.test(utcOffset.trim())) {
    const ms = Date.parse(`${trimmed}${utcOffset.trim()}`)
    return Number.isNaN(ms) ? 0 : ms
  }

  // Fallback for unknown-offset local timestamps (Philippines store default +08:00)
  const ms = Date.parse(`${trimmed}+08:00`)
  return Number.isNaN(ms) ? 0 : ms
}

/**
 * Formats a Parcels v5 tracking event timestamp for UI display without violating
 * v5 local-time rules:
 * - If the timestamp has an explicit timezone (`Z` or `utcOffset`), formats in the
 *   viewer's local clock (or explicit offset).
 * - If `utcOffset` is omitted, preserves the carrier's local wall-clock reading
 *   as-is and labels it `(local)` so it is never mistakenly shifted as UTC.
 */
export function formatTrackingEventDate(datetime: string, utcOffset?: string): string {
  const trimmed = datetime.trim()
  if (!trimmed) return 'Pending'

  if (ISO_WITH_TZ_RE.test(trimmed)) {
    const parsed = new Date(trimmed)
    if (Number.isNaN(parsed.getTime())) return trimmed
    return parsed.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  if (utcOffset && UTC_OFFSET_RE.test(utcOffset.trim())) {
    const parsed = new Date(`${trimmed}${utcOffset.trim()}`)
    if (Number.isNaN(parsed.getTime())) return `${trimmed} (${utcOffset})`
    return parsed.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  }

  // Unknown offset: format wall-clock components verbatim without timezone conversion
  const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/)
  if (!match) return trimmed
  const [, yearStr, monthStr, dayStr, hourStr, minStr] = match
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const monthLabel = monthNames[Math.max(0, Number(monthStr) - 1)] ?? monthStr
  const hour24 = Number(hourStr)
  const period = hour24 >= 12 ? 'PM' : 'AM'
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12
  return `${monthLabel} ${Number(dayStr)}, ${hour12}:${minStr} ${period} (local)`
}
