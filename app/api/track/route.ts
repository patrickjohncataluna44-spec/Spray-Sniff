import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { SITE_NAME } from '@/lib/site'
import {
  DELIVERY_STAGES,
  DELIVERY_STATUS_RANK,
  TRACKABLE_EVENT_STATUSES,
  mapOrderStatusToDeliveryStage,
  toComparableTimestampMs,
  type TrackingEvent,
  type TrackingResult,
} from '@/lib/tracking-types'
import {
  ParcelsApiError,
  mapParcelsToTrackingResult,
  pollParcelsTrackingSession,
  trackShipmentSync,
} from '@/lib/parcels-api'
import {
  getParcelsTrackingRequestMetadata,
  saveParcelsTrackingRequest,
  syncOrderWithParcelsShipment,
} from '@/lib/tracking-sync'

const NOT_FOUND_MESSAGE =
  'No order or shipment found for that tracking number. Please check your Order ID (e.g. WEB-XXXXXXXX-XXXX) or waybill tracking number.'

interface TrackableOrderRow {
  id: string
  status: string
  created_at: string
  courier: string | null
  courier_slug?: string | null
  tracking_number: string | null
  delivery_notes: string | null
  notes: string | null
}

function isMissingCourierSlugError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  const msg = (error.message || '').toLowerCase()
  return error.code === '42703' || error.code === 'PGRST204' || msg.includes('courier_slug')
}

async function findStoreOrderForTracking(cleanKey: string): Promise<TrackableOrderRow | null> {
  const supabase = createSupabaseAdminClient()
  const safeKey = cleanKey.replace(/[,()%_*]/g, '').trim()
  if (!safeKey || safeKey.length < 4) return null

  const extendedCols = 'id, status, created_at, courier, courier_slug, tracking_number, delivery_notes, notes'
  const baseCols = 'id, status, created_at, courier, tracking_number, delivery_notes, notes'

  const runExactIdQuery = async (cols: string) =>
    supabase
      .from('store_orders')
      .select(cols)
      .ilike('id', safeKey)
      .limit(1)

  const runExactTrackingQuery = async (cols: string) =>
    supabase
      .from('store_orders')
      .select(cols)
      .ilike('tracking_number', safeKey)
      .limit(1)

  let res = await runExactIdQuery(extendedCols)
  if (res.error && isMissingCourierSlugError(res.error)) {
    res = await runExactIdQuery(baseCols)
  }

  if (res.data && res.data.length > 0) {
    return res.data[0] as unknown as TrackableOrderRow
  }

  let trackRes = await runExactTrackingQuery(extendedCols)
  if (trackRes.error && isMissingCourierSlugError(trackRes.error)) {
    trackRes = await runExactTrackingQuery(baseCols)
  }

  if (trackRes.data && trackRes.data.length > 0) {
    return trackRes.data[0] as unknown as TrackableOrderRow
  }

  return null
}

const COURIER_STAGE_STATUSES = new Set([
  'Shipped',
  'In Transit',
  'Out for Delivery',
  'Delivered',
  'Completed',
])

async function loadInternalTimelineEvents(
  orderId: string,
  courierName?: string | null,
): Promise<TrackingEvent[]> {
  const supabase = createSupabaseAdminClient()
  const { data: timelineEntries, error: timelineError } = await supabase
    .from('order_timeline_entries')
    .select('status, created_at, note, actor_name, previous_status')
    .eq('order_id', orderId)
    .order('created_at', { ascending: false })

  if (timelineError) {
    console.error('Error querying timeline for tracking:', timelineError)
  }

  const trimmedCourier = courierName?.trim() || null

  const rawEvents: TrackingEvent[] = (timelineEntries ?? []).map((entry, index) => {
    const isAutoSync = Boolean(entry.actor_name?.includes('(Auto-sync)'))
    const isCourierMilestone = isAutoSync || (Boolean(trimmedCourier) && COURIER_STAGE_STATUSES.has(entry.status))

    return {
      id: `${orderId}-ev-${index}`,
      datetime: entry.created_at,
      status: entry.status,
      stage: mapOrderStatusToDeliveryStage(entry.status),
      location: isCourierMilestone && trimmedCourier
        ? `${trimmedCourier} — Logistics Update`
        : entry.actor_name
          ? `${SITE_NAME} — ${entry.actor_name}`
          : `${SITE_NAME} store team`,
      description: entry.note,
      source: isCourierMilestone ? 'courier' : 'store',
      carrier: isCourierMilestone && trimmedCourier ? trimmedCourier : undefined,
      recordedBy: entry.actor_name ?? undefined,
      previousStatus: entry.previous_status ?? undefined,
    }
  })

  const filteredEvents = rawEvents.filter((entry) => TRACKABLE_EVENT_STATUSES.has(entry.status))
  const events = filteredEvents.length > 0 ? filteredEvents : rawEvents

  return events.sort(
    (a, b) =>
      toComparableTimestampMs(b.datetime, b.utcOffset) -
      toComparableTimestampMs(a.datetime, a.utcOffset),
  )
}

function buildBaselineOrderResult(
  order: TrackableOrderRow,
  internalEvents: TrackingEvent[],
): TrackingResult {
  const storeStage = mapOrderStatusToDeliveryStage(order.status)
  const deliveredStage = DELIVERY_STAGES[DELIVERY_STAGES.length - 1]
  const estimatedDelivery =
    storeStage === deliveredStage.stage
      ? 'Delivered'
      : storeStage === 'out_for_delivery'
        ? 'Out for delivery today'
        : storeStage === 'in_transit'
          ? 'In transit via courier'
          : storeStage === 'picked_up'
            ? 'Picked up by courier'
            : 'Updated by our store team'

  return {
    trackingNumber: order.tracking_number || order.id,
    orderId: order.id,
    carrier: {
      code: order.courier_slug || 'store',
      slug: order.courier_slug || undefined,
      name: order.courier || `${SITE_NAME} delivery team`,
    },
    status: storeStage,
    statusText: order.status,
    estimatedDelivery,
    lastUpdated: internalEvents[0]?.datetime ?? order.created_at,
    events: internalEvents,
  }
}

function mergeOrderWithParcels(
  order: TrackableOrderRow,
  internalEvents: TrackingEvent[],
  merged: TrackingResult,
): TrackingResult {
  const storeStage = mapOrderStatusToDeliveryStage(order.status)
  const storeRank = DELIVERY_STATUS_RANK[order.status] ?? 0
  const courierRank = DELIVERY_STATUS_RANK[merged.statusText] ?? 0
  const useStoreProgress = storeRank > courierRank

  const effectiveEstimatedDelivery =
    storeStage === 'delivered'
      ? 'Delivered'
      : useStoreProgress
        ? storeStage === 'out_for_delivery'
          ? 'Out for delivery today'
          : storeStage === 'in_transit'
            ? 'In transit via courier'
            : storeStage === 'picked_up'
              ? 'Picked up by courier'
              : merged.estimatedDelivery
        : merged.estimatedDelivery

  return {
    ...merged,
    status: courierRank >= storeRank ? merged.status : storeStage,
    statusText: courierRank >= storeRank ? merged.statusText : order.status,
    estimatedDelivery: effectiveEstimatedDelivery,
    isProcessing: storeStage === 'delivered' ? false : merged.isProcessing,
    orderId: order.id,
    events: merged.events.length > 0 ? merged.events : internalEvents,
  }
}

export async function GET(request: NextRequest) {
  try {
    const requestId = request.nextUrl.searchParams.get('requestId')?.trim()
    const carrierHintParam = request.nextUrl.searchParams.get('carrier')?.trim() || undefined
    const trackingNumber =
      request.nextUrl.searchParams.get('number')?.trim() ||
      request.nextUrl.searchParams.get('num')?.trim() ||
      request.nextUrl.searchParams.get('orderId')?.trim()

    // ── Poll Existing Asynchronous Parcels v5 Request ────────────────────────
    if (requestId) {
      const metadata = await getParcelsTrackingRequestMetadata(requestId)
      const polled = await pollParcelsTrackingSession(requestId)

      if (!polled) {
        return NextResponse.json(
          { error: 'Tracking session expired. Refresh to start a new lookup.', expired: true },
          { status: 404 },
        )
      }

      const item =
        (metadata?.tracking_number
          ? polled.results?.find(
              (r) => r.tracking_number.toLowerCase() === metadata.tracking_number.toLowerCase(),
            )
          : undefined) ??
        polled.results?.[0] ??
        null

      const lookupKey = item?.tracking_number || metadata?.tracking_number || trackingNumber || ''
      const linkedOrder = metadata?.order_id
        ? await findStoreOrderForTracking(metadata.order_id)
        : lookupKey
          ? await findStoreOrderForTracking(lookupKey)
          : null

      await saveParcelsTrackingRequest({
        response: polled,
        trackingNumber: lookupKey,
        orderId: linkedOrder?.id ?? metadata?.order_id ?? null,
        carrierHint: metadata?.carrier_hint ?? linkedOrder?.courier_slug ?? null,
      })

      if (linkedOrder) {
        const internalEvents = await loadInternalTimelineEvents(linkedOrder.id, linkedOrder.courier)
        if (item?.shipment && item.state === 'completed') {
          await syncOrderWithParcelsShipment(linkedOrder, item)
        }

        if (item) {
          const mapped = mapParcelsToTrackingResult(
            item,
            linkedOrder.tracking_number || linkedOrder.id,
            {
              orderId: linkedOrder.id,
              requestId: polled.request_id,
              expiresAt: polled.expires_at,
              internalEvents,
              defaultCourierName: linkedOrder.courier || undefined,
              defaultCourierSlug: linkedOrder.courier_slug || undefined,
            },
          )
          return NextResponse.json(mergeOrderWithParcels(linkedOrder, internalEvents, mapped))
        }

        return NextResponse.json({
          ...buildBaselineOrderResult(linkedOrder, internalEvents),
          requestId: polled.request_id,
          isProcessing: !polled.done,
          expiresAt: polled.expires_at,
        })
      }

      if (item) {
        return NextResponse.json(
          mapParcelsToTrackingResult(item, lookupKey || item.tracking_number, {
            requestId: polled.request_id,
            expiresAt: polled.expires_at,
          }),
        )
      }

      return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 })
    }

    if (!trackingNumber) {
      return NextResponse.json(
        { error: 'An Order ID or tracking number is required.' },
        { status: 400 },
      )
    }

    const cleanKey = trackingNumber.trim()
    const order = await findStoreOrderForTracking(cleanKey)

    // ── SCENARIO A: Store Order Found ────────────────────────────────────────
    if (order) {
      const internalEvents = await loadInternalTimelineEvents(order.id, order.courier)
      let finalResult = buildBaselineOrderResult(order, internalEvents)

      if (order.tracking_number && order.tracking_number.trim()) {
        try {
          const { response, shipmentResult } = await trackShipmentSync({
            trackingNumber: order.tracking_number.trim(),
            carrierHint: order.courier_slug || carrierHintParam || undefined,
            destinationCountry: 'PH',
          })

          await saveParcelsTrackingRequest({
            response,
            trackingNumber: order.tracking_number.trim(),
            orderId: order.id,
            carrierHint: order.courier_slug || carrierHintParam || null,
          })

          if (shipmentResult?.shipment && shipmentResult.state === 'completed') {
            await syncOrderWithParcelsShipment(order, shipmentResult)
          }

          if (shipmentResult) {
            const merged = mapParcelsToTrackingResult(shipmentResult, order.tracking_number, {
              orderId: order.id,
              requestId: response.request_id,
              expiresAt: response.expires_at,
              internalEvents,
              defaultCourierName: order.courier || undefined,
              defaultCourierSlug: order.courier_slug || undefined,
            })

            finalResult = mergeOrderWithParcels(order, internalEvents, merged)
          } else {
            finalResult = {
              ...finalResult,
              requestId: response.request_id,
              isProcessing: !response.done,
              expiresAt: response.expires_at,
            }
          }
        } catch (parcelsErr) {
          console.warn('[ParcelsApp v5 Tracking Query]:', parcelsErr)
          // Continue gracefully with store milestones if courier API is temporarily unavailable
        }
      }

      return NextResponse.json(finalResult)
    }

    // ── SCENARIO B: Direct Courier Waybill Search (No local store order) ─────
    try {
      const { response, shipmentResult, rejected } = await trackShipmentSync({
        trackingNumber: cleanKey,
        carrierHint: carrierHintParam,
        destinationCountry: 'PH',
      })

      await saveParcelsTrackingRequest({
        response,
        trackingNumber: cleanKey,
        orderId: null,
        carrierHint: carrierHintParam || null,
      })

      if (rejected && !shipmentResult) {
        return NextResponse.json({ error: rejected.message || NOT_FOUND_MESSAGE }, { status: 400 })
      }

      if (
        shipmentResult &&
        (shipmentResult.state === 'processing' ||
          shipmentResult.shipment?.states?.length ||
          shipmentResult.shipment?.status ||
          shipmentResult.shipment?.error)
      ) {
        const courierResult = mapParcelsToTrackingResult(shipmentResult, cleanKey, {
          requestId: response.request_id,
          expiresAt: response.expires_at,
          defaultCourierSlug: carrierHintParam,
        })
        return NextResponse.json(courierResult)
      }
    } catch (parcelsErr) {
      if (parcelsErr instanceof ParcelsApiError) {
        console.warn('[Direct ParcelsApp v5 Lookup Error]:', parcelsErr.code, parcelsErr.message)
      } else {
        console.warn('[Direct ParcelsApp v5 Lookup Error]:', parcelsErr)
      }
    }

    return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 })
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : 'Unable to retrieve tracking information.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
