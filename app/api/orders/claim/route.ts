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
    const rawKey = String(body.orderId || body.reference || '').trim()
    const searchKey = rawKey.replace(/[%_,()]/g, '').trim()

    if (!searchKey || searchKey.length < 4) {
      return NextResponse.json(
        { error: 'Please provide a valid Order ID or PayMongo payment reference.' },
        { status: 400 },
      )
    }

    const supabase = createSupabaseAdminClient()

    // 1. Find the order in store_orders by exact ID or exact PayMongo ref in notes
    let matchedOrders: Array<{
      id: string
      source: string
      status: string
      customer_id: string | null
      customer_email: string
      notes: string | null
    }> | null = null

    if (searchKey.toUpperCase().startsWith('WEB-') || searchKey.toUpperCase().startsWith('POS-')) {
      const { data, error } = await supabase
        .from('store_orders')
        .select('id, source, status, customer_id, customer_email, notes')
        .ilike('id', searchKey)
        .limit(1)
      if (error) throw error
      matchedOrders = data
    } else {
      const { data, error } = await supabase
        .from('store_orders')
        .select('id, source, status, customer_id, customer_email, notes')
        .ilike('notes', `%${searchKey}%`)
        .limit(5)
      if (error) throw error
      matchedOrders = (data ?? []).filter((row) =>
        (row.notes ?? '')
          .split(/[\s|]+/)
          .some((token: string) => token.toLowerCase() === searchKey.toLowerCase()),
      )
    }

    if (!matchedOrders || matchedOrders.length === 0) {
      return NextResponse.json(
        { error: `No order found matching "${searchKey}". Please check your Order ID or reference.` },
        { status: 404 },
      )
    }

    const orderToClaim = matchedOrders[0]
    const actorEmail = actor.email.trim().toLowerCase()
    const orderEmail = (orderToClaim.customer_email || '').trim().toLowerCase()
    const isStaffOrAdmin = actor.role === 'ADMIN' || actor.role === 'STAFF'

    if (orderToClaim.customer_id && orderToClaim.customer_id !== actor.id && !isStaffOrAdmin) {
      return NextResponse.json(
        { error: 'This order is already linked to another customer account.' },
        { status: 403 },
      )
    }

    if (!isStaffOrAdmin) {
      if (orderToClaim.source === 'ONLINE') {
        if (!orderEmail || orderEmail !== actorEmail) {
          return NextResponse.json(
            { error: 'You can only claim online orders placed with your account email.' },
            { status: 403 },
          )
        }
      } else if (searchKey.toUpperCase().startsWith('POS-')) {
        return NextResponse.json(
          { error: 'To claim an in-store POS receipt, enter the exact PayMongo payment reference.' },
          { status: 403 },
        )
      }
    }

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
