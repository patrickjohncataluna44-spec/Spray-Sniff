import { NextRequest, NextResponse } from 'next/server'
import { getRequestActor } from '@/lib/server-auth'
import {
  getVisibleStoreState,
  loadStoreStateForActor,
  loadUserCart,
  loadUserWishlist,
} from '@/lib/store-persistence'

export async function GET(request: NextRequest) {
  try {
    const actor = await getRequestActor(request)
    const [snapshot, cart, wishlistIds] = actor
      ? await Promise.all([
          loadStoreStateForActor(actor),
          loadUserCart(actor.id),
          loadUserWishlist(actor.id),
        ])
      : await Promise.all([loadStoreStateForActor(actor), Promise.resolve([]), Promise.resolve([])])

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
    })
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : 'Unable to load store data.'
    const normalized = rawMessage.toLowerCase()
    const message =
      normalized.includes('relation') || normalized.includes('schema')
        ? 'Your new Supabase project is missing the app database schema. Run supabase/schema.sql or `supabase db push`, then reload the app.'
        : rawMessage
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
