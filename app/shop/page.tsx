'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { ChevronDown, Search, SlidersHorizontal, X } from 'lucide-react'
import { ProductCard } from '@/components/product-card'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useStore } from '@/lib/store-context'
import { subscribeToProductCategories } from '@/lib/supabase-realtime'

const SCENT_FAMILIES = ['Floral', 'Woody', 'Fresh', 'Citrus', 'Oriental', 'Spicy', 'Aquatic', 'Aromatic']
const GENDERS = ['Male', 'Female', 'Unisex']
const PRICE_RANGES = [
  { min: 0, max: 100 },
  { min: 100, max: 200 },
  { min: 200, max: Infinity },
]

function ShopContent() {
  const { catalog, getInventoryRecord } = useStore()
  const searchParams = useSearchParams()
  const initialQuery = searchParams.get('q') || searchParams.get('search') || ''

  const [searchQuery, setSearchQuery] = useState(initialQuery)
  const [selectedScents, setSelectedScents] = useState<string[]>([])
  const [selectedGenders, setSelectedGenders] = useState<string[]>([])
  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [dbCategories, setDbCategories] = useState<string[]>([])
  const [priceRange, setPriceRange] = useState<{ min: number; max: number } | null>(null)
  const [sortBy, setSortBy] = useState('featured')
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)

  // Sync URL query when navigation happens
  useEffect(() => {
    const q = searchParams.get('q') || searchParams.get('search') || ''
    setSearchQuery(q)
  }, [searchParams])

  // Fetch categories from Supabase & subscribe in Realtime
  useEffect(() => {
    const fetchCats = async () => {
      try {
        const res = await fetch('/api/categories')
        if (res.ok) {
          const json = await res.json()
          if (Array.isArray(json.categories)) {
            setDbCategories(json.categories.map((c: { name: string }) => c.name))
          }
        }
      } catch (err) {
        console.warn('Failed to fetch categories in Shop', err)
      }
    }

    void fetchCats()
    return subscribeToProductCategories(() => {
      void fetchCats()
    })
  }, [])

  const availableCategories = useMemo(() => {
    const fromCatalog = catalog.map((p) => p.category).filter(Boolean)
    const set = new Set([...dbCategories, ...fromCatalog])
    return ['All', ...Array.from(set)]
  }, [catalog, dbCategories])

  let filtered = catalog.filter((product) => {
    if (getInventoryRecord(product.id)?.isArchived) {
      return false
    }

    // Live search query matching
    if (searchQuery.trim()) {
      const q = searchQuery.trim().toLowerCase()
      const matchesName = product.name.toLowerCase().includes(q)
      const matchesBrand = product.brand.toLowerCase().includes(q)
      const matchesCategory = product.category?.toLowerCase().includes(q)
      const matchesDescription = product.description?.toLowerCase().includes(q)
      const matchesScent = product.scentFamily?.some((family) => family.toLowerCase().includes(q))
      const matchesGender = product.gender?.toLowerCase().includes(q)
      const matchesPrice = q === '1 peso' || q === '1' ? product.price === 1 : false

      if (
        !matchesName &&
        !matchesBrand &&
        !matchesCategory &&
        !matchesDescription &&
        !matchesScent &&
        !matchesGender &&
        !matchesPrice
      ) {
        return false
      }
    }

    if (selectedCategory !== 'All' && product.category !== selectedCategory) {
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

  const clearFilters = () => {
    setSelectedScents([])
    setSelectedGenders([])
    setSelectedCategory('All')
    setPriceRange(null)
    setSearchQuery('')
  }

  const hasFilters =
    selectedCategory !== 'All' ||
    selectedScents.length > 0 ||
    selectedGenders.length > 0 ||
    Boolean(priceRange) ||
    Boolean(searchQuery.trim())

  const FilterPanel = () => (
    <div className="space-y-8">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="storefront-eyebrow">Filters</p>
          <h2 className="mt-2 text-2xl text-foreground">Refine Your Mood</h2>
        </div>
        {hasFilters ? (
          <button
            type="button"
            suppressHydrationWarning
            onClick={clearFilters}
            className="text-sm font-semibold text-primary transition hover:text-[#ff8a73]"
          >
            Reset
          </button>
        ) : null}
      </div>

      <div className="space-y-8">
        {/* Dynamic Product Categories from Supabase */}
        <section>
          <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/50">
            Category
          </h3>
          <div className="mt-4 flex flex-wrap gap-2 max-h-48 overflow-y-auto pr-1">
            {availableCategories.map((cat) => {
              const active = selectedCategory === cat

              return (
                <button
                  key={cat}
                  type="button"
                  suppressHydrationWarning
                  onClick={() => setSelectedCategory(cat)}
                  className={`rounded-full px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(255,154,134,0.26)]'
                      : 'bg-muted/65 text-foreground/72 hover:bg-[#ffd6a6]'
                  }`}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        </section>

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
                  suppressHydrationWarning
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
            Gender
          </h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {GENDERS.map((gender) => {
              const active = selectedGenders.includes(gender)

              return (
                <button
                  key={gender}
                  type="button"
                  suppressHydrationWarning
                  onClick={() => toggleGender(gender)}
                  className={`rounded-full px-3 py-2 text-sm transition ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(255,154,134,0.26)]'
                      : 'bg-muted/65 text-foreground/72 hover:bg-[#ffd6a6]'
                  }`}
                >
                  {gender}
                </button>
              )
            })}
          </div>
        </section>

        <section>
          <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/50">
            Price Range
          </h3>
          <div className="mt-4 flex flex-wrap gap-2">
            {PRICE_RANGES.map((range, index) => {
              const active = priceRange?.min === range.min && priceRange?.max === range.max
              const label =
                range.max === Infinity
                  ? 'Over ₱200'
                  : range.min === 0
                    ? 'Under ₱100'
                    : '₱100 - ₱200'

              return (
                <button
                  key={index}
                  type="button"
                  suppressHydrationWarning
                  onClick={() => setPriceRange(active ? null : range)}
                  className={`rounded-full px-3 py-2 text-sm transition ${
                    active
                      ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(255,154,134,0.26)]'
                      : 'bg-muted/65 text-foreground/72 hover:bg-[#ffd6a6]'
                  }`}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )

  return (
    <StorefrontShell>
      <StorefrontPageHero
        eyebrow="Perfume Catalog"
        title="Shop Fragrances"
        description="Browse floral, woody, citrus, fresh, and evening-ready perfume profiles with clear note direction and smooth filtering."
      />

      <section className="px-4 pb-16 pt-2 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">

          {/* Mobile filter toggle bar */}
          <div className="mb-4 flex items-center gap-3 lg:hidden">
            <button
              type="button"
              suppressHydrationWarning
              onClick={() => setMobileFiltersOpen(!mobileFiltersOpen)}
              className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-white/80 px-4 py-2.5 text-sm font-medium text-foreground shadow-sm transition hover:bg-muted"
            >
              {mobileFiltersOpen ? <X className="h-4 w-4" /> : <SlidersHorizontal className="h-4 w-4" />}
              {mobileFiltersOpen ? 'Close Filters' : 'Filters'}
              {hasFilters && (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-primary-foreground">
                  {selectedScents.length + selectedGenders.length + (priceRange ? 1 : 0) + (searchQuery ? 1 : 0)}
                </span>
              )}
            </button>
            {hasFilters && (
              <button
                type="button"
                suppressHydrationWarning
                onClick={clearFilters}
                className="text-sm font-semibold text-primary transition hover:text-[#ff8a73]"
              >
                Reset
              </button>
            )}
          </div>

          {/* Mobile filter drawer */}
          {mobileFiltersOpen && (
            <div className="mb-6 storefront-panel rounded-[2rem] p-6 lg:hidden">
              <FilterPanel />
              <div className="mt-6 flex gap-3">
                <Button
                  className="h-11 flex-1 rounded-2xl bg-primary text-primary-foreground hover:bg-[#ff8a73]"
                  onClick={() => setMobileFiltersOpen(false)}
                >
                  Show {filtered.length} result{filtered.length === 1 ? '' : 's'}
                </Button>
              </div>
            </div>
          )}

          <div className="grid gap-8 lg:grid-cols-[280px_minmax(0,1fr)]">
            {/* Desktop sidebar */}
            <aside className="storefront-panel sticky top-28 hidden h-fit rounded-[2rem] p-6 lg:block">
              <FilterPanel />
            </aside>

            <div>
              {/* Search Bar & View Controls */}
              <div className="storefront-panel mb-6 flex flex-col gap-4 rounded-[2rem] p-5 sm:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  {/* Interactive Search Bar Input */}
                  <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search fragrances by name, brand, scent notes..."
                      className="h-11 w-full rounded-2xl border border-border/70 bg-white/80 pl-11 pr-10 text-sm text-foreground shadow-xs transition placeholder:text-foreground/40 focus:border-primary/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary/20"
                      aria-label="Search fragrances"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-foreground/40 transition hover:bg-muted hover:text-foreground"
                        aria-label="Clear search query"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Sort Dropdown */}
                  <div className="relative shrink-0">
                    <select
                      value={sortBy}
                      suppressHydrationWarning
                      onChange={(event) => setSortBy(event.target.value)}
                      className="storefront-input h-11 w-full appearance-none pr-10 text-sm sm:min-w-56 sm:w-auto"
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

                {/* Search query status indicator & count */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/50 pt-3 text-xs text-foreground/60">
                  <p>
                    Showing <span className="font-semibold text-foreground">{filtered.length}</span> fragrance{filtered.length === 1 ? '' : 's'}
                    {searchQuery.trim() && (
                      <> for &ldquo;<span className="font-semibold text-primary">{searchQuery}</span>&rdquo;</>
                    )}
                  </p>
                  {searchQuery.trim() && (
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="font-semibold text-primary hover:underline"
                    >
                      Clear search
                    </button>
                  )}
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
                  <p className="text-2xl font-serif text-foreground">No fragrances matched your search</p>
                  <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-foreground/62">
                    {searchQuery.trim()
                      ? `We couldn't find any fragrances matching "${searchQuery}". Try searching for another scent note or reset your filters.`
                      : 'No perfumes available in this filter combination. Try resetting your filters to see more fragrances.'}
                  </p>
                  <Button
                    variant="outline"
                    className="mt-6 h-11 rounded-2xl border-border/70 bg-white/70 px-6"
                    onClick={clearFilters}
                  >
                    Reset All Filters
                  </Button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </StorefrontShell>
  )
}

export default function ShopPage() {
  return (
    <Suspense
      fallback={
        <StorefrontShell>
          <div className="flex min-h-[40vh] items-center justify-center">
            <Spinner className="h-6 w-6 text-primary" />
          </div>
        </StorefrontShell>
      }
    >
      <ShopContent />
    </Suspense>
  )
}
