import { after, NextRequest, NextResponse } from 'next/server'
import { sendPaymongoReceiptEmail } from '@/lib/mailer'
import { getRequestActor } from '@/lib/server-auth'
import {
  createPublicStoreState,
  getVisibleStoreState,
  loadStoreStateForActor,
  loadStoreSnapshot,
  loadUserCart,
  saveStoreSnapshot,
  saveUserCart,
} from '@/lib/store-persistence'
import {
  performStoreAction,
  type OrderRecord,
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

const FULL_SNAPSHOT_ACTIONS = new Set<StoreAction['type']>([
  'placeOnlineOrder',
  'createPosSale',
  'cancelOwnOrder',
  'confirmOwnDelivery',
  'markOrderPaymentPaid',
  'updateOrderStatus',
  'addCatalogProduct',
  'updateCatalogProduct',
  'removeCatalogProduct',
  'updateInventory',
  'adjustInventory',
  'archiveInventoryItem',
  'restoreInventoryItem',
])

function schedulePaymongoReceiptEmail(order: OrderRecord) {
  after(async () => {
    try {
      await sendPaymongoReceiptEmail({ order })
    } catch (error) {
      console.error('Failed to send PayMongo receipt email', {
        orderId: order.id,
        customerEmail: order.customerEmail,
        error: error instanceof Error ? error.message : error,
      })
    }
  })
}

function getPaymongoSessionIdFromNotes(notes?: string) {
  const segments =
    notes
      ?.split('|')
      .map((value) => value.trim())
      .filter(Boolean) ?? []

  const sessionSegment = segments.find((segment) => segment.startsWith('PayMongo session:'))
  return sessionSegment?.replace('PayMongo session:', '').trim() || null
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getRequestActor(request)
    const body = await request.json().catch(() => null)
    const action = body?.action as StoreAction | undefined

    if (!action?.type) {
      return NextResponse.json({ error: 'A valid store action is required.' }, { status: 400 })
    }

    const snapshotLoader = FULL_SNAPSHOT_ACTIONS.has(action.type)
      ? loadStoreSnapshot()
      : loadStoreStateForActor(actor)

    const [snapshot, cart] = actor && CART_ACTIONS.has(action.type)
      ? await Promise.all([snapshotLoader, loadUserCart(actor.id)])
      : await Promise.all([snapshotLoader, Promise.resolve([])])
    const workingState = {
      ...snapshot,
      cart: CART_ACTIONS.has(action.type) ? cart : snapshot.cart,
    }

    if (action.type === 'placeOnlineOrder' && action.input.paymentMethod === 'PayMongo') {
      const checkoutSessionId = getPaymongoSessionIdFromNotes(action.input.notes)

      if (checkoutSessionId) {
        const existingOrder = snapshot.orders.find(
          (order) =>
            order.source === 'ONLINE' &&
            order.paymentMethod === 'PayMongo' &&
            getPaymongoSessionIdFromNotes(order.notes) === checkoutSessionId,
        )

        if (existingOrder) {
          if (actor) {
            await saveUserCart(actor.id, [])
          }

          const visibleState = await getVisibleStoreState(snapshot, actor, [])
          const visibleOrder =
            visibleState.orders.find((order) => order.id === existingOrder.id) ?? existingOrder

          return NextResponse.json({
            ok: true,
            message: 'This PayMongo payment was already recorded.',
            data: visibleOrder,
            source: 'supabase',
            state: visibleState,
          })
        }
      }
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

    if (CART_ONLY_ACTIONS.has(action.type)) {
      if (actor && CART_ACTIONS.has(action.type)) {
        await saveUserCart(actor.id, nextCart)
      }

      const visibleCartState =
        actor?.role === 'USER'
          ? { ...snapshot, cart: nextCart }
          : { ...createPublicStoreState(snapshot), cart: nextCart }

      return NextResponse.json({
        ok: true,
        message: result.message,
        data: result.data,
        source: 'supabase',
        state: visibleCartState,
      })
    }

    const nextSnapshot = await saveStoreSnapshot({
      ...nextState,
      cart: [],
    })

    if (actor && CART_ACTIONS.has(action.type)) {
      await saveUserCart(actor.id, nextCart)
    }

    if (action.type === 'placeOnlineOrder') {
      const createdOrderId = typeof result.data?.id === 'string' ? result.data.id : null
      const persistedOrder =
        createdOrderId
          ? nextSnapshot.orders.find((order) => order.id === createdOrderId)
          : undefined

      if (
        persistedOrder &&
        persistedOrder.source === 'ONLINE' &&
        persistedOrder.paymentMethod === 'PayMongo' &&
        persistedOrder.paymentStatus === 'Paid'
      ) {
        schedulePaymongoReceiptEmail(persistedOrder)
      }
    }

    return NextResponse.json({
      ok: true,
      message: result.message,
      data: result.data,
      source: 'supabase',
      state: await getVisibleStoreState(nextSnapshot, actor, nextCart),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process the store action.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
