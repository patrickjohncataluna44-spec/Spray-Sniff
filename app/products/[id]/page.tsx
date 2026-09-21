'use client'

import Link from 'next/link'
import { use, useEffect, useState, useCallback } from 'react'
import { CheckCircle2, Heart, MessageSquarePlus, ShoppingBag, Star, ShieldCheck, Sparkles, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ProductCard } from '@/components/product-card'
import { StorefrontShell } from '@/components/storefront-shell'
import { useAuth } from '@/lib/auth-context'
import { formatPHP } from '@/lib/currency'
import { useStore } from '@/lib/store-context'
import { subscribeToProductReviews } from '@/lib/supabase-realtime'
import { toast } from '@/hooks/use-toast'

import { getBrowserAuthHeaders } from '@/lib/client-auth-headers'

interface ReviewData {
  id: string
  productId: string
  orderId: string
  customerId: string
  customerName: string
  rating: number
  comment: string
  createdAt: string
}

export default function ProductPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const {
    addToCart,
    getAvailabilityStatus,
    getAvailableStock,
    getInventoryRecord,
    getProductById,
    isWishlisted,
    toggleWishlist,
  } = useStore()
  const { isAuthenticated, isLoading: authLoading, user } = useAuth()
  const product = getProductById(id)
  const inventoryRecord = getInventoryRecord(id)
  const isArchived = inventoryRecord?.isArchived ?? false
  const [selectedSizeMl, setSelectedSizeMl] = useState<number | null>(null)
  const [quantity, setQuantity] = useState(1)
  const [mainImage, setMainImage] = useState('')
  const [isAddingToCart, setIsAddingToCart] = useState(false)

  // Reviews state
  const [reviews, setReviews] = useState<ReviewData[]>([])
  const [averageRating, setAverageRating] = useState<number>(0)
  const [totalReviews, setTotalReviews] = useState<number>(0)
  const [canReview, setCanReview] = useState<boolean>(false)
  const [alreadyReviewed, setAlreadyReviewed] = useState<boolean>(false)
  const [newRating, setNewRating] = useState<number>(5)
  const [newComment, setNewComment] = useState<string>('')
  const [isSubmittingReview, setIsSubmittingReview] = useState<boolean>(false)
  const [isLoadingReviews, setIsLoadingReviews] = useState<boolean>(true)

  // Fetch reviews & customer eligibility from /api/reviews
  const fetchProductReviews = useCallback(async () => {
    if (!id) return
    try {
      const authHeaders = await getBrowserAuthHeaders()
      const extraHeaders: Record<string, string> = {
        ...authHeaders,
      }
      if (user?.id) {
        extraHeaders['x-customer-id'] = user.id
      }
      if (user?.email) {
        extraHeaders['x-customer-email'] = user.email
      }

      const res = await fetch(`/api/reviews?productId=${encodeURIComponent(id)}`, {
        headers: extraHeaders,
        cache: 'no-store',
      })
      if (res.ok) {
        const data = await res.json()
        setReviews(Array.isArray(data.reviews) ? data.reviews : [])
        setAverageRating(typeof data.averageRating === 'number' ? data.averageRating : 0)
        setTotalReviews(typeof data.totalReviews === 'number' ? data.totalReviews : 0)
        setCanReview(Boolean(data.canReview))
        setAlreadyReviewed(Boolean(data.alreadyReviewed))
      }
    } catch (err) {
      console.warn('Failed to load reviews:', err)
    } finally {
      setIsLoadingReviews(false)
    }
  }, [id, user?.id, user?.email])

  // Re-fetch reviews once auth finishes loading or user session becomes available
  useEffect(() => {
    if (authLoading) return
    void fetchProductReviews()
  }, [authLoading, user?.id, user?.email, fetchProductReviews])

  useEffect(() => {
    if (!id) return
    const unsubscribe = subscribeToProductReviews(id, () => {
      void fetchProductReviews()
    })

    return () => {
      unsubscribe()
    }
  }, [fetchProductReviews, id])

  useEffect(() => {
    if (!product) {
      return
    }

    setSelectedSizeMl(product.sizes[0]?.ml ?? null)
    setMainImage(product.images[0] ?? '')
    setQuantity(1)
  }, [product])

  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newComment.trim()) {
      toast({
        title: 'Review text required',
        description: 'Please write your feedback before submitting.',
        variant: 'destructive',
      })
      return
    }

    setIsSubmittingReview(true)
    try {
      const authHeaders = await getBrowserAuthHeaders()
      const extraHeaders: Record<string, string> = {
        'Content-Type': 'application/json',
        ...authHeaders,
      }
      if (user?.id) {
        extraHeaders['x-customer-id'] = user.id
      }
      if (user?.email) {
        extraHeaders['x-customer-email'] = user.email
      }

      const res = await fetch('/api/reviews', {
        method: 'POST',
        headers: extraHeaders,
        body: JSON.stringify({
          productId: id,
          rating: newRating,
          comment: newComment.trim(),
          customerId: user?.id,
          customerEmail: user?.email,
        }),
      })
      const result = await res.json()

      if (!res.ok) {
        toast({
          title: 'Review not allowed',
          description: result.error || 'Only delivered orders can be reviewed.',
          variant: 'destructive',
        })
        return
      }

      toast({
        title: 'Review submitted!',
        description: 'Thank you for your rating and feedback.',
      })
      setNewComment('')
      setCanReview(false)
      setAlreadyReviewed(true)
      void fetchProductReviews()
    } catch (error) {
      toast({
        title: 'Failed to submit review',
        description: 'An unexpected error occurred. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSubmittingReview(false)
    }
  }

  if (!product) {
    return (
      <StorefrontShell>
        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="storefront-panel rounded-[2rem] p-12 text-center">
              <p className="text-2xl text-foreground">Product not found.</p>
            </div>
          </div>
        </section>
      </StorefrontShell>
    )
  }

  const selectedSize = product.sizes.find((size) => size.ml === selectedSizeMl) ?? product.sizes[0]
  const availableStock = getAvailableStock(product.id)
  const availability = getAvailabilityStatus(product.id)
  const displayAvailability = isArchived ? 'Archived' : availability
  const relatedProducts = product.relatedProducts
    .map((productId) => getProductById(productId))
    .filter((relatedProduct) =>
      relatedProduct ? !getInventoryRecord(relatedProduct.id)?.isArchived : false,
    )
  const availabilityTone =
    isArchived
      ? 'bg-slate-200 text-slate-700'
      : availability === 'In Stock'
        ? 'bg-[#ffe5de] text-[#b85b48]'
        : availability === 'Low Stock'
          ? 'bg-[#fff0be] text-[#8f6b26]'
          : 'bg-rose-100 text-rose-700'
  const canShop = isAuthenticated && user?.role === 'USER'
  const authRedirectHref = `/auth/signin?redirectTo=${encodeURIComponent(`/products/${product.id}`)}`
  const registerRedirectHref = `/auth/signup?redirectTo=${encodeURIComponent(`/products/${product.id}`)}`
  const wishlisted = isWishlisted(product.id)

  const handleAddToCart = async () => {
    setIsAddingToCart(true)

    try {
      const result = await addToCart({
        productId: product.id,
        quantity,
        size: selectedSize.ml,
        unitPrice: selectedSize.price,
      })

      toast({
        title: result.ok ? 'Cart updated' : 'Unable to add item',
        description: result.message,
        variant: result.ok ? 'default' : 'destructive',
      })
    } finally {
      setIsAddingToCart(false)
    }
  }

  const handleWishlist = async () => {
    const result = await toggleWishlist(product.id)
    toast({
      title: result.ok ? 'Wishlist updated' : 'Unable to update wishlist',
      description: result.message,
      variant: result.ok ? 'default' : 'destructive',
    })
  }

  return (
    <StorefrontShell>
      <section className="px-4 pb-8 pt-8 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.96fr_1.04fr]">
          <div className="space-y-4">
            {/* Main image — plain img for data: URL support (base64 from Supabase) */}
            <div
              className="storefront-panel relative overflow-hidden rounded-[2.25rem]"
              style={{ height: '320px', minHeight: '320px' }}
            >
              <img
                src={mainImage || product.images[0] || '/placeholder.jpg'}
                alt={product.name}
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                onError={(e) => { e.currentTarget.src = '/placeholder.jpg' }}
              />
            </div>

            <div className="grid grid-cols-4 gap-3">
              {product.images.map((image, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => setMainImage(image)}
                  className={`storefront-panel relative overflow-hidden rounded-[1.5rem] ${
                    (mainImage || product.images[0]) === image ? 'ring-2 ring-primary/55' : ''
                  }`}
                  style={{ height: '72px' }}
                  aria-label={`View product image ${index + 1}`}
                >
                  <img
                    src={image}
                    alt={`${product.name} view ${index + 1}`}
                    style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
                    onError={(e) => { e.currentTarget.src = '/placeholder.jpg' }}
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="storefront-panel rounded-[2.25rem] p-7 sm:p-9">
              <p className="storefront-eyebrow">{product.brand}</p>
              <h1 className="mt-3 text-[clamp(1.875rem,6vw,3.5rem)] leading-tight text-foreground sm:text-5xl lg:text-6xl">{product.name}</h1>

              <div className="mt-5 flex flex-wrap items-center gap-4">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${availabilityTone}`}>
                  {displayAvailability}
                </span>
                <span className="inline-flex items-center gap-2 text-sm text-foreground/58">
                  <Star className="h-4 w-4 fill-primary text-primary" />
                  <span className="font-semibold text-foreground">
                    {totalReviews > 0 ? averageRating.toFixed(1) : product.rating.toFixed(1)}
                  </span>
                  <span>
                    ({totalReviews > 0 ? totalReviews : product.reviewCount} reviews)
                  </span>
                </span>
              </div>

              <p className="mt-6 text-base leading-8 text-foreground/68 sm:text-lg">{product.description}</p>

              <div className="mt-6 flex flex-wrap gap-2">
                {product.scentFamily.map((family) => (
                  <span
                    key={family}
                    className="rounded-full bg-[#fff0be] px-3 py-1 text-xs font-medium text-foreground/72"
                  >
                    {family}
                  </span>
                ))}
              </div>

              <div className="mt-8 grid gap-6 sm:grid-cols-2">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/48">
                    Choose Size
                  </p>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    {product.sizes.map((size) => (
                      <button
                        key={size.ml}
                        type="button"
                        onClick={() => setSelectedSizeMl(size.ml)}
                        className={`rounded-[1.25rem] border px-4 py-3 text-sm font-semibold transition ${
                          selectedSize.ml === size.ml
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border/70 bg-white/72 text-foreground hover:border-primary/45'
                        }`}
                      >
                        {size.ml}ml
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/48">
                    Quantity
                  </p>
                  <div className="mt-3 inline-flex items-center gap-2 rounded-[1.25rem] border border-border/70 bg-white/72 p-1">
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.max(1, quantity - 1))}
                      disabled={quantity <= 1}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min={1}
                      max={Math.max(1, availableStock)}
                      value={quantity}
                      onChange={(e) => {
                        const val = e.target.value
                        if (val === '') {
                          setQuantity(1)
                          return
                        }
                        const parsed = parseInt(val, 10)
                        if (!isNaN(parsed)) {
                          setQuantity(Math.min(Math.max(1, parsed), Math.max(1, availableStock)))
                        }
                      }}
                      className="w-12 text-center font-semibold text-foreground bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-accent rounded-lg py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      aria-label="Product quantity"
                    />
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(Math.max(1, availableStock), quantity + 1))}
                      disabled={availableStock === 0 || quantity >= availableStock}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  <p className="mt-3 text-sm text-foreground/58">
                    {isArchived
                      ? 'This perfume has been archived and is not available for checkout.'
                      : availability === 'Out of Stock'
                        ? 'Currently unavailable online and in store.'
                        : `${availableStock} unit(s) available right now.`}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-col gap-4 border-t border-border/70 pt-6 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-sm uppercase tracking-[0.18em] text-foreground/48">Selected Total</p>
                  <p className="mt-2 text-4xl text-foreground">{formatPHP(selectedSize.price * quantity)}</p>
                </div>

                {canShop ? (
                  <div className="flex gap-3">
                    <Button
                      size="lg"
                      className="h-12 rounded-2xl bg-primary px-6 text-primary-foreground shadow-[0_16px_34px_rgba(255,154,134,0.28)] hover:bg-[#ff8a73]"
                      onClick={() => void handleAddToCart()}
                      disabled={availableStock === 0 || isArchived || isAddingToCart}
                    >
                      <ShoppingBag className="mr-2 h-4 w-4" />
                      {isArchived
                        ? 'Archived'
                        : availableStock === 0
                          ? 'Out Of Stock'
                          : isAddingToCart
                            ? 'Adding...'
                            : 'Add To Cart'}
                    </Button>
                    <Button
                      size="lg"
                      variant="outline"
                      className="h-12 rounded-2xl border-border/70 bg-white/70 px-5"
                      onClick={() => void handleWishlist()}
                    >
                      <Heart className={`h-5 w-5 ${wishlisted ? 'fill-primary text-primary' : ''}`} />
                    </Button>
                  </div>
                ) : (
                  <div className="storefront-soft-panel rounded-[1.75rem] p-5 sm:max-w-md">
                    <p className="storefront-eyebrow">Member Checkout</p>
                    <h2 className="mt-3 text-3xl text-foreground">Sign in to purchase</h2>
                    <p className="mt-3 text-sm leading-7 text-foreground/66">
                      Create an account or sign in to add this fragrance to your cart and continue to checkout.
                    </p>
                    <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                      {authLoading ? (
                        <>
                          <Button className="h-11 rounded-2xl" disabled>
                            Checking account...
                          </Button>
                          <Button variant="outline" className="h-11 rounded-2xl" disabled>
                            Create Account
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button className="h-11 rounded-2xl bg-primary text-primary-foreground hover:bg-[#ff8a73]" asChild>
                            <Link href={authRedirectHref}>Sign In</Link>
                          </Button>
                          <Button
                            variant="outline"
                            className="h-11 rounded-2xl border-border/70 bg-white/70"
                            asChild
                          >
                            <Link href={registerRedirectHref}>Create Account</Link>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="storefront-panel rounded-[2rem] p-7 sm:p-9">
              <p className="storefront-eyebrow">Scent Profile</p>
              <div className="mt-6 grid gap-6 sm:grid-cols-3">
                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/48">Top Notes</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.topNotes.map((note) => (
                      <span key={note} className="rounded-full bg-muted/55 px-3 py-1 text-sm text-foreground">
                        {note}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/48">Heart Notes</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.middleNotes.map((note) => (
                      <span key={note} className="rounded-full bg-muted/55 px-3 py-1 text-sm text-foreground">
                        {note}
                      </span>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/48">Base Notes</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {product.baseNotes.map((note) => (
                      <span key={note} className="rounded-full bg-muted/55 px-3 py-1 text-sm text-foreground">
                        {note}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.5rem] bg-muted/28 p-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/48">Longevity</p>
                  <div className="mt-3 flex gap-1">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={`longevity-${index}`}
                        className={`h-2 flex-1 rounded-full ${
                          index < Math.ceil(product.longevity / 2) ? 'bg-primary' : 'bg-border'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] bg-muted/28 p-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/48">Intensity</p>
                  <div className="mt-3 flex gap-1">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <div
                        key={`intensity-${index}`}
                        className={`h-2 flex-1 rounded-full ${
                          index < product.intensity ? 'bg-primary' : 'bg-border'
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div className="rounded-[1.5rem] bg-muted/28 p-4">
                  <p className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/48">Gender</p>
                  <p className="mt-3 text-lg font-semibold capitalize text-foreground">{product.gender}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Verified Buyer Ratings & Reviews Section */}
      <section className="px-4 py-8 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="storefront-panel rounded-[2.25rem] p-6 sm:p-10">
            <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border/60 pb-6">
              <div>
                <p className="storefront-eyebrow">Customer Feedback</p>
                <h2 className="mt-2 text-3xl font-serif text-foreground sm:text-4xl">Ratings & Reviews</h2>
                <div className="mt-2 flex items-center gap-3">
                  <div className="flex items-center gap-1 text-primary">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={`h-5 w-5 ${
                          i < Math.round(totalReviews > 0 ? averageRating : product.rating)
                            ? 'fill-primary text-primary'
                            : 'text-muted-foreground/30'
                        }`}
                      />
                    ))}
                  </div>
                  <span className="text-lg font-bold text-foreground">
                    {totalReviews > 0 ? averageRating.toFixed(1) : product.rating.toFixed(1)}
                  </span>
                  <span className="text-sm text-foreground/60">
                    ({totalReviews > 0 ? totalReviews : product.reviewCount} verified reviews)
                  </span>
                </div>
              </div>

              {/* Verified purchase status pill */}
              <div className="flex items-center gap-2 rounded-2xl bg-muted/40 px-4 py-2.5 text-xs text-foreground/75 border border-border/50">
                <ShieldCheck className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <span>Only customers with <strong>Delivered</strong> orders can submit reviews</span>
              </div>
            </div>

            {/* Review Submission Form - Gated strictly for customers with a Delivered order */}
            <div className="my-8">
              {canReview ? (
                <div className="rounded-[1.75rem] border border-primary/25 bg-primary/5 p-6 sm:p-8">
                  <div className="flex items-center gap-2 text-primary font-medium text-sm">
                    <CheckCircle2 className="h-4 w-4" />
                    <span>You purchased and received this product! Leave your rating & review:</span>
                  </div>

                  <form onSubmit={handleReviewSubmit} className="mt-5 space-y-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-[0.18em] text-foreground/60 mb-2">
                        Your Rating
                      </label>
                      <div className="flex items-center gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewRating(star)}
                            className="p-1 transition-transform hover:scale-110 focus:outline-none"
                          >
                            <Star
                              className={`h-7 w-7 ${
                                star <= newRating
                                  ? 'fill-primary text-primary'
                                  : 'text-muted-foreground/30 hover:text-primary/50'
                              }`}
                            />
                          </button>
                        ))}
                        <span className="ml-2 text-sm font-semibold text-foreground">
                          {newRating} Star{newRating > 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="reviewComment" className="block text-xs font-semibold uppercase tracking-[0.18em] text-foreground/60 mb-2">
                        Your Review & Experience
                      </label>
                      <Textarea
                        id="reviewComment"
                        rows={3}
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="Tell others how it smells, its projection, longevity, and what you loved about it..."
                        className="rounded-2xl border-border bg-background/90"
                      />
                    </div>

                    <div className="flex justify-end">
                      <Button
                        type="submit"
                        disabled={isSubmittingReview || !newComment.trim()}
                        className="rounded-full px-6 gap-2"
                      >
                        {isSubmittingReview ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          <>
                            <MessageSquarePlus className="h-4 w-4" />
                            Post Verified Review
                          </>
                        )}
                      </Button>
                    </div>
                  </form>
                </div>
              ) : alreadyReviewed ? (
                <div className="rounded-[1.5rem] bg-emerald-500/10 border border-emerald-500/20 p-5 text-sm text-emerald-800 dark:text-emerald-300 flex items-center gap-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  <span>You have already submitted a verified review for this delivered fragrance. Thank you!</span>
                </div>
              ) : (
                <div className="rounded-[1.5rem] bg-muted/30 border border-border/60 p-5 text-sm text-foreground/70 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <ShieldCheck className="h-5 w-5 text-primary shrink-0" />
                    <p>
                      Rating and reviews are available only to customers whose order has been <strong>successfully delivered</strong>.
                    </p>
                  </div>
                  {isAuthenticated ? (
                    <Link
                      href="/orders"
                      className="inline-flex items-center justify-center text-xs font-semibold text-primary hover:underline shrink-0"
                    >
                      Check My Orders &rarr;
                    </Link>
                  ) : (
                    <Link
                      href={`/auth/signin?redirectTo=/products/${product.id}`}
                      className="inline-flex items-center justify-center text-xs font-semibold text-primary hover:underline shrink-0"
                    >
                      Sign In to Review &rarr;
                    </Link>
                  )}
                </div>
              )}
            </div>

            {/* Reviews List */}
            <div className="mt-8 space-y-4">
              <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/50">
                Verified Customer Reviews ({reviews.length})
              </h3>

              {isLoadingReviews ? (
                <div className="py-8 text-center text-sm text-foreground/50">
                  <Loader2 className="h-5 w-5 animate-spin mx-auto mb-2 text-primary" />
                  Loading customer reviews...
                </div>
              ) : reviews.length === 0 ? (
                <div className="rounded-[1.5rem] bg-muted/20 border border-border/40 p-8 text-center">
                  <p className="font-medium text-foreground">No customer feedback yet for this product.</p>
                  <p className="mt-1 text-sm text-foreground/55">
                    Be the first customer to receive and review this fragrance!
                  </p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {reviews.map((rev) => (
                    <div
                      key={rev.id}
                      className="rounded-[1.5rem] bg-muted/25 border border-border/50 p-5 space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <p className="font-semibold text-foreground text-sm flex items-center gap-1.5">
                            {rev.customerName}
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-medium">
                              <CheckCircle2 className="h-2.5 w-2.5" />
                              Delivered Buyer
                            </span>
                          </p>
                          <p className="text-[11px] text-foreground/45 mt-0.5">
                            {new Date(rev.createdAt).toLocaleDateString(undefined, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="flex items-center gap-0.5 text-primary">
                          {Array.from({ length: 5 }).map((_, idx) => (
                            <Star
                              key={idx}
                              className={`h-3.5 w-3.5 ${
                                idx < rev.rating
                                  ? 'fill-primary text-primary'
                                  : 'text-muted-foreground/30'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-sm text-foreground/75 leading-relaxed italic">
                        &ldquo;{rev.comment}&rdquo;
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 pb-16 pt-2 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="storefront-eyebrow">You May Also Like</p>
            <h2 className="mt-3 text-3xl text-foreground sm:text-4xl lg:text-5xl">Related Fragrances</h2>
          </div>
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {relatedProducts.map(
              (relatedProduct) =>
                relatedProduct && <ProductCard key={relatedProduct.id} product={relatedProduct} />,
            )}
          </div>
        </div>
      </section>
    </StorefrontShell>
  )
}
