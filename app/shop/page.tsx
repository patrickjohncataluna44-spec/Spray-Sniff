'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { ProductCard } from '@/components/product-card'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'
import { Button } from '@/components/ui/button'
import { formatPHP } from '@/lib/currency'
import { useStore } from '@/lib/store-context'

const SCENT_FAMILIES = ['Floral', 'Woody', 'Fresh', 'Citrus', 'Oriental', 'Spicy', 'Aquatic', 'Aromatic']
const GENDERS = ['Male', 'Female', 'Unisex']
const PRICE_RANGES = [
  { min: 0, max: 100 },
  { min: 100, max: 200 },
  { min: 200, max: Infinity },
]

export default function ShopPage() {
  const { catalog, getInventoryRecord } = useStore()
  const [selectedScents, setSelectedScents] = useState<string[]>([])
  const [selectedGenders, setSelectedGenders] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null)
  const [sortBy, setSortBy] = useState('featured')

  let filtered = catalog.filter((product) => {
    if (getInventoryRecord(product.id)?.isArchived) {
      return false
    }

    if (selectedScents.length > 0) {
      const hasScent = product.scentFamily.some((family) => selectedScents.includes(family))
      if (!hasScent) {
        return false
      }
    }

    if (selectedGenders.length > 0) {
      const normalizedGender = product.gender.charAt(0).toUpperCase() + product.gender.slice(1)
      if (!selectedGenders.includes(normalizedGender)) {
        return false
      }
    }

    if (priceRange && (product.price < priceRange.min || product.price > priceRange.max)) {
      return false
    }

    return true
  })

  if (sortBy === 'price-low') {
    filtered = [...filtered].sort((a, b) => a.price - b.price)
  } else if (sortBy === 'price-high') {
    filtered = [...filtered].sort((a, b) => b.price - a.price)
  } else if (sortBy === 'rating') {
    filtered = [...filtered].sort((a, b) => b.rating - a.rating)
  } else if (sortBy === 'new') {
    filtered = [...filtered].sort((a, b) => Number(b.isNewArrival) - Number(a.isNewArrival))
  }

  const toggleScent = (scent: string) => {
    setSelectedScents((current) =>
      current.includes(scent) ? current.filter((entry) => entry !== scent) : [...current, scent],
    )
  }

  const toggleGender = (gender: string) => {
    setSelectedGenders((current) =>
      current.includes(gender) ? current.filter((entry) => entry !== gender) : [...current, gender],
    )
  }

  const hasFilters = selectedScents.length > 0 || selectedGenders.length > 0 || Boolean(priceRange)

  return (
    <StorefrontShell>
      <StorefrontPageHero
        eyebrow="Perfume Catalog"
        title="Shop Fragrances"
        description="Browse floral, woody, citrus, fresh, and evening-ready perfume profiles with clear note direction and smooth filtering."
      />

      <section className="px-4 pb-16 pt-2 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="storefront-panel sticky top-28 h-fit rounded-[2rem] p-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="storefront-eyebrow">Filters</p>
                <h2 className="mt-2 text-2xl text-foreground">Refine Your Mood</h2>
              </div>
              {hasFilters ? (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedScents([])
                    setSelectedGenders([])
                    setPriceRange(null)
                  }}
                  className="text-sm font-semibold text-primary transition hover:text-[#ff8a73]"
                >
                  Reset
                </button>
              ) : null}
            </div>

            <div className="mt-8 space-y-8">
              <section>
                <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/50">
                  Scent Family
                </h3>
                <div className="mt-4 flex flex-wrap gap-2">
                  {SCENT_FAMILIES.map((scent) => {
                    const active = selectedScents.includes(scent)

                    return (
                      <button
                        key={scent}
                        type="button"
                        onClick={() => toggleScent(scent)}
                        className={`rounded-full px-3 py-2 text-sm transition ${
                          active
                            ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(255,154,134,0.26)]'
                            : 'bg-muted/65 text-foreground/72 hover:bg-[#ffd6a6]'
                        }`}
                      >
                        {scent}
                      </button>
                    )
                  })}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/50">
                  Wear Style
                </h3>
                <div className="mt-4 space-y-3">
                  {GENDERS.map((gender) => (
                    <label key={gender} className="flex items-center gap-3 text-sm text-foreground/72">
                      <input
                        type="checkbox"
                        checked={selectedGenders.includes(gender)}
                        onChange={() => toggleGender(gender)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary/40"
                      />
                      {gender}
                    </label>
                  ))}
                </div>
              </section>

              <section>
                <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/50">
                  Price Range
                </h3>
                <div className="mt-4 space-y-3">
                  {PRICE_RANGES.map((range) => (
                    <label key={`${range.min}-${range.max}`} className="flex items-center gap-3 text-sm text-foreground/72">
                      <input
                        type="radio"
                        name="price"
                        checked={priceRange?.min === range.min && priceRange?.max === range.max}
                        onChange={() => setPriceRange({ min: range.min, max: range.max })}
                        className="h-4 w-4 border-border text-primary focus:ring-primary/40"
                      />
                      {range.min === 0
                        ? `Under ${formatPHP(range.max)}`
                        : range.max === Infinity
                          ? `${formatPHP(range.min)}+`
                          : `${formatPHP(range.min)} - ${formatPHP(range.max)}`}
                    </label>
                  ))}
                </div>
              </section>
            </div>
          </aside>

          <div>
            <div className="storefront-panel mb-6 flex flex-col gap-4 rounded-[2rem] p-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="storefront-eyebrow">Current View</p>
                <p className="mt-2 text-lg text-foreground">
                  Showing <span className="font-semibold">{filtered.length}</span> fragrance{filtered.length === 1 ? '' : 's'}
                </p>
              </div>

              <div className="relative">
                <select
                  value={sortBy}
                  onChange={(event) => setSortBy(event.target.value)}
                  className="storefront-input h-11 min-w-56 appearance-none pr-10 text-sm"
                >
                  <option value="featured">Featured</option>
                  <option value="new">New Arrivals</option>
                  <option value="rating">Highest Rated</option>
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                </select>
                <ChevronDown className="pointer-events-none absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/55" />
              </div>
            </div>

            {filtered.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            ) : (
              <div className="storefront-panel rounded-[2rem] p-12 text-center">
                <p className="text-2xl text-foreground">No fragrances matched your filters.</p>
                <p className="mt-3 text-sm leading-7 text-foreground/62">
                  Reset your selected mood, style, or budget and explore the catalog again.
                </p>
                <Button
                  variant="outline"
                  className="mt-6 h-11 rounded-2xl border-border/70 bg-white/70 px-6"
                  onClick={() => {
                    setSelectedScents([])
                    setSelectedGenders([])
                    setPriceRange(null)
                  }}
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </div>
      </section>
    </StorefrontShell>
  )
}
