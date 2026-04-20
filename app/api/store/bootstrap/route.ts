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

    return NextResponse.json({
      source: 'supabase',
      state: getVisibleStoreState(snapshot, actor, cart),
      wishlistIds,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load store data.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
