'use client'

import Image from 'next/image'
import Link from 'next/link'
import { use, useEffect, useState } from 'react'
import { Heart, ShoppingBag, Star } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/product-card'
import { StorefrontShell } from '@/components/storefront-shell'
import { useAuth } from '@/lib/auth-context'
import { formatPHP } from '@/lib/currency'
import { useStore } from '@/lib/store-context'
import { toast } from '@/hooks/use-toast'

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

  useEffect(() => {
    if (!product) {
      return
    }

    setSelectedSizeMl(product.sizes[0]?.ml ?? null)
    setMainImage(product.images[0] ?? '')
    setQuantity(1)
  }, [product])

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
            <div className="storefront-panel relative aspect-square overflow-hidden rounded-[2.25rem]">
              <Image
                src={mainImage || product.images[0]}
                alt={product.name}
                fill
                className="object-cover"
                priority
              />
            </div>

            <div className="grid grid-cols-4 gap-4">
              {product.images.map((image, index) => (
                <button
                  key={image}
                  type="button"
                  onClick={() => setMainImage(image)}
                  className={`storefront-panel relative aspect-square overflow-hidden rounded-[1.5rem] ${
                    (mainImage || product.images[0]) === image ? 'ring-2 ring-primary/55' : ''
                  }`}
                  aria-label={`View product image ${index + 1}`}
                >
                  <Image
                    src={image}
                    alt={`${product.name} view ${index + 1}`}
                    fill
                    className="object-cover"
                  />
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="storefront-panel rounded-[2.25rem] p-7 sm:p-9">
              <p className="storefront-eyebrow">{product.brand}</p>
              <h1 className="mt-3 text-5xl leading-tight text-foreground sm:text-6xl">{product.name}</h1>

              <div className="mt-5 flex flex-wrap items-center gap-4">
                <span className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] ${availabilityTone}`}>
                  {displayAvailability}
                </span>
                <span className="inline-flex items-center gap-2 text-sm text-foreground/58">
                  <Star className="h-4 w-4 fill-primary text-primary" />
                  <span className="font-semibold text-foreground">{product.rating.toFixed(1)}</span>
                  <span>({product.reviewCount} reviews)</span>
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
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg transition hover:bg-muted"
                    >
                      -
                    </button>
                    <span className="w-10 text-center font-semibold text-foreground">{quantity}</span>
                    <button
                      type="button"
                      onClick={() => setQuantity(Math.min(Math.max(1, availableStock), quantity + 1))}
                      disabled={availableStock === 0}
                      className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
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
              <div className="mt-6 grid gap-6 md:grid-cols-3">
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

      <section className="px-4 pb-16 pt-2 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="storefront-eyebrow">You May Also Like</p>
            <h2 className="mt-3 text-4xl text-foreground sm:text-5xl">Related Fragrances</h2>
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
