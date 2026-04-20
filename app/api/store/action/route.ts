import { NextRequest, NextResponse } from 'next/server'
import { getRequestActor } from '@/lib/server-auth'
import {
  getVisibleStoreState,
  loadStoreStateForActor,
  loadUserCart,
  saveStoreSnapshot,
  saveUserCart,
} from '@/lib/store-persistence'
import {
  performStoreAction,
  type StoreAction,
} from '@/lib/store-engine'

const CART_ACTIONS = new Set<StoreAction['type']>([
  'addToCart',
  'updateCartQuantity',
  'removeFromCart',
  'clearCart',
  'placeOnlineOrder',
])

const CART_ONLY_ACTIONS = new Set<StoreAction['type']>([
  'addToCart',
  'updateCartQuantity',
  'removeFromCart',
  'clearCart',
])

export async function POST(request: NextRequest) {
  try {
    const actor = await getRequestActor(request)
    const body = await request.json().catch(() => null)
    const action = body?.action as StoreAction | undefined

    if (!action?.type) {
      return NextResponse.json({ error: 'A valid store action is required.' }, { status: 400 })
    }

    const [snapshot, cart] = actor && CART_ACTIONS.has(action.type)
      ? await Promise.all([loadStoreStateForActor(actor), loadUserCart(actor.id)])
      : await Promise.all([loadStoreStateForActor(actor), Promise.resolve([])])
    const workingState = {
      ...snapshot,
      cart: CART_ACTIONS.has(action.type) ? cart : snapshot.cart,
    }

    const { nextState, result } = performStoreAction(workingState, action, actor)

    if (!result.ok) {
      return NextResponse.json(
        {
          ok: false,
          message: result.message,
        },
        { status: 400 },
      )
    }

    const nextCart = CART_ACTIONS.has(action.type) ? nextState.cart : cart

    if (actor && CART_ACTIONS.has(action.type)) {
      await saveUserCart(actor.id, nextCart)
    }

    if (CART_ONLY_ACTIONS.has(action.type)) {
      return NextResponse.json({
        ok: true,
        message: result.message,
        data: result.data,
        source: 'supabase',
        state: getVisibleStoreState(snapshot, actor, nextCart),
      })
    }

    const nextSnapshot = await saveStoreSnapshot({
      ...nextState,
      cart: [],
    })

    return NextResponse.json({
      ok: true,
      message: result.message,
      data: result.data,
      source: 'supabase',
      state: getVisibleStoreState(nextSnapshot, actor, nextCart),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process the store action.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
