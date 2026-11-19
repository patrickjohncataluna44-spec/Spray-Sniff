import '@/lib/server-only'
import crypto from 'crypto'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { getOptionalServerEnv } from '@/lib/server-runtime-env'
import { markBackofficeStateDirty } from '@/lib/store-persistence'
import {
  DELIVERY_STATUS_RANK,
  mapDeliveryStageToOrderStatus,
  mapParcelsStateToDeliveryStage,
  toComparableTimestampMs,
} from '@/lib/tracking-types'
import type {
  ParcelsTrackingResponse,
  ParcelsTrackingResultItem,
} from '@/lib/parcels-api'

interface CachedTrackingRequest {
  request_id: string
  tracking_number: string
  order_id?: string | null
  carrier_hint?: string | null
  webhook_secret?: string | null
  status: string
  expires_at?: string | null
  last_payload?: unknown
}

// In-memory fallback when the Supabase migration has not yet been applied
const memoryTrackingRequests = new Map<string, CachedTrackingRequest>()

function isMissingSchemaObjectError(error: { code?: string; message?: string } | null | undefined): boolean {
  if (!error) return false
  const msg = (error.message || '').toLowerCase()
  return (
    error.code === '42P01' ||
    error.code === '42703' ||
    error.code === 'PGRST204' ||
    error.code === 'PGRST205' ||
    msg.includes('does not exist') ||
    msg.includes('schema cache')
  )
}

export async function saveParcelsTrackingRequest(input: {
  response: ParcelsTrackingResponse
  trackingNumber: string
  orderId?: string | null
  carrierHint?: string | null
}): Promise<void> {
  const { response } = input
  if (!response?.request_id) return

  const record: CachedTrackingRequest = {
    request_id: response.request_id,
    tracking_number: input.trackingNumber.trim(),
    order_id: input.orderId ?? null,
    carrier_hint: input.carrierHint ?? null,
    webhook_secret: response.webhook?.secret ?? null,
    status: response.done || response.status === 'completed' ? 'completed' : 'processing',
    expires_at: response.expires_at ?? null,
    last_payload: response,
  }

  memoryTrackingRequests.set(record.request_id, record)

  try {
    const supabase = createSupabaseAdminClient()
    const payloadToUpsert: Record<string, unknown> = {
      request_id: record.request_id,
      tracking_number: record.tracking_number,
      order_id: record.order_id,
      carrier_hint: record.carrier_hint,
      status: record.status,
      expires_at: record.expires_at,
      last_payload: record.last_payload,
      updated_at: new Date().toISOString(),
    }

    // Only overwrite webhook_secret if a new secret was returned by POST /trackings
    if (record.webhook_secret) {
      payloadToUpsert.webhook_secret = record.webhook_secret
    }

    const { error } = await supabase
      .from('parcels_tracking_requests')
      .upsert(payloadToUpsert, { onConflict: 'request_id' })

    if (error && !isMissingSchemaObjectError(error)) {
      console.warn('[Parcels Sync] Failed to persist tracking request:', error.message)
    }
  } catch (err) {
    console.warn('[Parcels Sync] Exception persisting tracking request:', err)
  }
}

export async function getParcelsWebhookSecret(requestId?: string | null): Promise<string | undefined> {
  const trimmedId = requestId?.trim()

  if (trimmedId) {
    const cached = memoryTrackingRequests.get(trimmedId)
    if (cached?.webhook_secret) {
      return cached.webhook_secret
    }

    try {
      const supabase = createSupabaseAdminClient()
      const { data, error } = await supabase
        .from('parcels_tracking_requests')
        .select('webhook_secret')
        .eq('request_id', trimmedId)
        .limit(1)

      if (!error && data?.[0]?.webhook_secret) {
        return data[0].webhook_secret
      }
    } catch {
      // Fall through to env secret
    }
  }

  return getOptionalServerEnv('PARCELS_WEBHOOK_SECRET')
}

export async function getParcelsTrackingRequestMetadata(requestId: string): Promise<CachedTrackingRequest | null> {
  const trimmedId = requestId.trim()
  if (!trimmedId) return null

  const cached = memoryTrackingRequests.get(trimmedId)
  try {
    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('parcels_tracking_requests')
      .select('request_id, tracking_number, order_id, carrier_hint, webhook_secret, status, expires_at')
      .eq('request_id', trimmedId)
      .limit(1)

    if (!error && data?.[0]) {
      return data[0] as CachedTrackingRequest
    }
  } catch {
    // Fall back to memory
  }

  return cached ?? null
}

function buildDeterministicTimelineId(
  orderId: string,
  stateText: string,
  dateText: string,
  locationText: string,
): string {
  const hash = crypto
    .createHash('sha1')
    .update(`${orderId}|${stateText}|${dateText}|${locationText}`)
    .digest('hex')
    .slice(0, 14)

  return `${orderId}-parcels-${hash}`
}

export interface SyncOrderResult {
  updatedStatus: boolean
  recordedCheckpoint: boolean
  newStatus?: string
  carrierName?: string
}

/**
 * Synchronizes a Parcels v5 `TrackingResult` item onto a `store_orders` record
 * and its `order_timeline_entries`, advancing status strictly forward and
 * deduplicating checkpoints deterministically.
 */
export async function syncOrderWithParcelsShipment(
  order: {
    id: string
    status: string
    courier?: string | null
    courier_slug?: string | null
  },
  item: ParcelsTrackingResultItem,
): Promise<SyncOrderResult> {
  if (order.status === 'Cancelled' || order.status === 'Completed') {
    return { updatedStatus: false, recordedCheckpoint: false }
  }

  const shipment = item.shipment
  if (!shipment || item.state === 'processing') {
    return { updatedStatus: false, recordedCheckpoint: false }
  }

  const sortedStates = [...(shipment.states ?? [])].sort(
    (a, b) => toComparableTimestampMs(b.date, b.utcOffset) - toComparableTimestampMs(a.date, a.utcOffset),
  )

  const latestCheckpoint = sortedStates[0]
  const rawStatus = shipment.status || latestCheckpoint?.state || item.state
  const detectedStage = mapParcelsStateToDeliveryStage(rawStatus)
  const newOrderStatus = mapDeliveryStageToOrderStatus(detectedStage)

  const detectedCarrier = shipment.detectedCarrier || shipment.services?.[0]
  const carrierName = detectedCarrier?.name || order.courier || 'Courier'
  const carrierSlug = detectedCarrier?.slug || order.courier_slug || undefined

  const currentRank = DELIVERY_STATUS_RANK[order.status] ?? 0
  const nextRank = newOrderStatus ? (DELIVERY_STATUS_RANK[newOrderStatus] ?? 0) : 0
  const shouldAdvanceStatus = Boolean(newOrderStatus && nextRank > currentRank)
  const effectiveStatus = shouldAdvanceStatus && newOrderStatus ? newOrderStatus : order.status
  const isDeliveredResult = effectiveStatus === 'Delivered' || detectedStage === 'delivered'

  const supabase = createSupabaseAdminClient()
  const now = new Date().toISOString()

  type OrderFinancialRow = {
    source: string
    customer_id: string | null
    customer_name: string
    customer_email: string
    payment_method: string
    payment_status: string
    subtotal: number
    tax: number
    shipping: number
    total: number
  }

  let orderFinancials: OrderFinancialRow | null = null

  if (isDeliveredResult) {
    const { data: orderDetail } = await supabase
      .from('store_orders')
      .select(
        'source, customer_id, customer_name, customer_email, payment_method, payment_status, subtotal, tax, shipping, total',
      )
      .eq('id', order.id)
      .maybeSingle()

    if (orderDetail) {
      orderFinancials = orderDetail as OrderFinancialRow
    }
  }

  const shouldAutoSettleCod = Boolean(
    isDeliveredResult &&
      orderFinancials &&
      orderFinancials.payment_method === 'Cash on Delivery' &&
      orderFinancials.payment_status !== 'Paid',
  )

  const orderUpdateExtended: Record<string, unknown> = {
    updated_at: now,
    parcels_last_synced_at: now,
  }
  const orderUpdateFallback: Record<string, unknown> = {
    updated_at: now,
  }

  if (shouldAdvanceStatus && newOrderStatus) {
    orderUpdateExtended.status = newOrderStatus
    orderUpdateFallback.status = newOrderStatus
  }

  if (shouldAutoSettleCod) {
    orderUpdateExtended.payment_status = 'Paid'
    orderUpdateFallback.payment_status = 'Paid'
  }

  if (!order.courier && detectedCarrier?.name) {
    orderUpdateExtended.courier = detectedCarrier.name
    orderUpdateFallback.courier = detectedCarrier.name
  }

  if (!order.courier_slug && carrierSlug) {
    orderUpdateExtended.courier_slug = carrierSlug
  }

  let updateRes = await supabase
    .from('store_orders')
    .update(orderUpdateExtended)
    .eq('id', order.id)

  if (updateRes.error && isMissingSchemaObjectError(updateRes.error)) {
    updateRes = await supabase
      .from('store_orders')
      .update(orderUpdateFallback)
      .eq('id', order.id)
  }

  if (updateRes.error) {
    console.error(`[Parcels Sync] Failed to update store_orders for ${order.id}:`, updateRes.error.message)
    return { updatedStatus: false, recordedCheckpoint: false }
  }

  if (shouldAutoSettleCod && orderFinancials) {
    const { error: payErr } = await supabase.from('payment_records').upsert(
      {
        id: `${order.id}::payment`,
        order_id: order.id,
        source: orderFinancials.source,
        customer_id: orderFinancials.customer_id,
        customer_name: orderFinancials.customer_name,
        customer_email: orderFinancials.customer_email,
        amount: Number(orderFinancials.total),
        subtotal: Number(orderFinancials.subtotal),
        tax: Number(orderFinancials.tax),
        shipping: Number(orderFinancials.shipping),
        payment_method: 'Cash on Delivery',
        payment_gateway: null,
        payment_channel: null,
        checkout_session_id: null,
        reference: `COD delivered via ${carrierName}`,
        status: 'succeeded',
        paid_at: now,
      },
      { onConflict: 'id' },
    )

    if (payErr) {
      console.warn(`[Parcels Sync] Failed to record COD payment for ${order.id}:`, payErr.message)
    }
  }

  let recordedCheckpoint = false
  if (latestCheckpoint?.state) {
    const checkpointText = latestCheckpoint.location
      ? `${latestCheckpoint.state} (${latestCheckpoint.location})`
      : latestCheckpoint.state

    const timelineId = buildDeterministicTimelineId(
      order.id,
      latestCheckpoint.state,
      latestCheckpoint.date || '',
      latestCheckpoint.location || '',
    )

    const targetStatus = shouldAdvanceStatus && newOrderStatus ? newOrderStatus : order.status
    const { error: timelineErr } = await supabase
      .from('order_timeline_entries')
      .upsert(
        {
          id: timelineId,
          order_id: order.id,
          status: targetStatus,
          created_at: now,
          actor_name: `${carrierName} (Auto-sync)`,
          previous_status: order.status,
          note: checkpointText,
        },
        { onConflict: 'id', ignoreDuplicates: true },
      )

    if (!timelineErr) {
      recordedCheckpoint = true
    } else {
      console.warn(`[Parcels Sync] Timeline upsert error for ${order.id}:`, timelineErr.message)
    }
  } else if (shouldAdvanceStatus && newOrderStatus) {
    const timelineId = buildDeterministicTimelineId(order.id, newOrderStatus, rawStatus || '', carrierName)
    const { error: timelineErr } = await supabase
      .from('order_timeline_entries')
      .upsert(
        {
          id: timelineId,
          order_id: order.id,
          status: newOrderStatus,
          created_at: now,
          actor_name: `${carrierName} (Auto-sync)`,
          previous_status: order.status,
          note: `Courier status: ${rawStatus}`,
        },
        { onConflict: 'id', ignoreDuplicates: true },
      )

    if (!timelineErr) {
      recordedCheckpoint = true
    }
  }

  if (shouldAdvanceStatus || recordedCheckpoint || shouldAutoSettleCod) {
    await markBackofficeStateDirty().catch(() => {})
  }

  return {
    updatedStatus: shouldAdvanceStatus,
    recordedCheckpoint,
    newStatus: shouldAdvanceStatus ? (newOrderStatus ?? undefined) : undefined,
    carrierName,
  }
}
