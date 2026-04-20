'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ArrowRight,
  CheckCircle2,
  Clock3,
  Droplets,
  RotateCcw,
  Sparkles,
  WandSparkles,
} from 'lucide-react'
import { StorefrontShell } from '@/components/storefront-shell'
import { Button } from '@/components/ui/button'
import { formatPHP } from '@/lib/currency'
import type { Product } from '@/lib/products'
import { type InventoryAvailability, useStore } from '@/lib/store-context'

type DiscoveryPreferences = {
  occasion: string | null
  scentFamily: string | null
  season: string | null
  gender: Product['gender'] | null
  intensity: 'soft' | 'balanced' | 'bold' | null
}

type DiscoveryRecommendation = {
  product: Product
  availableStock: number
  availability: InventoryAvailability
  score: number
  reasons: string[]
}

type FilterButtonProps = {
  active: boolean
  label: string
  onClick: () => void
}

type ProductVisualProps = {
  product: Product
  priority?: boolean
  className?: string
}

type MatchRowProps = {
  item: DiscoveryRecommendation
}

const DEFAULT_PREFERENCES: DiscoveryPreferences = {
  occasion: null,
  scentFamily: null,
  season: null,
  gender: null,
  intensity: null,
}

const occasionOptions = [
  { key: 'work', label: 'Work Day', matches: ['Work', 'Day'] },
  { key: 'everyday', label: 'Everyday', matches: ['Casual', 'Day', 'Versatile'] },
  { key: 'evening', label: 'Evening Out', matches: ['Evening', 'Formal Dinners'] },
  { key: 'date-night', label: 'Date Night', matches: ['Date Night', 'Romantic'] },
  { key: 'event', label: 'Special Event', matches: ['Special Events', 'Formal Dinners'] },
]

const scentOptions = [
  'Floral',
  'Fresh',
  'Citrus',
  'Woody',
  'Spicy',
  'Amber',
  'Aquatic',
  'Oriental',
  'Aromatic',
]

const seasonOptions = ['Spring', 'Summer', 'Fall', 'Winter', 'All Seasons']

const genderOptions: Array<{ value: Product['gender']; label: string }> = [
  { value: 'female', label: 'Feminine' },
  { value: 'male', label: 'Masculine' },
  { value: 'unisex', label: 'Unisex' },
]

const intensityOptions = [
  { key: 'soft', label: 'Soft Glow', target: 2, caption: 'Light and airy presence' },
  { key: 'balanced', label: 'Balanced', target: 3, caption: 'Polished all-day profile' },
  { key: 'bold', label: 'Bold Statement', target: 5, caption: 'Rich and expressive trail' },
] as const

function matchesOccasion(product: Product, selectedOccasion: string | null) {
  if (!selectedOccasion) {
    return false
  }

  const option = occasionOptions.find((item) => item.key === selectedOccasion)
  if (!option) {
    return false
  }

  return option.matches.some((match) =>
    product.occasions.some((occasion) => occasion.toLowerCase().includes(match.toLowerCase())),
  )
}

function getIntensityTarget(value: DiscoveryPreferences['intensity']) {
  return intensityOptions.find((option) => option.key === value)?.target ?? null
}

function getAvailabilityTone(availability: InventoryAvailability) {
  if (availability === 'In Stock') {
    return 'bg-emerald-100 text-emerald-700'
  }

  if (availability === 'Low Stock') {
    return 'bg-amber-100 text-amber-700'
  }

  return 'bg-rose-100 text-rose-700'
}

function buildRecommendations(
  products: Product[],
  preferences: DiscoveryPreferences,
  getAvailableStock: (productId: string) => number,
  getAvailabilityStatus: (productId: string) => InventoryAvailability,
) {
  const intensityTarget = getIntensityTarget(preferences.intensity)

  return products
    .map<DiscoveryRecommendation>((product) => {
      let score = product.featured ? 2 : 0
      score += product.isNewArrival ? 1 : 0
      score += Math.round(product.rating)

      const reasons: string[] = []
      const availability = getAvailabilityStatus(product.id)
      const availableStock = getAvailableStock(product.id)

      if (matchesOccasion(product, preferences.occasion)) {
        score += 5
        reasons.push('Aligned with your occasion')
      }

      if (
        preferences.scentFamily &&
        product.scentFamily.some((family) => family === preferences.scentFamily)
      ) {
        score += 4
        reasons.push(`${preferences.scentFamily} scent profile`)
      }

      if (preferences.season) {
        if (product.seasons.includes(preferences.season)) {
          score += 4
          reasons.push(`Strong fit for ${preferences.season}`)
        } else if (product.seasons.includes('All Seasons')) {
          score += 2
          reasons.push('Flexible year-round wear')
        }
      }

      if (preferences.gender) {
        if (product.gender === preferences.gender) {
          score += 3
          reasons.push('Matches your style direction')
        } else if (product.gender === 'unisex') {
          score += 1
          reasons.push('Versatile unisex option')
        }
      }

      if (intensityTarget !== null) {
        const difference = Math.abs(product.intensity - intensityTarget)
        const intensityScore = Math.max(0, 3 - difference)

        if (intensityScore > 0) {
          score += intensityScore
          reasons.push('Close to your preferred intensity')
        }
      }

      if (availableStock > 0) {
        score += 1
      }

      if (reasons.length === 0) {
        reasons.push(product.featured ? 'Signature bestseller' : 'Well-rounded store pick')
      }

      return {
        product,
        availableStock,
        availability,
        score,
        reasons,
      }
    })
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score
      }

      if (right.product.rating !== left.product.rating) {
        return right.product.rating - left.product.rating
      }

      return right.availableStock - left.availableStock
    })
}

function FilterButton({ active, label, onClick }: FilterButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full border px-4 py-2 text-sm transition-colors ${
        active
          ? 'border-foreground bg-foreground text-background'
          : 'border-border bg-background text-foreground/72 hover:border-foreground/20 hover:bg-muted'
      }`}
    >
      {label}
    </button>
  )
}

function ProductVisual({ product, priority = false, className = '' }: ProductVisualProps) {
  const [imageFailed, setImageFailed] = useState(false)

  if (imageFailed) {
    return (
      <div
        className={`relative overflow-hidden rounded-[1.75rem] bg-[linear-gradient(160deg,rgba(246,236,231,1),rgba(233,220,214,1))] ${className}`}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.48),transparent_32%)]" />
        <div className="relative flex h-full flex-col justify-between p-6">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-foreground/45">{product.brand}</p>
            <p className="mt-4 font-serif text-3xl leading-tight text-foreground">{product.name}</p>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {product.scentFamily.slice(0, 2).map((family) => (
                <span
                  key={family}
                  className="rounded-full border border-white/70 bg-white/70 px-3 py-1 text-xs font-medium text-foreground/70"
                >
                  {family}
                </span>
              ))}
            </div>
            <p className="max-w-xs text-sm text-foreground/62">
              {product.topNotes.slice(0, 2).join(', ')} with a smooth {product.baseNotes[0]?.toLowerCase() || 'signature'} base.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-[1.75rem] bg-muted ${className}`}>
      <Image
        src={product.images[0]}
        alt={product.name}
        fill
        priority={priority}
        sizes="(min-width: 1024px) 32vw, 100vw"
        className="object-cover"
        onError={() => setImageFailed(true)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/18 via-transparent to-transparent" />
    </div>
  )
}

function MatchRow({ item }: MatchRowProps) {
  return (
    <article className="grid gap-5 rounded-[1.75rem] border border-border bg-card p-5 shadow-[0_14px_35px_rgba(35,24,18,0.05)] lg:grid-cols-[220px_minmax(0,1fr)_auto]">
      <ProductVisual product={item.product} className="min-h-[220px]" />

      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getAvailabilityTone(item.availability)}`}>
            {item.availability}
          </span>
          <span className="rounded-full bg-muted px-3 py-1 text-xs font-semibold text-foreground/62">
            Match score {item.score}
          </span>
        </div>

        <div>
          <p className="text-xs uppercase tracking-[0.24em] text-foreground/42">{item.product.brand}</p>
          <h3 className="mt-2 font-serif text-3xl text-foreground">{item.product.name}</h3>
          <p className="mt-3 max-w-2xl text-foreground/68">{item.product.description}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          {item.reasons.slice(0, 3).map((reason) => (
            <span
              key={reason}
              className="rounded-full border border-border bg-background px-3 py-2 text-xs font-medium text-foreground/68"
            >
              {reason}
            </span>
          ))}
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-muted/55 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/42">Price</p>
            <p className="mt-2 text-xl font-serif text-foreground">{formatPHP(item.product.price)}</p>
          </div>
          <div className="rounded-2xl bg-muted/55 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/42">Availability</p>
            <p className="mt-2 text-xl font-serif text-foreground">{item.availableStock}</p>
            <p className="text-sm text-foreground/62">units live</p>
          </div>
          <div className="rounded-2xl bg-muted/55 p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-foreground/42">Scent Family</p>
            <p className="mt-2 text-base font-medium text-foreground">
              {item.product.scentFamily.slice(0, 2).join(', ')}
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 lg:items-end">
        <Button asChild>
          <Link href={`/products/${item.product.id}`}>
            View Product
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
        <Button variant="outline" asChild>
          <Link href="/shop">Browse More</Link>
        </Button>
      </div>
    </article>
  )
}

export default function DiscoveryPage() {
  const { catalog, getAvailabilityStatus, getAvailableStock, getInventoryRecord } = useStore()
  const [preferences, setPreferences] = useState<DiscoveryPreferences>(DEFAULT_PREFERENCES)

  const activeCatalog = useMemo(
    () => catalog.filter((product) => !getInventoryRecord(product.id)?.isArchived),
    [catalog, getInventoryRecord],
  )

  const recommendations = useMemo(
    () =>
      buildRecommendations(
        activeCatalog,
        preferences,
        getAvailableStock,
        getAvailabilityStatus,
      ),
    [activeCatalog, preferences, getAvailableStock, getAvailabilityStatus],
  )

  const topMatch = recommendations[0]
  const additionalMatches = recommendations.slice(1, 5)
  const activeSelections = [
    preferences.occasion
      ? occasionOptions.find((option) => option.key === preferences.occasion)?.label
      : null,
    preferences.scentFamily,
    preferences.season,
    preferences.gender
      ? genderOptions.find((option) => option.value === preferences.gender)?.label
      : null,
    preferences.intensity
      ? intensityOptions.find((option) => option.key === preferences.intensity)?.label
      : null,
  ].filter((value): value is string => Boolean(value))

  const setOption = <K extends keyof DiscoveryPreferences>(
    key: K,
    value: DiscoveryPreferences[K],
  ) => {
    setPreferences((current) => ({
      ...current,
      [key]: current[key] === value ? null : value,
    }))
  }

  return (
    <StorefrontShell>
      <>
        <section className="border-b border-border bg-[radial-gradient(circle_at_top_left,rgba(247,236,230,0.9),transparent_34%),linear-gradient(180deg,rgba(251,248,245,0.98),rgba(249,246,243,0.95))]">
          <div className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8 lg:py-20">
            <div className="space-y-8">
              <div className="space-y-5">
                <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-4 py-2 text-xs font-semibold uppercase tracking-[0.24em] text-foreground/62">
                  <WandSparkles className="h-4 w-4 text-accent" />
                  Discovery Atelier
                </span>
                <h1 className="max-w-3xl font-serif text-5xl leading-[1.05] text-foreground sm:text-6xl">
                  A more refined way to discover your next signature scent.
                </h1>
                <p className="max-w-2xl text-lg leading-8 text-foreground/68">
                  Explore curated fragrance recommendations shaped by occasion, scent family, season, style, and intensity, with live stock and product availability built into every result.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <Button size="lg" asChild>
                  <Link href="#results">
                    Explore Matches
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" onClick={() => setPreferences(DEFAULT_PREFERENCES)}>
                  <RotateCcw className="h-4 w-4" />
                  Reset Selections
                </Button>
              </div>

              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[0_14px_35px_rgba(35,24,18,0.04)]">
                  <Sparkles className="h-5 w-5 text-accent" />
                  <p className="mt-4 text-xs uppercase tracking-[0.22em] text-foreground/42">Curated</p>
                  <p className="mt-2 text-lg font-medium text-foreground">Designed for luxury fragrance browsing.</p>
                </div>
                <div className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[0_14px_35px_rgba(35,24,18,0.04)]">
                  <CheckCircle2 className="h-5 w-5 text-accent" />
                  <p className="mt-4 text-xs uppercase tracking-[0.22em] text-foreground/42">Availability Aware</p>
                  <p className="mt-2 text-lg font-medium text-foreground">Recommendations respect current inventory levels.</p>
                </div>
                <div className="rounded-[1.75rem] border border-border bg-card p-5 shadow-[0_14px_35px_rgba(35,24,18,0.04)]">
                  <ArrowRight className="h-5 w-5 text-accent" />
                  <p className="mt-4 text-xs uppercase tracking-[0.22em] text-foreground/42">Ready To Shop</p>
                  <p className="mt-2 text-lg font-medium text-foreground">Move directly from discovery into product detail and checkout.</p>
                </div>
              </div>
            </div>

            <aside className="rounded-[2rem] border border-border bg-card p-7 shadow-[0_20px_55px_rgba(35,24,18,0.06)]">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-foreground/42">Current Profile</p>
                  <h2 className="mt-2 font-serif text-3xl text-foreground">Personalized Direction</h2>
                </div>
                <div className="rounded-full bg-muted px-4 py-2 text-sm font-medium text-foreground/72">
                  {activeSelections.length > 0 ? `${activeSelections.length} active` : 'General'}
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-2">
                {activeSelections.length > 0 ? (
                  activeSelections.map((selection) => (
                    <span
                      key={selection}
                      className="rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-foreground/68"
                    >
                      {selection}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full border border-dashed border-border px-4 py-2 text-sm text-foreground/58">
                    Start with the filters below for a sharper recommendation.
                  </span>
                )}
              </div>

              {topMatch && (
                <div className="mt-8 grid gap-5 rounded-[1.75rem] border border-border bg-background p-5 sm:grid-cols-[210px_minmax(0,1fr)]">
                  <ProductVisual product={topMatch.product} priority className="min-h-[280px]" />

                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-background">
                        Leading Match
                      </span>
                      <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getAvailabilityTone(topMatch.availability)}`}>
                        {topMatch.availability}
                      </span>
                    </div>

                    <div>
                      <p className="text-xs uppercase tracking-[0.24em] text-foreground/42">{topMatch.product.brand}</p>
                      <h3 className="mt-2 font-serif text-4xl text-foreground">{topMatch.product.name}</h3>
                      <p className="mt-3 text-foreground/68">{topMatch.product.description}</p>
                    </div>

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div className="rounded-2xl bg-card p-4 shadow-[0_12px_24px_rgba(35,24,18,0.04)]">
                        <p className="text-xs uppercase tracking-[0.2em] text-foreground/42">Price</p>
                        <p className="mt-2 text-2xl font-serif text-foreground">{formatPHP(topMatch.product.price)}</p>
                      </div>
                      <div className="rounded-2xl bg-card p-4 shadow-[0_12px_24px_rgba(35,24,18,0.04)]">
                        <p className="text-xs uppercase tracking-[0.2em] text-foreground/42">Stock</p>
                        <p className="mt-2 text-2xl font-serif text-foreground">{topMatch.availableStock}</p>
                        <p className="text-sm text-foreground/58">available now</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {topMatch.reasons.slice(0, 3).map((reason) => (
                        <span
                          key={reason}
                          className="rounded-full border border-border bg-card px-3 py-2 text-xs font-medium text-foreground/66"
                        >
                          {reason}
                        </span>
                      ))}
                    </div>

                    <Button asChild>
                      <Link href={`/products/${topMatch.product.id}`}>
                        View Top Recommendation
                        <ArrowRight className="h-4 w-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              )}
            </aside>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 py-16 sm:px-6 lg:px-8" id="results">
          <div className="grid gap-10 xl:grid-cols-[340px_minmax(0,1fr)]">
            <aside className="rounded-[2rem] border border-border bg-card p-7 shadow-[0_20px_55px_rgba(35,24,18,0.05)] xl:sticky xl:top-24 xl:self-start">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-foreground/42">Discovery Filters</p>
                  <h2 className="mt-2 font-serif text-3xl text-foreground">Refine Your Taste</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setPreferences(DEFAULT_PREFERENCES)}
                  className="text-sm font-medium text-foreground/58 hover:text-foreground"
                >
                  Clear
                </button>
              </div>

              <div className="mt-8 space-y-7">
                <div>
                  <p className="mb-3 text-sm font-medium text-foreground">Occasion</p>
                  <div className="flex flex-wrap gap-2">
                    {occasionOptions.map((option) => (
                      <FilterButton
                        key={option.key}
                        active={preferences.occasion === option.key}
                        label={option.label}
                        onClick={() => setOption('occasion', option.key)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium text-foreground">Scent Family</p>
                  <div className="flex flex-wrap gap-2">
                    {scentOptions.map((option) => (
                      <FilterButton
                        key={option}
                        active={preferences.scentFamily === option}
                        label={option}
                        onClick={() => setOption('scentFamily', option)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium text-foreground">Season</p>
                  <div className="flex flex-wrap gap-2">
                    {seasonOptions.map((option) => (
                      <FilterButton
                        key={option}
                        active={preferences.season === option}
                        label={option}
                        onClick={() => setOption('season', option)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium text-foreground">Style Direction</p>
                  <div className="flex flex-wrap gap-2">
                    {genderOptions.map((option) => (
                      <FilterButton
                        key={option.value}
                        active={preferences.gender === option.value}
                        label={option.label}
                        onClick={() => setOption('gender', option.value)}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="mb-3 text-sm font-medium text-foreground">Intensity</p>
                  <div className="grid gap-3">
                    {intensityOptions.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        onClick={() => setOption('intensity', option.key)}
                        className={`rounded-[1.4rem] border px-4 py-4 text-left transition-colors ${
                          preferences.intensity === option.key
                            ? 'border-foreground bg-muted'
                            : 'border-border bg-background hover:border-foreground/20 hover:bg-muted/60'
                        }`}
                      >
                        <p className="font-medium text-foreground">{option.label}</p>
                        <p className="mt-1 text-sm text-foreground/58">{option.caption}</p>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </aside>

            <div className="space-y-8">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-foreground/42">Recommended Results</p>
                  <h2 className="mt-2 font-serif text-4xl text-foreground">Professional Fragrance Matches</h2>
                  <p className="mt-3 max-w-2xl text-foreground/68">
                    Each recommendation blends your selections with live availability, current ratings, and overall wear versatility.
                  </p>
                </div>
                <div className="rounded-full border border-border bg-card px-4 py-2 text-sm font-medium text-foreground/68">
                  {recommendations.length} curated result(s)
                </div>
              </div>

              {topMatch && (
                <article className="rounded-[2rem] border border-border bg-card p-6 shadow-[0_20px_55px_rgba(35,24,18,0.05)]">
                  <div className="grid gap-6 lg:grid-cols-[320px_minmax(0,1fr)]">
                    <ProductVisual product={topMatch.product} className="min-h-[390px]" />

                    <div className="space-y-6">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-foreground px-3 py-1 text-xs font-semibold uppercase tracking-[0.16em] text-background">
                          Best Match
                        </span>
                        <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getAvailabilityTone(topMatch.availability)}`}>
                          {topMatch.availability}
                        </span>
                      </div>

                      <div>
                        <p className="text-xs uppercase tracking-[0.24em] text-foreground/42">{topMatch.product.brand}</p>
                        <h3 className="mt-2 font-serif text-5xl leading-tight text-foreground">{topMatch.product.name}</h3>
                        <p className="mt-4 max-w-2xl text-lg leading-8 text-foreground/68">
                          {topMatch.product.description}
                        </p>
                      </div>

                      <div className="grid gap-4 sm:grid-cols-4">
                        <div className="rounded-[1.5rem] bg-muted/55 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-foreground/42">Price</p>
                          <p className="mt-2 text-2xl font-serif text-foreground">{formatPHP(topMatch.product.price)}</p>
                        </div>
                        <div className="rounded-[1.5rem] bg-muted/55 p-4">
                          <p className="text-xs uppercase tracking-[0.18em] text-foreground/42">Live Stock</p>
                          <p className="mt-2 text-2xl font-serif text-foreground">{topMatch.availableStock}</p>
                          <p className="text-sm text-foreground/58">units available</p>
                        </div>
                        <div className="rounded-[1.5rem] bg-muted/55 p-4">
                          <div className="flex items-center gap-2 text-accent">
                            <Droplets className="h-4 w-4" />
                            <p className="text-xs uppercase tracking-[0.18em] text-foreground/42">Top Notes</p>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-foreground/66">
                            {topMatch.product.topNotes.slice(0, 2).join(', ')}
                          </p>
                        </div>
                        <div className="rounded-[1.5rem] bg-muted/55 p-4">
                          <div className="flex items-center gap-2 text-accent">
                            <Clock3 className="h-4 w-4" />
                            <p className="text-xs uppercase tracking-[0.18em] text-foreground/42">Longevity</p>
                          </div>
                          <p className="mt-3 text-sm leading-6 text-foreground/66">
                            {topMatch.product.longevity}/10 wear time
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {topMatch.reasons.slice(0, 4).map((reason) => (
                          <span
                            key={reason}
                            className="rounded-full border border-border bg-background px-3 py-2 text-sm font-medium text-foreground/66"
                          >
                            {reason}
                          </span>
                        ))}
                      </div>

                      <div className="flex flex-wrap gap-3">
                        <Button asChild>
                          <Link href={`/products/${topMatch.product.id}`}>
                            Shop This Recommendation
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </Button>
                        <Button variant="outline" asChild>
                          <Link href="/shop">Browse Full Shop</Link>
                        </Button>
                      </div>
                    </div>
                  </div>
                </article>
              )}

              <div className="space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <h3 className="font-serif text-3xl text-foreground">Additional Matches</h3>
                  <Link href="/shop" className="text-sm font-medium text-accent hover:underline">
                    View full catalog
                  </Link>
                </div>

                {additionalMatches.map((item) => (
                  <MatchRow key={item.product.id} item={item} />
                ))}
              </div>
            </div>
          </div>
        </section>
      </>
    </StorefrontShell>
  )
}
