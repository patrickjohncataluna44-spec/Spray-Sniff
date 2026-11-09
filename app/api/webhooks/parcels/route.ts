import { NextResponse } from 'next/server'
import { getOptionalServerEnv } from '@/lib/server-runtime-env'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import {
  DELIVERY_STATUS_RANK,
  mapDeliveryStageToOrderStatus,
  mapParcelsStateToDeliveryStage,
} from '@/lib/tracking-types'
import {
  verifyParcelsWebhookSignature,
  type ParcelsTrackingResultItem,
} from '@/lib/parcels-api'

interface ParcelsWebhookPayload {
  event: 'shipment_completed' | 'batch_completed' | 'tracking_error'
  request_id: string
  timestamp: string
  done: boolean
  result?: ParcelsTrackingResultItem
  results?: ParcelsTrackingResultItem[]
  error?: {
    code: string
    message: string
  }
}

/**
 * ParcelsApp Webhook Endpoint
 *
 * Receives signed courier milestone and completion notifications from ParcelsApp.
 * When a courier marks an order as In Transit, Out for Delivery, or Delivered,
 * this route verifies the HMAC-SHA256 signature and automatically advances
 * the store order's delivery status with an audit timeline record.
 */
export async function POST(req: Request) {
  const secret = getOptionalServerEnv('PARCELS_WEBHOOK_SECRET')
  const signatureHeader = req.headers.get('parcels-signature')

  const rawBody = await req.text()

  // Verify HMAC-SHA256 signature if secret is configured
  if (secret) {
    const { valid, reason } = verifyParcelsWebhookSignature(rawBody, signatureHeader, secret)
    if (!valid) {
      console.warn('[ParcelsApp Webhook Rejected]:', reason)
      return NextResponse.json({ error: reason || 'Unauthorized' }, { status: 401 })
    }
  } else {
    // In local development / mock testing without secret configured, log notice
    console.info('[ParcelsApp Webhook]: Running without PARCELS_WEBHOOK_SECRET configured.')
  }

  let payload: ParcelsWebhookPayload
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  if (payload.event === 'tracking_error') {
    console.warn('[ParcelsApp Tracking Error Event]:', payload.error)
    return NextResponse.json({ received: true, acknowledged: 'tracking_error' })
  }

  // Collect all completed results from single or batch payload
  const items: ParcelsTrackingResultItem[] = []
  if (payload.result) {
    items.push(payload.result)
  }
  if (Array.isArray(payload.results)) {
    items.push(...payload.results)
  }

  if (items.length === 0) {
    return NextResponse.json({ received: true, processed: 0 })
  }

  const supabase = createSupabaseAdminClient()
  let processedCount = 0

  for (const item of items) {
    const trackingNumber = item.tracking_number?.trim()
    if (!trackingNumber) continue

    // Find the order with matching courier tracking number
    const { data: orders, error: findErr } = await supabase
      .from('store_orders')
      .select('id, status, payment_method, payment_status, courier, notes')
      .ilike('tracking_number', trackingNumber)
      .limit(1)

    if (findErr || !orders || orders.length === 0) {
      // Waybill is not assigned to a local store order (e.g. external package)
      continue
    }

    const order = orders[0]
    const shipment = item.shipment
    const rawStatus = shipment?.status || shipment?.states?.[0]?.state || item.state
    const detectedStage = mapParcelsStateToDeliveryStage(rawStatus)
    const newOrderStatus = mapDeliveryStageToOrderStatus(detectedStage)

    const carrierName =
      shipment?.detectedCarrier?.name ||
      shipment?.services?.[0]?.name ||
      order.courier ||
      'Courier'

    const latestCheckpoint = shipment?.states?.[0]
    const checkpointText = latestCheckpoint
      ? `${latestCheckpoint.state}${latestCheckpoint.location ? ` (${latestCheckpoint.location})` : ''}`
      : `Courier status: ${rawStatus}`

    const currentRank = DELIVERY_STATUS_RANK[order.status] ?? 0
    const nextRank = newOrderStatus ? (DELIVERY_STATUS_RANK[newOrderStatus] ?? 0) : 0

    // Advance status only if it moves strictly forward
    if (newOrderStatus && nextRank > currentRank) {
      const now = new Date().toISOString()

      // Update store order status
      const { error: updateErr } = await supabase
        .from('store_orders')
        .update({
          status: newOrderStatus,
          updated_at: now,
        })
        .eq('id', order.id)

      if (updateErr) {
        console.error(`Failed to update order ${order.id} status to ${newOrderStatus}:`, updateErr)
      } else {
        // Record timeline entry for customer and audit trail
        const timelineId = `${order.id}-ev-${Date.now()}`
        await supabase.from('order_timeline_entries').insert({
          id: timelineId,
          order_id: order.id,
          status: newOrderStatus,
          created_at: now,
          actor_name: `${carrierName} (Auto-sync)`,
          previous_status: order.status,
          note: checkpointText,
        })

        processedCount++
        console.log(`[ParcelsApp Sync] Order ${order.id} automatically advanced to ${newOrderStatus} via ${carrierName}.`)
      }
    } else if (latestCheckpoint) {
      // Status remains the same stage (e.g. In Transit at another hub), but record intermediate checkpoint
      const now = new Date().toISOString()
      const timelineId = `${order.id}-ev-${Date.now()}`
      await supabase.from('order_timeline_entries').insert({
        id: timelineId,
        order_id: order.id,
        status: order.status,
        created_at: now,
        actor_name: `${carrierName} (Auto-sync)`,
        previous_status: order.status,
        note: checkpointText,
      })
      processedCount++
    }
  }

  return NextResponse.json({
    received: true,
    processed: processedCount,
    timestamp: new Date().toISOString(),
  })
}
