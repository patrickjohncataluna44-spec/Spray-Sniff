'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Heart, MoveRight, Star } from 'lucide-react'
import { formatPHP } from '@/lib/currency'
import type { Product } from '@/lib/products'
import { useStore } from '@/lib/store-context'

interface ProductCardProps {
  product: Product
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
      ? 'bg-slate-200 text-slate-700'
      : availability === 'In Stock'
        ? 'bg-[#ffe5de] text-[#b85b48]'
        : availability === 'Low Stock'
          ? 'bg-[#fff0be] text-[#8f6b26]'
          : 'bg-rose-100 text-rose-700'

  return (
    <article className="storefront-panel group flex h-full flex-col overflow-hidden rounded-[2rem]">
      <div className="relative">
        <Link href={`/products/${product.id}`} className="block">
          <div className="relative aspect-[0.95] overflow-hidden bg-[linear-gradient(180deg,rgba(255,240,190,0.32),rgba(255,255,255,0.95))]">
            <Image
              src={product.images[0]}
              alt={product.name}
              fill
              sizes="(min-width: 1280px) 22vw, (min-width: 640px) 45vw, 100vw"
              className="object-cover transition-transform duration-500 group-hover:scale-[1.04]"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(45,33,36,0.06))]" />
          </div>
        </Link>

        <div className="absolute left-4 top-4 flex flex-wrap gap-2">
          {product.isNewArrival && (
            <span className="rounded-full bg-primary px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary-foreground">
              New
            </span>
          )}
          <span className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] ${availabilityTone}`}>
            {displayAvailability}
          </span>
        </div>

        <button
          type="button"
          suppressHydrationWarning
          onClick={() => void toggleWishlist(product.id)}
          className="absolute right-4 top-4 inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-white/80 bg-white/88 shadow-[0_10px_28px_rgba(95,58,54,0.12)] transition hover:scale-[1.03]"
          aria-label="Toggle wishlist"
        >
          <Heart className={`h-4 w-4 ${wishlisted ? 'fill-primary text-primary' : 'text-foreground'}`} />
        </button>
      </div>

      <div className="flex flex-1 flex-col p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-foreground/42">
          {product.brand}
        </p>

        <Link href={`/products/${product.id}`} className="mt-3">
          <h3 className="text-2xl leading-tight text-foreground transition group-hover:text-primary">
            {product.name}
          </h3>
        </Link>

        <div className="mt-4 flex flex-wrap gap-2">
          {product.scentFamily.slice(0, 2).map((scent) => (
            <span
              key={scent}
              className="rounded-full bg-[#fff0be] px-3 py-1 text-xs font-medium text-foreground/72"
            >
              {scent}
            </span>
          ))}
        </div>

        <div className="mt-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-foreground/55">
            <span className="inline-flex items-center gap-1 text-primary">
              <Star className="h-4 w-4 fill-current" />
              <span className="font-semibold text-foreground">{product.rating.toFixed(1)}</span>
            </span>
            <span>({product.reviewCount})</span>
          </div>
          <p className="text-xs text-foreground/48">
            {isArchived
              ? 'Archived'
              : availability === 'Low Stock'
                ? `${availableStock} left`
                : availability === 'Out of Stock'
                  ? 'Unavailable'
                  : `${availableStock} in stock`}
          </p>
        </div>

        <div className="mt-5 flex items-end justify-between gap-4">
          <div>
            <p className="text-3xl text-foreground">{formatPHP(product.price)}</p>
            <p className="mt-1 text-sm text-foreground/50">From {product.sizes[0]?.ml ?? 0}ml</p>
          </div>

          <Link
            href={`/products/${product.id}`}
            className="inline-flex h-11 items-center gap-2 rounded-2xl bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_12px_28px_rgba(255,154,134,0.28)] transition hover:bg-[#ff8a73]"
          >
            Discover
            <MoveRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </article>
  )
}
