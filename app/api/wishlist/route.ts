import { NextRequest, NextResponse } from 'next/server'
import { getRequestActor } from '@/lib/server-auth'
import { loadUserWishlist, saveUserWishlist } from '@/lib/store-persistence'

export async function GET(request: NextRequest) {
  try {
    const actor = await getRequestActor(request)

    if (!actor) {
      return NextResponse.json({ wishlistIds: [] })
    }

    const wishlistIds = await loadUserWishlist(actor.id)
    return NextResponse.json({ wishlistIds })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load wishlist.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await getRequestActor(request)

    if (!actor || actor.role !== 'USER') {
      return NextResponse.json(
        { error: 'Sign in with a customer account before updating your wishlist.' },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => null)
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : ''

    if (!productId) {
      return NextResponse.json({ error: 'A product id is required.' }, { status: 400 })
    }

    const currentWishlist = await loadUserWishlist(actor.id)
    const wishlistIds = currentWishlist.includes(productId)
      ? currentWishlist.filter((id) => id !== productId)
      : [...currentWishlist, productId]

    await saveUserWishlist(actor.id, wishlistIds)

    return NextResponse.json({
      ok: true,
      wishlistIds,
      isWishlisted: wishlistIds.includes(productId),
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to update wishlist.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
