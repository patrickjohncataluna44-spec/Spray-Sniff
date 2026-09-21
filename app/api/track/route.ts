import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { SITE_NAME } from '@/lib/site'
import {
  DELIVERY_STAGES,
  TRACKABLE_EVENT_STATUSES,
  mapOrderStatusToDeliveryStage,
  type TrackingResult,
} from '@/lib/tracking-types'

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

    const supabase = createSupabaseAdminClient()
    const cleanKey = trackingNumber.trim()

    // 1. Search store_orders by ID, tracking_number, or reference in notes
    let query = supabase
      .from('store_orders')
      .select('id, status, created_at, courier, tracking_number, delivery_notes, notes')
      .or(`id.ilike.${cleanKey},tracking_number.ilike.${cleanKey}`)

    const { data: matchedOrders, error: orderError } = await query.limit(1)

    if (orderError) {
      console.error('Error querying order for tracking:', orderError)
      throw orderError
    }

    let order = matchedOrders && matchedOrders.length > 0 ? matchedOrders[0] : null

    // If not found by exact ID or tracking_number, check if cleanKey is a partial match or notes match
    if (!order) {
      const { data: notesMatch } = await supabase
        .from('store_orders')
        .select('id, status, created_at, courier, tracking_number, delivery_notes, notes')
        .ilike('notes', `%${cleanKey}%`)
        .limit(1)

      if (notesMatch && notesMatch.length > 0) {
        order = notesMatch[0]
      }
    }

    if (!order) {
      return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 })
    }

    // 2. Fetch timeline entries for this order
    const { data: timelineEntries, error: timelineError } = await supabase
      .from('order_timeline_entries')
      .select('status, created_at, note, actor_name, previous_status')
      .eq('order_id', order.id)
      .order('created_at', { ascending: false })

    if (timelineError) {
      console.error('Error querying timeline for tracking:', timelineError)
    }

    const rawEvents = (timelineEntries ?? []).map((entry, index) => ({
      id: `${order.id}-ev-${index}`,
      datetime: entry.created_at,
      status: entry.status,
      stage: mapOrderStatusToDeliveryStage(entry.status),
      location: entry.actor_name ? `${SITE_NAME} — ${entry.actor_name}` : `${SITE_NAME} store team`,
      description: entry.note,
      recordedBy: entry.actor_name ?? undefined,
      previousStatus: entry.previous_status ?? undefined,
    }))

    // Filter to trackable statuses if present, or show all events if none matched
    const filteredEvents = rawEvents.filter((entry) => TRACKABLE_EVENT_STATUSES.has(entry.status))
    const events = filteredEvents.length > 0 ? filteredEvents : rawEvents

    const stage = mapOrderStatusToDeliveryStage(order.status)
    const deliveredStage = DELIVERY_STAGES[DELIVERY_STAGES.length - 1]

    const result: TrackingResult = {
      trackingNumber: order.tracking_number || order.id,
      carrier: {
        code: 'store',
        name: order.courier || `${SITE_NAME} delivery team`,
      },
      status: stage,
      statusText: order.status,
      estimatedDelivery:
        stage === deliveredStage.stage ? 'Delivered' : 'Updated by our store team',
      lastUpdated: events[0]?.datetime ?? order.created_at,
      events,
    }

    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : 'Unable to retrieve tracking information.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
