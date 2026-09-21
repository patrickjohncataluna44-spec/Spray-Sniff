import { NextRequest, NextResponse } from 'next/server'
import { getRequestActor } from '@/lib/server-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

export async function POST(request: NextRequest) {
  try {
    const actor = await getRequestActor(request)
    if (!actor) {
      return NextResponse.json({ error: 'Please sign in to claim an order.' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const searchKey = String(body.orderId || body.reference || '').trim()

    if (!searchKey) {
      return NextResponse.json(
        { error: 'Please provide an Order ID or PayMongo payment reference.' },
        { status: 400 },
      )
    }

    const supabase = createSupabaseAdminClient()

    // 1. Find the order in store_orders by ID or notes
    let query = supabase.from('store_orders').select('*')
    if (searchKey.toUpperCase().startsWith('WEB-') || searchKey.toUpperCase().startsWith('POS-')) {
      query = query.ilike('id', searchKey)
    } else {
      query = query.or(`id.ilike.%${searchKey}%,notes.ilike.%${searchKey}%`)
    }

    const { data: matchedOrders, error: findError } = await query.limit(5)
    if (findError) throw findError

    if (!matchedOrders || matchedOrders.length === 0) {
      return NextResponse.json(
        { error: `No order found matching "${searchKey}". Please check your Order ID or reference.` },
        { status: 404 },
      )
    }

    const orderToClaim = matchedOrders[0]

    // 2. Link the order to the actor
    const { error: updateOrderError } = await supabase
      .from('store_orders')
      .update({
        customer_id: actor.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderToClaim.id)

    if (updateOrderError) throw updateOrderError

    // Also update payment_records
    await supabase
      .from('payment_records')
      .update({
        customer_id: actor.id,
        updated_at: new Date().toISOString(),
      })
      .eq('order_id', orderToClaim.id)

    // Add timeline entry
    await supabase.from('order_timeline_entries').insert({
      id: `${orderToClaim.id}-timeline-claim-${Date.now()}`,
      order_id: orderToClaim.id,
      status: orderToClaim.status,
      created_at: new Date().toISOString(),
      note: `Order linked to customer account (${actor.email || actor.name}).`,
      actor_name: actor.name || 'Customer Account',
    })

    return NextResponse.json({
      ok: true,
      message: `Order ${orderToClaim.id} has been successfully linked to your account!`,
      orderId: orderToClaim.id,
    })
  } catch (error) {
    console.error('Failed to claim order:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to claim order.' },
      { status: 500 },
    )
  }
}
