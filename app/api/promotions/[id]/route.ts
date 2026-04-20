import { NextRequest, NextResponse } from 'next/server'
import { getRequestActor } from '@/lib/server-auth'
import { mapPromotionRow } from '@/lib/store-persistence'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getRequestActor(request)

    if (!actor || actor.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can update promotions.' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()
    const supabase = createSupabaseAdminClient()

    const { data, error } = await supabase
      .from('promotions')
      .update({
        code: body.code,
        type: body.type,
        discount: body.discount,
        used_count: body.usedCount,
        usage_limit: body.usageLimit,
        status: body.status,
        starts_at: body.startsAt,
        expires_at: body.expiresAt,
        description: body.description,
      })
      .eq('id', id)
      .select('id, code, type, discount, used_count, usage_limit, status, starts_at, expires_at, description')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ promotion: mapPromotionRow(data) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update the promotion.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getRequestActor(request)

    if (!actor || actor.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can delete promotions.' }, { status: 401 })
    }

    const { id } = await context.params
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.from('promotions').delete().eq('id', id)

    if (error) {
      throw error
    }

    return NextResponse.json({ ok: true })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to delete the promotion.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
