import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import {
  verifyParcelsWebhookSignature,
  type ParcelsTrackingResultItem,
} from '@/lib/parcels-api'
import {
  getParcelsWebhookSecret,
  saveParcelsTrackingRequest,
  syncOrderWithParcelsShipment,
} from '@/lib/tracking-sync'

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

function isMissingCourierSlugError(error: { code?: string; message?: string } | null | undefined) {
  if (!error) return false
  const msg = (error.message || '').toLowerCase()
  return error.code === '42703' || error.code === 'PGRST204' || msg.includes('courier_slug')
}

/**
 * ParcelsApp v5 Webhook Endpoint
 *
 * Receives signed completion notifications for a single `POST /trackings` request.
 * Verifies the `Parcels-Signature` HMAC-SHA256 header (`t=<unix>,v1=<hex>`) using
 * the per-request `webhook.secret` stored in `parcels_tracking_requests` (falling back
 * to `PARCELS_WEBHOOK_SECRET`), then synchronizes forward-only status and deduplicated
 * checkpoints onto `store_orders` and `order_timeline_entries`.
 */
export async function POST(req: Request) {
  const signatureHeader = req.headers.get('parcels-signature')
  const rawBody = await req.text()

  let payload: ParcelsWebhookPayload
  try {
    payload = JSON.parse(rawBody) as ParcelsWebhookPayload
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload' }, { status: 400 })
  }

  const secret = await getParcelsWebhookSecret(payload.request_id)

  if (secret) {
    const { valid, reason } = verifyParcelsWebhookSignature(rawBody, signatureHeader, secret)
    if (!valid) {
      console.warn('[ParcelsApp v5 Webhook Rejected]:', reason)
      return NextResponse.json({ error: reason || 'Unauthorized' }, { status: 401 })
    }
  } else if (process.env.NODE_ENV === 'production') {
    console.warn('[ParcelsApp v5 Webhook Rejected]: Missing webhook signing secret in production.')
    return NextResponse.json({ error: 'Webhook secret not configured.' }, { status: 401 })
  } else {
    console.info('[ParcelsApp v5 Webhook]: No per-request or fallback PARCELS_WEBHOOK_SECRET found (dev mode).')
  }

  if (payload.event === 'tracking_error') {
    console.warn('[ParcelsApp v5 Tracking Error Event]:', payload.error)
    return NextResponse.json({ received: true, acknowledged: 'tracking_error' })
  }

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

    await saveParcelsTrackingRequest({
      response: {
        request_id: payload.request_id,
        status: payload.done ? 'completed' : 'processing',
        done: payload.done,
        results: [item],
      },
      trackingNumber,
    })

    let findRes = await supabase
      .from('store_orders')
      .select('id, status, courier, courier_slug')
      .ilike('tracking_number', trackingNumber)
      .limit(1)

    if (findRes.error && isMissingCourierSlugError(findRes.error)) {
      findRes = await supabase
        .from('store_orders')
        .select('id, status, courier')
        .ilike('tracking_number', trackingNumber)
        .limit(1) as typeof findRes
    }

    const order = findRes.data?.[0]
    if (!order) {
      continue
    }

    const syncResult = await syncOrderWithParcelsShipment(order, item)
    if (syncResult.updatedStatus || syncResult.recordedCheckpoint) {
      processedCount++
    }
  }

  return NextResponse.json({
    received: true,
    processed: processedCount,
    timestamp: new Date().toISOString(),
  })
}
