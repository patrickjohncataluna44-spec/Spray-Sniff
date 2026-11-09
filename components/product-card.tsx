/* eslint-disable @next/next/no-img-element */
'use client'

import Link from 'next/link'
import { Heart, MoveRight, Star } from 'lucide-react'
import { formatPHP } from '@/lib/currency'
import type { Product } from '@/lib/products'
import { useStore } from '@/lib/store-context'

interface ProductCardProps {
  product: Product
}

function ProductImage({ src, alt }: { src: string; alt: string }) {
  return (
    <img
      src={src || '/placeholder.jpg'}
      alt={alt}
      className="h-full w-full object-contain p-3 transition-transform duration-500 ease-out group-hover:scale-105"
      style={{ backgroundColor: '#ffffff' }}
      onError={(e) => {
        e.currentTarget.src = '/placeholder.jpg'
      }}
    />
  )
}

export function ProductCard({ product }: ProductCardProps) {
  const {
    getAvailableStock,
    getAvailabilityStatus,
    getInventoryRecord,
    isWishlisted,
    toggleWishlist,
  } = useStore()
  const availableStock = getAvailableStock(product.id)
  const availability = getAvailabilityStatus(product.id)
  const isArchived = getInventoryRecord(product.id)?.isArchived ?? false
  const wishlisted = isWishlisted(product.id)
  const displayAvailability = isArchived ? 'Archived' : availability
  const availabilityTone =
    isArchived
      ? 'bg-neutral-200 text-neutral-700'
      : availability === 'In Stock'
        ? 'bg-[#ffe7e1] text-[#b85b48]'
        : availability === 'Low Stock'
          ? 'bg-[#fff0be] text-[#8f6b26]'
          : 'bg-rose-100 text-rose-700'

  const imageSrc = product.images[0] ?? '/placeholder.jpg'

  const isOnSale = Boolean(
    product.originalPrice &&
    Number(product.originalPrice) > Number(product.price) &&
    Number(product.price) > 0,
  )
  const discountPercent = isOnSale
    ? Math.round(((Number(product.originalPrice) - Number(product.price)) / Number(product.originalPrice)) * 100)
    : 0
  const savingsAmount = isOnSale ? Number(product.originalPrice) - Number(product.price) : 0

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-3xl border border-border/80 bg-white transition-[border-color] duration-200 hover:border-primary/60">
      {/* Image container */}
      <div
        className="relative w-full overflow-hidden bg-white"
        style={{ height: '280px', minHeight: '280px' }}
      >
        <Link href={`/products/${product.id}`} className="relative flex h-full w-full items-center justify-center bg-white">
          <ProductImage src={imageSrc} alt={product.name} />
        </Link>

        {/* Badges */}
        <div className="pointer-events-none absolute left-3 top-3 z-10 flex flex-wrap gap-1.5">
          {isOnSale && (
            <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-xs font-semibold text-white">
              Sale -{discountPercent}%
            </span>
          )}
          {product.isNewArrival && (
            <span className="rounded-full bg-primary px-2.5 py-0.5 text-xs font-semibold text-primary-foreground">
              New
            </span>
          )}
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${availabilityTone}`}>
            {displayAvailability}
          </span>
        </div>

        {/* Wishlist button */}
        <button
          type="button"
          suppressHydrationWarning
          onClick={() => void toggleWishlist(product.id)}
          className="absolute right-3 top-3 z-10 inline-flex items-center justify-center rounded-2xl border border-border/60 bg-white/95 text-foreground transition hover:bg-white hover:text-primary"
          style={{ height: '38px', width: '38px' }}
          aria-label="Toggle wishlist"
        >
          <Heart className={`h-4 w-4 ${wishlisted ? 'fill-primary text-primary' : 'currentColor'}`} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-xs text-foreground/50">
          {product.brand} · {product.category}
        </p>

        <Link href={`/products/${product.id}`} className="mt-2">
          <h3 className="font-serif text-2xl leading-snug text-foreground transition group-hover:text-primary">
            {product.name}
          </h3>
        </Link>

        {/* Olfactive Notes Preview */}
        <div className="mt-3 flex flex-wrap gap-1.5">
          {product.scentFamily.slice(0, 2).map((scent) => (
            <span
              key={scent}
              className="rounded-full bg-[#fceddf] px-2.5 py-0.5 text-xs font-medium text-foreground/75"
            >
              {scent}
            </span>
          ))}
          {product.topNotes[0] ? (
            <span className="rounded-full border border-border/60 px-2.5 py-0.5 text-xs text-foreground/60">
              Note: {product.topNotes[0]}
            </span>
          ) : null}
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 text-sm text-foreground/60">
            <span className="inline-flex items-center gap-1 text-primary">
              <Star className="h-4 w-4 fill-current" />
              <span className="font-semibold text-foreground">{product.rating.toFixed(1)}</span>
            </span>
            <span>({product.reviewCount} reviews)</span>
          </div>
          <p className="text-xs text-foreground/50">
            {isArchived
              ? 'Archived'
              : availability === 'Low Stock'
                ? `${availableStock} left`
                : availability === 'Out of Stock'
                  ? 'Unavailable'
                  : `${availableStock} in stock`}
          </p>
        </div>

        <div className="mt-5 flex items-end justify-between gap-3 pt-3">
          <div>
            {isOnSale ? (
              <div>
                <div className="flex flex-wrap items-baseline gap-2">
                  <p className="text-2xl font-bold text-red-600 font-serif">{formatPHP(product.price)}</p>
                  <p className="text-sm text-foreground/40 line-through">
                    {formatPHP(product.originalPrice!)}
                  </p>
                </div>
                <p className="text-xs text-red-700 font-medium mt-0.5">
                  Save {formatPHP(savingsAmount)}
                </p>
              </div>
            ) : (
              <p className="text-2xl text-foreground font-serif">{formatPHP(product.price)}</p>
            )}
            <p className="text-xs text-foreground/50 mt-0.5">From {product.sizes[0]?.ml ?? 50}ml</p>
          </div>

          <Link
            href={`/products/${product.id}`}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:bg-[#ff8a73]"
          >
            <span>View</span>
            <MoveRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  )
}
