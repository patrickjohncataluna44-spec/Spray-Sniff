import { NextRequest, NextResponse } from 'next/server'
import { getRequestActor } from '@/lib/server-auth'
import { mapPromotionRow } from '@/lib/store-persistence'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

export async function GET(request: NextRequest) {
  try {
    const actor = await getRequestActor(request)

    if (!actor || actor.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can view promotions.' }, { status: 401 })
    }

    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase
      .from('promotions')
      .select('id, code, type, discount, used_count, usage_limit, status, starts_at, expires_at, description')
      .order('code', { ascending: true })

    if (error) {
      throw error
    }

    return NextResponse.json({ promotions: (data ?? []).map(mapPromotionRow) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load promotions.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getRequestActor(request)

    if (!actor || actor.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Only admins can create promotions.' }, { status: 401 })
    }

    const body = await request.json()
    const supabase = createSupabaseAdminClient()
    const payload = {
      id: body.id,
      code: body.code,
      type: body.type,
      discount: body.discount,
      used_count: body.usedCount,
      usage_limit: body.usageLimit,
      status: body.status,
      starts_at: body.startsAt,
      expires_at: body.expiresAt,
      description: body.description,
    }

    const { data, error } = await supabase
      .from('promotions')
      .insert(payload)
      .select('id, code, type, discount, used_count, usage_limit, status, starts_at, expires_at, description')
      .single()

    if (error) {
      throw error
    }

    return NextResponse.json({ promotion: mapPromotionRow(data) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to create the promotion.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
