import { NextRequest, NextResponse } from 'next/server'
import { getRequestActor } from '@/lib/server-auth'
import {
  getVisibleStoreState,
  loadBootstrapStoreStateForActor,
  loadUserCart,
  loadUserWishlist,
} from '@/lib/store-persistence'

function getErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) {
    return error.message
  }

  if (error && typeof error === 'object') {
    if ('message' in error && typeof error.message === 'string' && error.message.trim()) {
      return error.message
    }

    if ('details' in error && typeof error.details === 'string' && error.details.trim()) {
      return error.details
    }

    if ('hint' in error && typeof error.hint === 'string' && error.hint.trim()) {
      return error.hint
    }
  }

  return 'Unable to load store data.'
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getRequestActor(request)
    const isCustomer = actor?.role === 'USER'
    const [snapshot, cart, wishlistIds] = isCustomer
      ? await Promise.all([
          loadBootstrapStoreStateForActor(actor),
          loadUserCart(actor.id),
          loadUserWishlist(actor.id),
        ])
      : await Promise.all([
          loadBootstrapStoreStateForActor(actor),
          Promise.resolve([]),
          Promise.resolve([]),
        ])

    const state =
      actor?.role === 'ADMIN' || actor?.role === 'STAFF'
        ? await getVisibleStoreState(snapshot, actor, cart)
        : {
            ...snapshot,
            cart,
          }

    return NextResponse.json({
      source: 'supabase',
      state,
      wishlistIds,
      syncedAt: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Store bootstrap failed', error)
    const rawMessage = getErrorMessage(error)
    const normalized = rawMessage.toLowerCase()
    const hasSchemaIssue = normalized.includes('relation') || normalized.includes('schema')
    const message = hasSchemaIssue
      ? process.env.NODE_ENV === 'production'
        ? 'Your new Supabase project is missing the app database schema. Run supabase/schema.sql or `supabase db push`, then reload the app.'
        : `Schema issue: ${rawMessage}`
      : rawMessage
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
