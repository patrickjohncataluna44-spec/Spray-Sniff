import '@/lib/server-only'
import crypto from 'crypto'
import { getOptionalServerEnv } from '@/lib/server-runtime-env'
import {
  mapParcelsStateToDeliveryStage,
  type CourierInfo,
  type TrackingEvent,
  type TrackingResult,
  type TrackingStatus,
} from '@/lib/tracking-types'

const LIVE_API_BASE = 'https://parcelsapp.com/api/v4'
const MOCK_API_BASE = 'https://parcelsapp.com/api-docs/mock/v4'

export interface ParcelsCarrier {
  slug: string
  name: string
  phone?: string
  url?: string
}

export interface ParcelsState {
  state: string
  location?: string
  date: string
  carrier?: number
}

export interface ParcelsExternalTracking {
  slug: string
  url: string
  trackingId?: string
  method?: string
}

export interface ParcelsShipment {
  trackingId?: string
  status?: string
  origin?: string
  destination?: string
  originCode?: string
  destinationCode?: string
  daysInTransit?: number
  states?: ParcelsState[]
  services?: ParcelsCarrier[]
  detectedCarrier?: ParcelsCarrier
  externalTracking?: ParcelsExternalTracking[]
  error?: string
}

export interface ParcelsTrackingResultItem {
  tracking_number: string
  state: 'processing' | 'completed'
  from_cache?: boolean
  shipment?: ParcelsShipment
}

export interface ParcelsTrackingResponse {
  request_id: string
  status: string
  done: boolean
  expires_at?: string
  results?: ParcelsTrackingResultItem[]
  error?: {
    code: string
    message: string
  }
}

export interface TrackShipmentOptions {
  trackingNumber: string
  destinationCountry?: string
  carrierHint?: string
  webhookUrl?: string
  maxPollSeconds?: number
}

/**
 * Returns the active ParcelsApp API base URL and optional API token.
 * Defaults to the official mock sandbox when no key is set in .env.
 */
export function getParcelsConfig() {
  const apiKey = getOptionalServerEnv('PARCELS_API_KEY')
  const isLive = Boolean(apiKey)
  const baseUrl = isLive ? LIVE_API_BASE : MOCK_API_BASE

  return {
    apiKey,
    baseUrl,
    isLive,
    isMock: !isLive,
  }
}

function getAuthHeaders(apiKey?: string): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  }

  if (apiKey) {
    headers.Authorization = `Bearer ${apiKey}`
  }

  return headers
}

/**
 * Initiates an asynchronous tracking request with ParcelsApp.
 */
export async function createParcelsTrackingSession(options: {
  trackingNumber: string
  destinationCountry?: string
  carrierHint?: string
  webhookUrl?: string
}): Promise<ParcelsTrackingResponse> {
  const { apiKey, baseUrl } = getParcelsConfig()
  const siteUrl = getOptionalServerEnv('NEXT_PUBLIC_SITE_URL')
  const defaultWebhookUrl = siteUrl ? `${siteUrl.replace(/\/$/, '')}/api/webhooks/parcels` : undefined

  const payload = {
    language: 'en',
    webhook_url: options.webhookUrl || defaultWebhookUrl,
    shipments: [
      {
        tracking_number: options.trackingNumber.trim(),
        destination_country: options.destinationCountry?.trim() || 'PH',
        carrier_hint: options.carrierHint?.trim() || undefined,
      },
    ],
  }

  const res = await fetch(`${baseUrl}/trackings`, {
    method: 'POST',
    headers: getAuthHeaders(apiKey),
    body: JSON.stringify(payload),
    cache: 'no-store',
  })

  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new Error(`ParcelsApp API error (${res.status}): ${errorText || res.statusText}`)
  }

  const data = (await res.json()) as ParcelsTrackingResponse
  return data
}

/**
 * Polls the temporary tracking task for completed courier records.
 */
export async function pollParcelsTrackingSession(
  requestId: string,
): Promise<ParcelsTrackingResponse | null> {
  const { apiKey, baseUrl } = getParcelsConfig()

  const res = await fetch(`${baseUrl}/trackings/${encodeURIComponent(requestId)}`, {
    method: 'GET',
    headers: getAuthHeaders(apiKey),
    cache: 'no-store',
  })

  if (res.status === 404) {
    return null
  }

  if (!res.ok) {
    const errorText = await res.text().catch(() => '')
    throw new Error(`ParcelsApp poll error (${res.status}): ${errorText || res.statusText}`)
  }

  return (await res.json()) as ParcelsTrackingResponse
}

/**
 * Tracks a shipment synchronously by creating a request and briefly polling
 * if results are not already available in cache.
 */
export async function trackShipmentSync(
  options: TrackShipmentOptions,
): Promise<{
  response: ParcelsTrackingResponse
  shipmentResult: ParcelsTrackingResultItem | null
}> {
  const trimmed = options.trackingNumber.trim()
  if (!trimmed) {
    throw new Error('Tracking number is required.')
  }

  let session = await createParcelsTrackingSession({
    trackingNumber: trimmed,
    destinationCountry: options.destinationCountry,
    carrierHint: options.carrierHint,
    webhookUrl: options.webhookUrl,
  })

  const findResult = (resp: ParcelsTrackingResponse) =>
    resp.results?.find((r) => r.tracking_number.toLowerCase() === trimmed.toLowerCase()) ??
    resp.results?.[0] ??
    null

  let currentResult = findResult(session)

  // If already completed or served from cache, return immediately
  if (session.done || currentResult?.state === 'completed' || currentResult?.from_cache) {
    return { response: session, shipmentResult: currentResult }
  }

  // Otherwise poll up to maxPollSeconds (default 2.5s)
  const maxAttempts = 3
  const intervalMs = 800

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs))

    try {
      const polled = await pollParcelsTrackingSession(session.request_id)
      if (polled) {
        session = polled
        currentResult = findResult(polled)

        if (session.done || currentResult?.state === 'completed') {
          break
        }
      }
    } catch (pollErr) {
      console.warn('[ParcelsApp Polling Error]:', pollErr)
      break
    }
  }

  return { response: session, shipmentResult: currentResult }
}

/**
 * Validates the ParcelsApp HMAC-SHA256 signature on incoming webhook callbacks.
 * Header format: `t=<unix_timestamp>,v1=<hex_signature>`.
 */
export function verifyParcelsWebhookSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
): { valid: boolean; reason?: string } {
  if (!signatureHeader) {
    return { valid: false, reason: 'Missing Parcels-Signature header.' }
  }

  const parts: Record<string, string> = {}
  for (const item of signatureHeader.split(',')) {
    const [key, value] = item.split('=', 2)
    if (key && value) {
      parts[key.trim()] = value.trim()
    }
  }

  const timestamp = parts.t
  const v1 = parts.v1

  if (!timestamp || !v1) {
    return { valid: false, reason: 'Malformed Parcels-Signature header.' }
  }

  // Reject signatures older than 5 minutes (300 seconds)
  const nowUnix = Math.floor(Date.now() / 1000)
  const eventUnix = parseInt(timestamp, 10)
  if (Number.isNaN(eventUnix) || Math.abs(nowUnix - eventUnix) > 300) {
    return { valid: false, reason: 'Webhook signature timestamp outside the 5-minute tolerance window.' }
  }

  try {
    const signedPayload = `${timestamp}.${rawBody}`
    const expected = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex')

    const v1Buf = Buffer.from(v1, 'hex')
    const expBuf = Buffer.from(expected, 'hex')

    if (v1Buf.length !== expBuf.length || !crypto.timingSafeEqual(v1Buf, expBuf)) {
      return { valid: false, reason: 'Signature mismatch.' }
    }

    return { valid: true }
  } catch (err) {
    return { valid: false, reason: `Signature verification exception: ${String(err)}` }
  }
}

/**
 * Searches the ParcelsApp courier directory (1,540+ global couriers).
 */
export async function searchParcelsCarriers(query: string): Promise<ParcelsCarrier[]> {
  const { baseUrl } = getParcelsConfig()
  const trimmed = query.trim()
  const url = `${baseUrl}/carriers${trimmed ? `?query=${encodeURIComponent(trimmed)}` : ''}`

  const res = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    next: { revalidate: 3600 },
  })

  if (!res.ok) {
    return []
  }

  const data = await res.json().catch(() => null)
  return (data?.carriers as ParcelsCarrier[]) ?? []
}

/**
 * Transforms ParcelsApp shipment data into the application's unified TrackingResult.
 */
export function mapParcelsToTrackingResult(
  item: ParcelsTrackingResultItem,
  fallbackTrackingNumber: string,
  extra?: {
    orderId?: string
    internalEvents?: TrackingEvent[]
    defaultCourierName?: string
  },
): TrackingResult {
  const shipment = item.shipment
  const trackingNumber = item.tracking_number || shipment?.trackingId || fallbackTrackingNumber
  const detected = shipment?.detectedCarrier || shipment?.services?.[0]
  const externalTrack = shipment?.externalTracking?.[0]

  const carrier: CourierInfo = {
    code: detected?.slug || 'courier',
    slug: detected?.slug,
    name: detected?.name || extra?.defaultCourierName || 'Courier Partner',
    phone: detected?.phone,
    website: detected?.url,
    externalTrackingUrl: externalTrack?.url,
  }

  // Transform external carrier states into standard TrackingEvents
  const courierEvents: TrackingEvent[] = (shipment?.states ?? []).map((state, index) => {
    const stage = mapParcelsStateToDeliveryStage(state.state)
    return {
      id: `parcels-${trackingNumber}-${index}`,
      datetime: state.date || new Date().toISOString(),
      status: state.state,
      stage,
      location: state.location || 'Courier Transit Hub',
      description: state.state,
      source: 'courier',
      carrier: carrier.name,
    }
  })

  // Merge with existing store preparation milestones (e.g., Order Placed, Packaging in Boutique)
  const mergedEvents = [...(extra?.internalEvents ?? []), ...courierEvents].sort(
    (a, b) => new Date(b.datetime).getTime() - new Date(a.datetime).getTime(),
  )

  const rawStatus = shipment?.status || courierEvents[0]?.status || item.state
  const stage = mapParcelsStateToDeliveryStage(rawStatus)

  const statusText =
    stage === 'delivered'
      ? 'Delivered'
      : stage === 'out_for_delivery'
        ? 'Out for Delivery'
        : stage === 'in_transit'
          ? 'In Transit'
          : stage === 'picked_up'
            ? 'Picked Up by Courier'
            : stage === 'failed_attempt'
              ? 'Delivery Attempt Failed'
              : stage === 'exception'
                ? 'Delivery Exception'
                : 'In Transit'

  const estimatedDelivery =
    stage === 'delivered'
      ? 'Delivered'
      : shipment?.daysInTransit
        ? `${shipment.daysInTransit} day(s) in transit`
        : 'In transit via courier'

  return {
    trackingNumber,
    orderId: extra?.orderId,
    carrier,
    status: stage,
    statusText,
    origin: shipment?.origin,
    destination: shipment?.destination,
    estimatedDelivery,
    lastUpdated: mergedEvents[0]?.datetime ?? new Date().toISOString(),
    daysInTransit: shipment?.daysInTransit,
    isLiveCourier: courierEvents.length > 0,
    events: mergedEvents,
  }
}

