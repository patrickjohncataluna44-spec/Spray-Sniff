import { NextRequest, NextResponse } from 'next/server'
import { syncPaymongoOrdersToDatabase } from '@/lib/paymongo-sync'
import { getRequestActor } from '@/lib/server-auth'
import { getOptionalServerEnv } from '@/lib/server-runtime-env'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

async function isAuthorizedSyncCaller(request: NextRequest) {
  const cronSecret = getOptionalServerEnv('CRON_SECRET')
  if (cronSecret && request.headers.get('authorization')?.trim() === `Bearer ${cronSecret}`) {
    return { authorized: true as const, actor: null }
  }

  const actor = await getRequestActor(request)
  if (!actor) {
    return { authorized: false as const, actor: null }
  }

  return { authorized: true as const, actor }
}

async function handleSync(request: NextRequest) {
  try {
    const auth = await isAuthorizedSyncCaller(request)
    if (!auth.authorized) {
      return NextResponse.json({ ok: false, error: 'Authentication required.' }, { status: 401 })
    }

    const result = await syncPaymongoOrdersToDatabase()

    if (auth.actor?.role === 'USER') {
      const actorEmail = auth.actor.email.trim().toLowerCase()
      const recoveredIds = Array.isArray(result.recoveredOrders) ? result.recoveredOrders : []
      let scopedRecovered: string[] = []

      if (recoveredIds.length > 0) {
        const supabase = createSupabaseAdminClient()
        const { data: matchedOrders } = await supabase
          .from('store_orders')
          .select('id, customer_id, customer_email')
          .in('id', recoveredIds)

        scopedRecovered = (matchedOrders ?? [])
          .filter(
            (order) =>
              order.customer_id === auth.actor?.id ||
              order.customer_email?.trim().toLowerCase() === actorEmail,
          )
          .map((order) => order.id)
      }

      return NextResponse.json({
        ok: result.ok,
        syncedCount: scopedRecovered.length,
        recoveredOrders: scopedRecovered,
        message:
          scopedRecovered.length > 0
            ? `Successfully synced ${scopedRecovered.length} order(s) from PayMongo.`
            : 'All your PayMongo payments are already recorded and up to date.',
      })
    }

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error syncing PayMongo orders:', error)
    return NextResponse.json(
      {
        ok: false,
        syncedCount: 0,
        recoveredOrders: [],
        message: error instanceof Error ? error.message : 'Unknown sync error',
      },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest) {
  return handleSync(request)
}

export async function GET(request: NextRequest) {
  return handleSync(request)
}
