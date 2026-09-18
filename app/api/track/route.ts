import { NextRequest, NextResponse } from 'next/server'
import { getRequestActor } from '@/lib/server-auth'
import { loadStoreStateForActor } from '@/lib/store-persistence'
import { orderBelongsToActor, type OrderRecord } from '@/lib/store-engine'
import { SITE_NAME } from '@/lib/site'
import {
  DELIVERY_STAGES,
  TRACKABLE_EVENT_STATUSES,
  mapOrderStatusToDeliveryStage,
  type TrackingResult,
} from '@/lib/tracking-types'

const NOT_FOUND_MESSAGE =
  'No order found for that tracking number. Check the order ID from your order history.'

function normalizeLookupKey(value: string) {
  return value.trim().toLowerCase()
}

/**
 * Finds the order a customer is asking about. Only ever searches the orders the
 * actor is already allowed to see: `loadStoreStateForActor` scopes a customer to
 * their own orders, so a tracking number from someone else's parcel can never
 * resolve here.
 */
function findTrackableOrder(state: { orders: OrderRecord[] }, lookupKey: string) {
  const normalized = normalizeLookupKey(lookupKey)

  return state.orders.find((candidate) => {
    if (candidate.source !== 'ONLINE') {
      return false
    }

    if (normalizeLookupKey(candidate.id) === normalized) {
      return true
    }

    return (
      Boolean(candidate.trackingNumber) &&
      normalizeLookupKey(candidate.trackingNumber as string) === normalized
    )
  })
}

function buildTrackingResult(order: OrderRecord): TrackingResult {
  const stage = mapOrderStatusToDeliveryStage(order.status)

  // Only delivery checkpoints belong in a shipment log. Payment records and
  // other order activity would otherwise read as courier scans.
  const events = [...order.timeline]
    .filter((entry) => TRACKABLE_EVENT_STATUSES.has(entry.status))
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .map((entry, index) => ({
      id: `${order.id}-ev-${index}`,
      datetime: entry.createdAt,
      status: entry.status,
      stage: mapOrderStatusToDeliveryStage(entry.status),
      location: entry.actorName ? `${SITE_NAME} — ${entry.actorName}` : `${SITE_NAME} store team`,
      description: entry.note,
      recordedBy: entry.actorName,
      previousStatus: entry.previousStatus,
    }))

  const latestEntry = order.timeline[order.timeline.length - 1]
  const deliveredStage = DELIVERY_STAGES[DELIVERY_STAGES.length - 1]

  return {
    trackingNumber: order.trackingNumber || order.id,
    carrier: {
      code: 'store',
      name: order.courier || `${SITE_NAME} delivery team`,
    },
    status: stage,
    statusText: order.status,
    estimatedDelivery:
      stage === deliveredStage.stage ? 'Delivered' : 'Updated by our store team',
    lastUpdated: latestEntry?.createdAt ?? order.createdAt,
    events,
  }
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getRequestActor(request)

    if (!actor) {
      return NextResponse.json(
        { error: 'Please sign in to track your order.' },
        { status: 401 },
      )
    }

    const trackingNumber = request.nextUrl.searchParams.get('number')?.trim()
    if (!trackingNumber) {
      return NextResponse.json(
        { error: 'A tracking number is required.' },
        { status: 400 },
      )
    }

    const state = await loadStoreStateForActor(actor)
    const order = findTrackableOrder(state, trackingNumber)

    // A customer asking about an order that is not theirs gets the same answer
    // as one asking about an order that does not exist, so the endpoint cannot
    // be used to probe for other people's orders.
    if (!order || (actor.role === 'USER' && !orderBelongsToActor(order, actor))) {
      return NextResponse.json({ error: NOT_FOUND_MESSAGE }, { status: 404 })
    }

    return NextResponse.json(buildTrackingResult(order))
  } catch (error) {
    const message =
      error instanceof Error && error.message.trim()
        ? error.message
        : 'Unable to retrieve tracking information.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
