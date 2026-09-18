import { NextRequest, NextResponse } from 'next/server'
import { getRequestActor } from '@/lib/server-auth'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

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

// GET /api/reviews?productId=...
// Also can return whether the current user is eligible (has a Delivered order containing this product)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('productId')

    if (!productId) {
      return NextResponse.json({ error: 'productId is required.' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const actor = await getRequestActor(request)

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

    // 2. Determine if the current authenticated customer has a Delivered order for this product
    let canReview = false
    let deliveredOrderId: string | null = null
    let alreadyReviewed = false

    if (actor && actor.role === 'USER') {
      // Check if user already reviewed this product
      alreadyReviewed = reviews.some((r) => r.customerId === actor.id)

      if (!alreadyReviewed) {
        // Query user's orders that are 'Delivered' and contain this product
        const { data: deliveredOrders } = await supabase
          .from('store_orders')
          .select('id, status, store_order_items!inner(product_id)')
          .eq('customer_id', actor.id)
          .eq('status', 'Delivered')
          .eq('store_order_items.product_id', productId)
          .limit(1)

        if (deliveredOrders && deliveredOrders.length > 0) {
          canReview = true
          deliveredOrderId = deliveredOrders[0].id
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
    const actor = await getRequestActor(request)

    if (!actor || actor.role !== 'USER') {
      return NextResponse.json(
        { error: 'You must be signed in as a customer to leave a review.' },
        { status: 401 },
      )
    }

    const body = await request.json().catch(() => ({}))
    const productId = typeof body?.productId === 'string' ? body.productId.trim() : ''
    const rating = typeof body?.rating === 'number' ? Math.max(1, Math.min(5, Math.round(body.rating))) : 0
    const comment = typeof body?.comment === 'string' ? body.comment.trim() : ''

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

    // Verify customer actually has an order with status 'Delivered' containing this product
    const { data: eligibleOrders, error: orderCheckError } = await supabase
      .from('store_orders')
      .select('id, status, store_order_items!inner(product_id)')
      .eq('customer_id', actor.id)
      .eq('status', 'Delivered')
      .eq('store_order_items.product_id', productId)
      .limit(1)

    if (orderCheckError || !eligibleOrders || eligibleOrders.length === 0) {
      return NextResponse.json(
        {
          error:
            'Review not permitted. You can only rate and review products from orders that have been successfully delivered to you.',
        },
        { status: 403 },
      )
    }

    const orderId = eligibleOrders[0].id
    const reviewId = `rev_${actor.id.slice(0, 8)}_${productId.slice(0, 8)}_${Date.now()}`

    // Insert review
    const { data: newReview, error: insertError } = await supabase
      .from('product_reviews')
      .insert({
        id: reviewId,
        product_id: productId,
        order_id: orderId,
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
          { error: 'You have already submitted a review for this delivered product.' },
          { status: 400 },
        )
      }
      return NextResponse.json({ error: insertError.message }, { status: 400 })
    }

    // Recalculate average rating & review count for catalog_products table
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
