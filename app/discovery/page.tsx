'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useMemo, useState } from 'react'
import {
  ArrowLeft,
  Briefcase,
  Check,
  CloudRain,
  Compass,
  Crown,
  Eye,
  Flame,
  Flower2,
  Gift,
  Heart,
  Moon,
  RotateCcw,
  RotateCw,
  Scale,
  ShoppingBag,
  Sparkles,
  Sun,
  SunMedium,
  Trees,
  Waves,
  Wind,
} from 'lucide-react'
import { StorefrontShell } from '@/components/storefront-shell'
import { Button } from '@/components/ui/button'
import { formatPHP } from '@/lib/currency'
import type { Product } from '@/lib/products'
import { type InventoryAvailability, useStore } from '@/lib/store-context'

// ── Types ────────────────────────────────────────────────────────────

type DiscoveryPreferences = {
  gender: Product['gender'] | 'gift' | null
  occasion: string | null
  scentFamily: string | null
  intensity: 'soft' | 'balanced' | 'bold' | null
  season: string | null
}

type DiscoveryRecommendation = {
  product: Product
  availableStock: number
  availability: InventoryAvailability
  score: number
  matchPercentage: number
  reasons: string[]
}

const DEFAULT_PREFERENCES: DiscoveryPreferences = {
  gender: null,
  occasion: null,
  scentFamily: null,
  intensity: null,
  season: null,
}

// ── Quiz Question Data ──────────────────────────────────────────────

const QUESTIONS = [
  {
    step: 1,
    id: 'gender',
    title: 'Who are you finding a scent for?',
    subtitle: 'Select the style profile or recipient that matches your intent.',
    options: [
      {
        value: 'female',
        icon: Flower2,
        label: 'For Her',
        desc: 'Graceful, elegant florals and luminous warmth',
      },
      {
        value: 'male',
        icon: Trees,
        label: 'For Him',
        desc: 'Crisp woods, rich spices and fresh aromatics',
      },
      {
        value: 'unisex',
        icon: Compass,
        label: 'Unisex / Shared',
        desc: 'Modern, genderless niche compositions',
      },
      {
        value: 'gift',
        icon: Gift,
        label: 'A Special Gift',
        desc: 'Universally loved crowd-pleasers with broad appeal',
      },
    ],
  },
  {
    step: 2,
    id: 'occasion',
    title: 'Where will this fragrance be worn most?',
    subtitle: 'Different environments call for tailored projection and presence.',
    options: [
      {
        value: 'everyday',
        icon: Sun,
        label: 'Everyday & Casual',
        desc: 'Approachable, fresh, uplifting daily ritual',
      },
      {
        value: 'work',
        icon: Briefcase,
        label: 'Office & Professional',
        desc: 'Polished, clean, subtle, and composed',
      },
      {
        value: 'date-night',
        icon: Moon,
        label: 'Date Night & Romance',
        desc: 'Intimate, magnetic, sensual, and memorable',
      },
      {
        value: 'evening',
        icon: Crown,
        label: 'Evening Out & Events',
        desc: 'Bold, glamorous, luxurious statement sillage',
      },
    ],
  },
  {
    step: 3,
    id: 'scentFamily',
    title: 'Which olfactory notes speak to your heart?',
    subtitle: 'Pick the aromatic family you naturally gravitate toward.',
    options: [
      {
        value: 'Floral',
        icon: Flower2,
        label: 'Floral & Blooming',
        desc: 'Damask Rose, Jasmine, Orange Blossom, Peony',
      },
      {
        value: 'Woody',
        icon: Trees,
        label: 'Woody & Earthy',
        desc: 'Rich Sandalwood, Cedar, Vetiver, Precious Agarwood',
      },
      {
        value: 'Citrus',
        icon: SunMedium,
        label: 'Citrus & Vibrant',
        desc: 'Sun-drenched Bergamot, Mandarin, Italian Lemon',
      },
      {
        value: 'Fresh',
        icon: Waves,
        label: 'Fresh & Aquatic',
        desc: 'Marine Sea Salt, Mineral Air, Crisp Dew',
      },
      {
        value: 'Amber',
        icon: Flame,
        label: 'Warm Vanilla & Amber',
        desc: 'Madagascar Vanilla, Tonka Bean, Amber, Cinnamon',
      },
      {
        value: 'all',
        icon: Sparkles,
        label: 'Surprise Me',
        desc: 'Open to any extraordinary, handcrafted signature',
      },
    ],
  },
  {
    step: 4,
    id: 'intensity',
    title: 'How noticeable do you want your fragrance trail to be?',
    subtitle: 'Choose between an intimate skin scent or room-filling presence.',
    options: [
      {
        value: 'soft',
        icon: Wind,
        label: 'Soft & Intimate',
        desc: 'Whispers close to the skin, noticed upon embracing',
      },
      {
        value: 'balanced',
        icon: Scale,
        label: 'Balanced All-Day',
        desc: 'Classic projection within arm’s reach (6–8 hours)',
      },
      {
        value: 'bold',
        icon: Flame,
        label: 'Bold Statement',
        desc: 'Head-turning sillage with long-lasting trail',
      },
    ],
  },
  {
    step: 5,
    id: 'season',
    title: 'What climate or season fits your routine?',
    subtitle: 'Fragrance notes bloom differently in tropical warmth versus cool evenings.',
    options: [
      {
        value: 'Summer',
        icon: Sun,
        label: 'Warm & Tropical',
        desc: 'Cooling, refreshing scents that shine in the heat',
      },
      {
        value: 'Winter',
        icon: CloudRain,
        label: 'Cool & Cozy',
        desc: 'Rich, warming, enveloping comfort in evening air',
      },
      {
        value: 'All Seasons',
        icon: RotateCw,
        label: 'All-Year Versatile',
        desc: 'Adapts fluidly from sunny mornings to breezy evenings',
      },
    ],
  },
]

// ── Recommendation Algorithm ────────────────────────────────────────

function calculateRecommendations(
  catalog: Product[],
  preferences: DiscoveryPreferences,
  getAvailableStock: (id: string) => number,
  getAvailability: (id: string) => InventoryAvailability,
): DiscoveryRecommendation[] {
  return catalog
    .map((product) => {
      let score = product.featured ? 3 : 1
      score += Math.round(product.rating * 1.5)
      const reasons: string[] = []

      // Gender fit
      if (preferences.gender === 'gift') {
        score += product.featured ? 4 : 2
        reasons.push('Crowd-pleasing bestseller')
      } else if (preferences.gender) {
        if (product.gender === preferences.gender) {
          score += 5
          reasons.push(`Designed for ${preferences.gender === 'female' ? 'her' : preferences.gender === 'male' ? 'him' : 'everyone'}`)
        } else if (product.gender === 'unisex') {
          score += 4
          reasons.push('Unisex versatile blend')
        }
      }

      // Scent family fit
      if (preferences.scentFamily && preferences.scentFamily !== 'all') {
        const matchesFamily = product.scentFamily.some(
          (f) => f.toLowerCase() === preferences.scentFamily?.toLowerCase(),
        )
        if (matchesFamily) {
          score += 6
          reasons.push(`Key ${preferences.scentFamily} accords`)
        }
      } else if (preferences.scentFamily === 'all') {
        score += 3
        reasons.push('Distinctive atelier curation')
      }

      // Intensity fit
      if (preferences.intensity) {
        if (preferences.intensity === 'soft' && product.intensity <= 2) {
          score += 4
          reasons.push('Subtle skin scent')
        } else if (preferences.intensity === 'balanced' && product.intensity === 3) {
          score += 4
          reasons.push('Balanced daily sillage')
        } else if (preferences.intensity === 'bold' && product.intensity >= 4) {
          score += 5
          reasons.push('Deep enduring projection')
        }
      }

      // Season fit
      if (preferences.season && preferences.season !== 'All Seasons') {
        const matchesSeason = product.seasons?.some(
          (s) => s.toLowerCase() === preferences.season?.toLowerCase(),
        )
        if (matchesSeason) {
          score += 4
          reasons.push(`Optimized for ${preferences.season} wear`)
        }
      }

      const matchPercentage = Math.min(99, Math.max(76, Math.round((score / 24) * 100)))

      return {
        product,
        availableStock: getAvailableStock(product.id),
        availability: getAvailability(product.id),
        score,
        matchPercentage,
        reasons: reasons.slice(0, 3),
      }
    })
    .sort((a, b) => b.score - a.score)
}

function ProductThumbnail({ product, className }: { product: Product; className?: string }) {
  const [imageFailed, setImageFailed] = useState(false)

  if (imageFailed || !product.images?.[0]) {
    return (
      <div className={`relative flex items-center justify-center rounded-2xl bg-[#fff7f2] p-4 ${className}`}>
        <div className="text-center">
          <p className="text-xs text-foreground/45">{product.brand}</p>
          <p className="font-serif text-lg font-bold text-foreground mt-1">{product.name}</p>
          <p className="text-xs text-primary mt-1">{product.scentFamily[0]}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-white border border-border/60 ${className}`}>
      <Image
        src={product.images[0]}
        alt={product.name}
        fill
        sizes="(min-width: 768px) 30vw, 90vw"
        className="object-contain p-4 transition-transform duration-500 hover:scale-105"
        onError={() => setImageFailed(true)}
      />
    </div>
  )
}

// ── Main Page Component ──────────────────────────────────────────────

export default function DiscoveryQuizPage() {
  const { catalog, getAvailableStock, getAvailabilityStatus, addToCart } = useStore()

  // Quiz State
  const [step, setStep] = useState<number>(1)
  const [preferences, setPreferences] = useState<DiscoveryPreferences>(DEFAULT_PREFERENCES)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)

  // Feedback states
  const [addingId, setAddingId] = useState<string | null>(null)
  const [addedIds, setAddedIds] = useState<Record<string, boolean>>({})

  // Recommendations
  const recommendations = useMemo(() => {
    return calculateRecommendations(catalog, preferences, getAvailableStock, getAvailabilityStatus)
  }, [catalog, preferences, getAvailableStock, getAvailabilityStatus])

  const topMatch = recommendations[0]
  const runnerUps = recommendations.slice(1, 3)

  // Current question
  const currentQuestion = QUESTIONS[step - 1]

  // Handle Option Selection
  const handleSelectOption = (field: keyof DiscoveryPreferences, value: any) => {
    const updated = { ...preferences, [field]: value }
    setPreferences(updated)

    if (step < 5) {
      setStep((prev) => prev + 1)
      window.scrollTo({ top: 120, behavior: 'smooth' })
    } else {
      setIsAnalyzing(true)
      window.scrollTo({ top: 80, behavior: 'smooth' })
      setTimeout(() => {
        setIsAnalyzing(false)
        setIsCompleted(true)
      }, 900)
    }
  }

  // Handle Quick Add to Cart
  const handleAddToCart = async (product: Product) => {
    setAddingId(product.id)
    try {
      await addToCart({
        productId: product.id,
        size: product.sizes[0]?.ml ?? 50,
        quantity: 1,
        unitPrice: product.price,
      })
      setAddedIds((prev) => ({ ...prev, [product.id]: true }))
      setTimeout(() => {
        setAddedIds((prev) => ({ ...prev, [product.id]: false }))
      }, 3000)
    } finally {
      setAddingId(null)
    }
  }

  // Retake Quiz
  const handleRetake = () => {
    setPreferences(DEFAULT_PREFERENCES)
    setStep(1)
    setIsCompleted(false)
    setIsAnalyzing(false)
    window.scrollTo({ top: 100, behavior: 'smooth' })
  }

  return (
    <StorefrontShell>
      <div className="min-h-[100dvh] px-4 pb-24 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          {/* Header Banner */}
          <div className="rounded-3xl border border-border/80 bg-[#fffdfa] p-8 sm:p-12 text-center">
            <span className="inline-block rounded-full bg-primary/10 text-primary text-xs font-semibold px-3.5 py-1 mb-4">
              Personalized Olfactory Consultation
            </span>

            <h1 className="font-serif text-3xl sm:text-5xl text-foreground">
              Find Your Signature Scent
            </h1>
            <p className="mx-auto mt-4 max-w-xl text-base text-foreground/70 leading-relaxed">
              Answer 5 intuitive questions. Our fragrance engine matches note pyramids, sillage, and occasions to recommend your ideal bottle.
            </p>

            {/* Stepper Progress Bar */}
            {!isCompleted && !isAnalyzing && (
              <div className="mx-auto mt-8 max-w-md">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground/60">
                  <span>Question {step} of 5</span>
                  <span>{step * 20}%</span>
                </div>
                <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border/60">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
                    style={{ width: `${step * 20}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* State 1: Analyzing Loading Screen */}
          {isAnalyzing && (
            <div className="my-20 flex flex-col items-center justify-center text-center">
              <div className="flex h-20 w-20 items-center justify-center rounded-3xl border border-border/80 bg-white">
                <Sparkles className="h-8 w-8 text-primary animate-spin" />
              </div>
              <h2 className="mt-6 font-serif text-2xl text-foreground sm:text-3xl">
                Harmonizing Notes &amp; Sillage...
              </h2>
              <p className="mt-2 text-sm text-foreground/60 max-w-md">
                Analyzing top, heart, and base notes against our atelier catalogue.
              </p>
            </div>
          )}

          {/* State 2: Step-by-Step Questionnaire */}
          {!isCompleted && !isAnalyzing && currentQuestion && (
            <div className="mt-10">
              {/* Question Header & Navigation */}
              <div className="flex items-center justify-between gap-4 mb-6">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((prev) => prev - 1)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-white px-3.5 py-2 text-xs font-semibold text-foreground transition hover:border-primary cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back</span>
                  </button>
                ) : (
                  <div />
                )}

                <span className="text-xs font-semibold text-primary">
                  Step {step} of 5
                </span>

                <button
                  type="button"
                  onClick={handleRetake}
                  className="text-xs font-medium text-foreground/50 hover:text-foreground underline cursor-pointer"
                >
                  Reset
                </button>
              </div>

              <div className="text-center mb-8">
                <h2 className="font-serif text-2xl sm:text-3xl text-foreground">
                  {currentQuestion.title}
                </h2>
                <p className="mt-2 text-sm text-foreground/60">
                  {currentQuestion.subtitle}
                </p>
              </div>

              {/* Options Cards Grid */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {currentQuestion.options.map((opt) => {
                  const Icon = opt.icon
                  const isSelected =
                    preferences[currentQuestion.id as keyof DiscoveryPreferences] === opt.value

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        handleSelectOption(currentQuestion.id as keyof DiscoveryPreferences, opt.value)
                      }
                      className={`group flex items-start gap-4 rounded-2xl border p-5 text-left transition-[border-color,background-color] duration-150 cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-[#fffbf8]'
                          : 'border-border/80 bg-white hover:border-primary/60'
                      }`}
                    >
                      <div
                        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition ${
                          isSelected ? 'bg-primary text-primary-foreground' : 'bg-[#fff5ee] text-primary'
                        }`}
                      >
                        <Icon className="h-5 w-5" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-foreground sm:text-base">
                            {opt.label}
                          </p>
                          {isSelected && (
                            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-2.5 w-2.5" />
                            </span>
                          )}
                        </div>
                        <p className="mt-1 text-xs text-foreground/60 sm:text-sm leading-relaxed">
                          {opt.desc}
                        </p>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* State 3: Celebratory Match Result */}
          {isCompleted && topMatch && (
            <div className="mt-10 space-y-10">
              {/* Match Result Banner */}
              <div className="flex flex-col items-center justify-between gap-4 rounded-3xl border border-border/80 bg-[#fffdfa] p-6 sm:p-8 sm:flex-row">
                <div className="flex items-center gap-4 text-center sm:text-left">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-semibold text-primary-foreground">
                      {topMatch.matchPercentage}% Scent Affinity Match
                    </span>
                    <h2 className="mt-2 font-serif text-2xl text-foreground sm:text-3xl">
                      Your Signature Match Is Ready
                    </h2>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetake}
                  className="rounded-xl border-border/80 bg-white text-xs font-semibold hover:border-primary"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Retake Quiz
                </Button>
              </div>

              {/* Leading Fragrance Card */}
              <div className="overflow-hidden rounded-3xl border border-border/80 bg-white">
                <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[300px_minmax(0,1fr)]">
                  {/* Left: Fragrance Image */}
                  <div className="relative">
                    <ProductThumbnail
                      product={topMatch.product}
                      className="h-[300px] sm:h-full min-h-[280px] w-full"
                    />
                  </div>

                  {/* Right: Fragrance Details */}
                  <div className="flex flex-col justify-between space-y-6">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs text-foreground/50">
                          {topMatch.product.brand} · {topMatch.product.category}
                        </p>
                        <span className="text-xs text-primary font-medium">
                          {topMatch.availability}
                        </span>
                      </div>

                      <h3 className="mt-2 font-serif text-3xl text-foreground sm:text-4xl">
                        {topMatch.product.name}
                      </h3>

                      <p className="mt-3 text-sm text-foreground/70 leading-relaxed sm:text-base">
                        {topMatch.product.description}
                      </p>

                      {/* Reasons why it matches */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {topMatch.reasons.map((reason) => (
                          <span
                            key={reason}
                            className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-[#fffaf5] px-3 py-1 text-xs font-medium text-foreground/80"
                          >
                            <Check className="h-3 w-3 text-primary" />
                            {reason}
                          </span>
                        ))}
                      </div>

                      {/* Scent Pyramid Breakdown */}
                      <div className="mt-6 rounded-2xl border border-border/60 bg-[#fffdfa] p-5">
                        <p className="text-xs font-semibold text-foreground/70 mb-3">
                          Olfactive Note Pyramid
                        </p>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="rounded-xl bg-white p-3 border border-border/60">
                            <span className="text-xs font-semibold text-primary block">
                              Top Notes
                            </span>
                            <p className="mt-1 text-xs text-foreground">
                              {topMatch.product.topNotes.slice(0, 3).join(', ')}
                            </p>
                          </div>
                          <div className="rounded-xl bg-white p-3 border border-border/60">
                            <span className="text-xs font-semibold text-primary block">
                              Heart Notes
                            </span>
                            <p className="mt-1 text-xs text-foreground">
                              {topMatch.product.middleNotes.slice(0, 3).join(', ')}
                            </p>
                          </div>
                          <div className="rounded-xl bg-white p-3 border border-border/60">
                            <span className="text-xs font-semibold text-primary block">
                              Base Notes
                            </span>
                            <p className="mt-1 text-xs text-foreground">
                              {topMatch.product.baseNotes.slice(0, 3).join(', ')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Price & Action Buttons */}
                    <div className="pt-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs text-foreground/50">Price (VAT-Inclusive)</p>
                          <p className="font-serif text-3xl font-bold text-foreground">
                            {formatPHP(topMatch.product.price)}
                          </p>
                        </div>

                        <div className="flex items-center gap-3">
                          <Button
                            size="lg"
                            onClick={() => handleAddToCart(topMatch.product)}
                            disabled={topMatch.availableStock <= 0 || addingId === topMatch.product.id}
                            className="h-12 flex-1 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-[#ff8a73] sm:flex-none cursor-pointer"
                          >
                            {addedIds[topMatch.product.id] ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Added to Bag
                              </>
                            ) : addingId === topMatch.product.id ? (
                              'Adding...'
                            ) : (
                              <>
                                <ShoppingBag className="mr-2 h-4 w-4" />
                                Add to Bag
                              </>
                            )}
                          </Button>

                          <Button
                            asChild
                            variant="outline"
                            size="lg"
                            className="h-12 rounded-xl border-border bg-white px-5 text-sm font-semibold text-foreground hover:border-primary"
                          >
                            <Link href={`/products/${topMatch.product.id}`}>
                              <Eye className="mr-2 h-4 w-4 text-foreground/60" />
                              View Details
                            </Link>
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Runner-up Alternatives */}
              {runnerUps.length > 0 && (
                <div>
                  <h3 className="font-serif text-2xl text-foreground mb-4">
                    Alternative Facets You May Enjoy
                  </h3>

                  <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                    {runnerUps.map((runner) => (
                      <div
                        key={runner.product.id}
                        className="flex flex-col justify-between rounded-3xl border border-border/80 bg-white p-6"
                      >
                        <div className="flex gap-4">
                          <ProductThumbnail
                            product={runner.product}
                            className="h-28 w-24 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
                              {runner.matchPercentage}% Match
                            </span>

                            <h4 className="font-serif text-xl text-foreground mt-2 truncate">
                              {runner.product.name}
                            </h4>

                            <p className="mt-1 text-xs text-foreground/60 line-clamp-1">
                              {runner.product.scentFamily.join(' · ')}
                            </p>

                            <p className="mt-2 font-serif text-lg font-bold text-foreground">
                              {formatPHP(runner.product.price)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2 pt-4">
                          <Button
                            size="sm"
                            onClick={() => handleAddToCart(runner.product)}
                            disabled={runner.availableStock <= 0 || addingId === runner.product.id}
                            className="h-10 flex-1 rounded-xl bg-primary text-xs font-semibold text-primary-foreground hover:bg-[#ff8a73]"
                          >
                            {addedIds[runner.product.id] ? (
                              <>
                                <Check className="mr-1.5 h-3.5 w-3.5" />
                                Added
                              </>
                            ) : (
                              <>
                                <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
                                Add to Bag
                              </>
                            )}
                          </Button>
                          <Button
                            asChild
                            variant="outline"
                            size="sm"
                            className="h-10 rounded-xl border-border text-xs font-semibold"
                          >
                            <Link href={`/products/${runner.product.id}`}>
                              View
                            </Link>
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </StorefrontShell>
  )
}
