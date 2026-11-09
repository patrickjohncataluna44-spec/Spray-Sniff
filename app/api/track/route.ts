import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { SITE_NAME } from '@/lib/site'
import {
  DELIVERY_STAGES,
  DELIVERY_STATUS_RANK,
  TRACKABLE_EVENT_STATUSES,
  mapOrderStatusToDeliveryStage,
  type TrackingEvent,
  type TrackingResult,
} from '@/lib/tracking-types'
import {
  mapParcelsToTrackingResult,
  trackShipmentSync,
} from '@/lib/parcels-api'

const NOT_FOUND_MESSAGE =
  'No order or shipment found for that tracking number. Please check your Order ID (e.g. WEB-XXXXXXXX-XXXX) or waybill tracking number.'

export async function GET(request: NextRequest) {
  try {
    const trackingNumber =
      request.nextUrl.searchParams.get('number')?.trim() ||
      request.nextUrl.searchParams.get('num')?.trim() ||
      request.nextUrl.searchParams.get('orderId')?.trim()

    if (!trackingNumber) {
      return NextResponse.json(
        { error: 'An Order ID or tracking number is required.' },
        { status: 400 },
      )
    }

    const cleanKey = trackingNumber.trim()
    const supabase = createSupabaseAdminClient()

    // 1. Search store_orders by ID, tracking_number, or reference in notes
    let query = supabase
      .from('store_orders')
      .select('id, status, created_at, courier, tracking_number, delivery_notes, notes, shipping_address, customer_name')
      .or(`id.ilike.${cleanKey},tracking_number.ilike.${cleanKey}`)

    const { data: matchedOrders, error: orderError } = await query.limit(1)

    if (orderError) {
      console.error('Error querying order for tracking:', orderError)
    }

    let order = matchedOrders && matchedOrders.length > 0 ? matchedOrders[0] : null

    // If not found by exact ID or tracking_number, check if cleanKey is matched in notes
    if (!order) {
      const { data: notesMatch } = await supabase
        .from('store_orders')
        .select('id, status, created_at, courier, tracking_number, delivery_notes, notes, shipping_address, customer_name')
        .ilike('notes', `%${cleanKey}%`)
        .limit(1)

      if (notesMatch && notesMatch.length > 0) {
        order = notesMatch[0]
      }
    }

    // ── SCENARIO A: Store Order Found ───────────────────────────────────
    if (order) {
      // Fetch timeline entries for this order
      const { data: timelineEntries, error: timelineError } = await supabase
        .from('order_timeline_entries')
        .select('status, created_at, note, actor_name, previous_status')
        .eq('order_id', order.id)
        .order('created_at', { ascending: false })

      if (timelineError) {
        console.error('Error querying timeline for tracking:', timelineError)
      }

      const rawEvents: TrackingEvent[] = (timelineEntries ?? []).map((entry, index) => ({
        id: `${order.id}-ev-${index}`,
        datetime: entry.created_at,
        status: entry.status,
        stage: mapOrderStatusToDeliveryStage(entry.status),
        location: entry.actor_name ? `${SITE_NAME} — ${entry.actor_name}` : `${SITE_NAME} store team`,
        description: entry.note,
        source: 'store',
        recordedBy: entry.actor_name ?? undefined,
        previousStatus: entry.previous_status ?? undefined,
      }))

      const filteredEvents = rawEvents.filter((entry) => TRACKABLE_EVENT_STATUSES.has(entry.status))
      const internalEvents = filteredEvents.length > 0 ? filteredEvents : rawEvents

      const storeStage = mapOrderStatusToDeliveryStage(order.status)
      const deliveredStage = DELIVERY_STAGES[DELIVERY_STAGES.length - 1]

      // Default baseline result based on store records
      let finalResult: TrackingResult = {
        trackingNumber: order.tracking_number || order.id,
        orderId: order.id,
        carrier: {
          code: 'store',
          name: order.courier || `${SITE_NAME} delivery team`,
        },
        status: storeStage,
        statusText: order.status,
        estimatedDelivery:
          storeStage === deliveredStage.stage ? 'Delivered' : 'Updated by our store team',
        lastUpdated: internalEvents[0]?.datetime ?? order.created_at,
        events: internalEvents,
      }

      // If order has an assigned courier waybill, query ParcelsApp for live satellite/courier scans
      if (order.tracking_number && order.tracking_number.trim()) {
        try {
          const { shipmentResult } = await trackShipmentSync({
            trackingNumber: order.tracking_number.trim(),
            carrierHint: order.courier || undefined,
            destinationCountry: 'PH',
          })

          if (shipmentResult?.shipment) {
            const merged = mapParcelsToTrackingResult(shipmentResult, order.tracking_number, {
              orderId: order.id,
              internalEvents,
              defaultCourierName: order.courier || undefined,
            })

            // Ensure order stage does not move backwards
            const storeRank = DELIVERY_STATUS_RANK[order.status] ?? 0
            const courierRank = DELIVERY_STATUS_RANK[merged.statusText] ?? 0

            finalResult = {
              ...merged,
              status: courierRank >= storeRank ? merged.status : storeStage,
              statusText: courierRank >= storeRank ? merged.statusText : order.status,
              orderId: order.id,
            }
          }
        } catch (parcelsErr) {
          console.warn('[ParcelsApp Tracking Query]:', parcelsErr)
          // Continue gracefully with store milestones if courier API is unreachable
        }
      }

      return NextResponse.json(finalResult)
    }

    // ── SCENARIO B: Direct Courier Waybill Search (No local store order) ─
    // Query ParcelsApp to see if this is an external carrier tracking number
    try {
      const { shipmentResult } = await trackShipmentSync({
        trackingNumber: cleanKey,
        destinationCountry: 'PH',
      })

      if (shipmentResult?.shipment && (shipmentResult.shipment.states?.length || shipmentResult.shipment.status)) {
        const courierResult = mapParcelsToTrackingResult(shipmentResult, cleanKey)
        return NextResponse.json(courierResult)
      }
    } catch (parcelsErr) {
      console.warn('[Direct ParcelsApp Lookup Error]:', parcelsErr)
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
