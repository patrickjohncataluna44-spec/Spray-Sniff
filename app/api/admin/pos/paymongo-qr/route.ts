import { NextRequest, NextResponse } from 'next/server'
import {
  assertPaymongoConfigured,
  createPaymongoQrPhPaymentIntent,
} from '@/lib/paymongo'
import { getRequestActor } from '@/lib/server-auth'
import type { CartItem } from '@/lib/store-engine'

import { createSupabaseAdminClient } from '@/lib/supabase-server'

function getBaseUrl(request: Request) {
  const forwardedProto = request.headers.get('x-forwarded-proto')
  const forwardedHost = request.headers.get('x-forwarded-host')

  if (forwardedProto && forwardedHost) {
    return `${forwardedProto}://${forwardedHost}`
  }

  return new URL(request.url).origin
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => null)) as {
      amount?: number
      saleItems?: CartItem[]
      customerName?: string
      cashierName?: string
      cashierId?: string
      cashierEmail?: string
      clientSaleId?: string
    } | null

    let actor = await getRequestActor(request)

    if (!actor && (body?.cashierId || body?.cashierEmail)) {
      const supabase = createSupabaseAdminClient()
      let query = supabase.from('profiles').select('id, email, name, role')
      if (body?.cashierId) {
        query = query.eq('id', String(body.cashierId).trim())
      } else if (body?.cashierEmail) {
        query = query.ilike('email', String(body.cashierEmail).trim())
      }
      const { data: profileRows } = await query.limit(1)
      const profile = profileRows?.[0]
      if (profile && (profile.role === 'ADMIN' || profile.role === 'STAFF')) {
        actor = {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: profile.role,
        }
      }
    }

    if (!actor || (actor.role !== 'ADMIN' && actor.role !== 'STAFF')) {
      return NextResponse.json(
        { ok: false, error: 'Only staff and admins can generate POS QR codes.' },
        { status: 403 },
      )
    }

    assertPaymongoConfigured()

    const {
      amount,
      saleItems,
      customerName,
      cashierName,
      clientSaleId,
    } = body ?? {}

    if (!amount || amount < 1) {
      return NextResponse.json(
        { ok: false, error: 'Transaction amount must be at least ₱1.00 for QR Ph payments.' },
        { status: 400 },
      )
    }

    const ref = clientSaleId || `pos_${Date.now()}`

    const qrResult = await createPaymongoQrPhPaymentIntent({
      amount,
      customerName: customerName?.trim() || 'Walk-in Customer',
      customerEmail: 'walk-in@sprayandsniff.local',
      description: `POS Sale: ${ref}`,
      metadata: {
        source: 'POS',
        client_sale_id: ref,
        cashier_name: cashierName || actor.name || 'Store Staff',
        amount: String(amount),
      },
    })

    return NextResponse.json({
      ok: true,
      paymentIntentId: qrResult.paymentIntentId,
      qrImageUrl: qrResult.qrImageUrl,
      expiresAt: qrResult.expiresAt,
      amount,
      clientSaleId: ref,
      paymentMethodType: 'qrph',
      paymentMethodLabel: 'QR Ph (GCash, Maya, Bank)',
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to generate PayMongo QR payment session.'

    return NextResponse.json({ ok: false, error: message }, { status: 500 })
  }
}
