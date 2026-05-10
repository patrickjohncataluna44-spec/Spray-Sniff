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
    const message = error instanceof Error ? error.message : 'Unable to load store data.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
