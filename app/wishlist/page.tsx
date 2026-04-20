'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/product-card'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'
import { useStore } from '@/lib/store-context'

export default function WishlistPage() {
  const { catalog, wishlistIds } = useStore()
  const wishlistedProducts = catalog.filter((product) => wishlistIds.includes(product.id))

  return (
    <StorefrontShell>
      <StorefrontPageHero
        eyebrow="Saved Perfumes"
        title="My Wishlist"
        description={`${wishlistedProducts.length} fragrance${wishlistedProducts.length === 1 ? '' : 's'} saved for later. Revisit your favorite scent directions any time.`}
      />

      <section className="px-4 pb-16 pt-2 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          {wishlistedProducts.length > 0 ? (
            <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
              {wishlistedProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          ) : (
            <div className="storefront-panel rounded-[2rem] p-12 text-center">
              <p className="text-2xl text-foreground">Your wishlist is still empty.</p>
              <p className="mt-3 text-sm leading-7 text-foreground/62">
                Save perfumes you want to revisit, compare, or gift later.
              </p>
              <Button className="mt-6 h-11 rounded-2xl bg-primary px-6 text-primary-foreground hover:bg-[#ff8a73]" asChild>
                <Link href="/shop">Start Exploring</Link>
              </Button>
            </div>
          )}
        </div>
      </section>
    </StorefrontShell>
  )
}
