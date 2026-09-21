import { NextRequest, NextResponse } from 'next/server'
import { getRequestActor } from '@/lib/server-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import type { StoreActor } from '@/lib/store-engine'

export interface ReviewItem {
  id: string
  productId: string
  orderId: string
  customerId: string
  customerName: string
  rating: number
  comment: string
  createdAt: string
}

async function resolveActor(request: NextRequest, fallbackId?: string, fallbackEmail?: string): Promise<StoreActor | null> {
  // 1. Try Bearer token from header
  const tokenActor = await getRequestActor(request)
  if (tokenActor) {
    return tokenActor
  }

  // 2. Check custom headers or body fallbacks
  const headerUserId = request.headers.get('x-customer-id')?.trim() || fallbackId?.trim()
  const headerUserEmail = request.headers.get('x-customer-email')?.trim() || fallbackEmail?.trim()

  const supabase = createSupabaseAdminClient()

  if (headerUserId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, name, role')
      .eq('id', headerUserId)
      .maybeSingle()

    if (profile) {
      return {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: (profile.role as StoreActor['role']) || 'USER',
      }
    }
  }

  if (headerUserEmail) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, email, name, role')
      .ilike('email', headerUserEmail)
      .maybeSingle()

    if (profile) {
      return {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: (profile.role as StoreActor['role']) || 'USER',
      }
    }
  }

  return null
}

// GET /api/reviews?productId=...
// Returns product reviews and whether the current user can review (has a Delivered order)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json({ error: 'productId is required.' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const actor = await resolveActor(request)

    // 1. Fetch reviews for the product
    const { data: reviewsData, error: reviewsError } = await supabase
      .from('product_reviews')
      .select('id, product_id, order_id, customer_id, customer_name, rating, comment, created_at')
      .eq('product_id', productId)
      .order('created_at', { ascending: false })

    if (reviewsError) {
      console.warn('Unable to query product_reviews:', reviewsError.message)
      return NextResponse.json({
        reviews: [],
        averageRating: 0,
        totalReviews: 0,
        canReview: false,
        deliveredOrderId: null,
      })
    }

    const reviews: ReviewItem[] = (reviewsData ?? []).map((row) => ({
      id: row.id,
      productId: row.product_id,
      orderId: row.order_id,
      customerId: row.customer_id,
      customerName: row.customer_name,
      rating: Number(row.rating),
      comment: row.comment,
      createdAt: row.created_at,
    }))

    const totalReviews = reviews.length
    const averageRating =
      totalReviews > 0
        ? Math.round((reviews.reduce((acc, curr) => acc + curr.rating, 0) / totalReviews) * 10) / 10
        : 0

    // 2. Determine if the current authenticated customer has a Delivered order
    let canReview = false
    let deliveredOrderId: string | null = null
    let alreadyReviewed = false

    if (actor) {
      // Check if user already reviewed this product
      alreadyReviewed = reviews.some(
        (r) => r.customerId === actor.id || (r.customerName && r.customerName === actor.name),
      )

      if (!alreadyReviewed) {
        const { data: existingReview } = await supabase
          .from('product_reviews')
          .select('id')
          .eq('product_id', productId)
          .eq('customer_id', actor.id)
          .maybeSingle()

        if (existingReview) {
          alreadyReviewed = true
        }
      }

      if (!alreadyReviewed) {
        // First priority: check for delivered order containing this specific product
        const { data: specificDeliveredOrders } = await supabase
          .from('store_orders')
          .select('id, status, store_order_items!inner(product_id)')
          .or(`customer_id.eq.${actor.id},customer_email.ilike.${actor.email}`)
          .eq('status', 'Delivered')
          .eq('store_order_items.product_id', productId)
          .order('created_at', { ascending: false })
          .limit(1)

        if (specificDeliveredOrders && specificDeliveredOrders.length > 0) {
          canReview = true
          deliveredOrderId = specificDeliveredOrders[0].id
        } else {
          // Second priority: If the customer has ANY delivered order in the store
          const { data: anyDeliveredOrders } = await supabase
            .from('store_orders')
            .select('id, status')
            .or(`customer_id.eq.${actor.id},customer_email.ilike.${actor.email}`)
            .eq('status', 'Delivered')
            .order('created_at', { ascending: false })
            .limit(1)

          if (anyDeliveredOrders && anyDeliveredOrders.length > 0) {
            canReview = true
            deliveredOrderId = anyDeliveredOrders[0].id
          } else if (actor.role === 'ADMIN' || actor.role === 'STAFF') {
            // Staff/admin can review or test reviews
            const { data: anyOrder } = await supabase.from('store_orders').select('id').limit(1)
            if (anyOrder && anyOrder.length > 0) {
              canReview = true
              deliveredOrderId = anyOrder[0].id
            }
          }
        }
      }
    }

    return NextResponse.json({
      reviews,
      averageRating,
      totalReviews,
      canReview,
      alreadyReviewed,
      deliveredOrderId,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load reviews.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// POST /api/reviews
// Customer submits a star rating and comment for a product they received
export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : ''
    const rating = typeof body?.rating === 'number' ? Math.max(1, Math.min(5, Math.round(body.rating))) : 0
    const comment = typeof body?.comment === 'string' ? body.comment.trim() : ''

    const actor = await resolveActor(request, body?.customerId, body?.customerEmail)

    if (!actor) {
      return NextResponse.json(
        { error: 'You must be signed in as a customer to leave a review.' },
        { status: 401 },
      )
    }

    if (!productId) {
      return NextResponse.json({ error: 'Product ID is required.' }, { status: 400 })
    }

    if (rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'Please select a rating between 1 and 5 stars.' }, { status: 400 })
    }

    if (!comment) {
      return NextResponse.json({ error: 'Please write a brief comment or feedback.' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()

    // 1. Check if user already submitted a review for this product
    const { data: existingReview } = await supabase
      .from('product_reviews')
      .select('id')
      .eq('product_id', productId)
      .eq('customer_id', actor.id)
      .maybeSingle()

    if (existingReview) {
      return NextResponse.json(
        { error: 'You have already submitted a review for this product.' },
        { status: 400 },
      )
    }

    // 2. Verify customer has a Delivered order
    let eligibleOrderId: string | null = null

    // Check specific delivered order containing this product first
    const { data: specificDelivered } = await supabase
      .from('store_orders')
      .select('id, status, store_order_items!inner(product_id)')
      .or(`customer_id.eq.${actor.id},customer_email.ilike.${actor.email}`)
      .eq('status', 'Delivered')
      .eq('store_order_items.product_id', productId)
      .order('created_at', { ascending: false })
      .limit(1)

    if (specificDelivered && specificDelivered.length > 0) {
      eligibleOrderId = specificDelivered[0].id
    } else {
      // Check if user has ANY delivered order in the store
      const { data: anyDelivered } = await supabase
        .from('store_orders')
        .select('id, status')
        .or(`customer_id.eq.${actor.id},customer_email.ilike.${actor.email}`)
        .eq('status', 'Delivered')
        .order('created_at', { ascending: false })
        .limit(1)

      if (anyDelivered && anyDelivered.length > 0) {
        eligibleOrderId = anyDelivered[0].id
      } else if (actor.role === 'ADMIN' || actor.role === 'STAFF') {
        const { data: anyOrder } = await supabase.from('store_orders').select('id').limit(1)
        if (anyOrder && anyOrder.length > 0) {
          eligibleOrderId = anyOrder[0].id
        }
      }
    }

    if (!eligibleOrderId) {
      return NextResponse.json(
        {
          error:
            'Review not permitted. You can only rate and review products once your order has been successfully delivered to you.',
        },
        { status: 403 },
      )
    }

    const reviewId = `rev_${actor.id.slice(0, 8)}_${productId.slice(0, 8)}_${Date.now()}`

    // 3. Insert review into product_reviews
    const { data: newReview, error: insertError } = await supabase
      .from('product_reviews')
      .insert({
        id: reviewId,
        product_id: productId,
        order_id: eligibleOrderId,
        customer_id: actor.id,
        customer_name: actor.name || 'Verified Customer',
        rating,
        comment,
      })
      .select('id, product_id, order_id, customer_id, customer_name, rating, comment, created_at')
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'You have already submitted a review for this delivered fragrance.' },
          { status: 400 },
        )
      }
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    // 4. Recalculate average rating & review count for catalog_products table
    const { data: allProductReviews } = await supabase
      .from('product_reviews')
      .select('rating')
      .eq('product_id', productId)

    if (allProductReviews && allProductReviews.length > 0) {
      const avg =
        Math.round((allProductReviews.reduce((sum, r) => sum + r.rating, 0) / allProductReviews.length) * 10) /
        10
      const count = allProductReviews.length

      await supabase
        .from('catalog_products')
        .update({
          rating: avg,
          review_count: count,
        })
        .eq('id', productId)
    }

    return NextResponse.json({
      ok: true,
      message: 'Thank you! Your verified review and rating have been posted.',
      review: newReview,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to submit review.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
