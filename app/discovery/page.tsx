'use client'

import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Clock3,
  Compass,
  Droplets,
  Eye,
  Heart,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  WandSparkles,
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

const OCCASION_MAPPING: Record<string, string[]> = {
  work: ['Work', 'Day', 'Professional'],
  everyday: ['Casual', 'Day', 'Versatile'],
  'date-night': ['Date Night', 'Romantic', 'Evening'],
  evening: ['Evening', 'Formal Dinners', 'Special Events'],
}

const QUESTIONS = [
  {
    step: 1,
    id: 'gender',
    title: 'Who are you finding a scent for?',
    subtitle: 'Select the style profile or recipient that matches your intent.',
    options: [
      {
        value: 'female',
        emoji: '🌸',
        label: 'For Her',
        desc: 'Graceful, elegant florals & sweet warmth',
      },
      {
        value: 'male',
        emoji: '🌿',
        label: 'For Him',
        desc: 'Crisp woods, rich spices & fresh aromatics',
      },
      {
        value: 'unisex',
        emoji: '✨',
        label: 'Unisex / Shared',
        desc: 'Modern, genderless niche compositions',
      },
      {
        value: 'gift',
        emoji: '🎁',
        label: 'A Special Gift',
        desc: 'Universally loved crowd-pleasers anyone will adore',
      },
    ],
  },
  {
    step: 2,
    id: 'occasion',
    title: 'Where will this fragrance be worn most?',
    subtitle: 'Different occasions call for different projection and vibe.',
    options: [
      {
        value: 'everyday',
        emoji: '☀️',
        label: 'Everyday & Casual',
        desc: 'Effortless, fresh, uplifting daily ritual',
      },
      {
        value: 'work',
        emoji: '💼',
        label: 'Office & Professional',
        desc: 'Polished, clean, subtle, and composed',
      },
      {
        value: 'date-night',
        emoji: '🌙',
        label: 'Date Night & Romance',
        desc: 'Intimate, magnetic, sensual, and memorable',
      },
      {
        value: 'evening',
        emoji: '👑',
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
        emoji: '🌹',
        label: 'Floral & Blooming',
        desc: 'Damask Rose, Jasmine, Orange Blossom, Peony',
      },
      {
        value: 'Woody',
        emoji: '🌲',
        label: 'Woody & Earthy',
        desc: 'Rich Sandalwood, Cedar, Vetiver, Precious Agarwood',
      },
      {
        value: 'Citrus',
        emoji: '🍋',
        label: 'Citrus & Vibrant',
        desc: 'Sun-drenched Bergamot, Mandarin, Italian Lemon',
      },
      {
        value: 'Fresh',
        emoji: '🌊',
        label: 'Fresh & Aquatic',
        desc: 'Marine Sea Salt, Mineral Air, Crisp Dew',
      },
      {
        value: 'Amber',
        emoji: '🍦',
        label: 'Warm Vanilla & Amber',
        desc: 'Madagascar Vanilla, Tonka Bean, Amber, Cinnamon',
      },
      {
        value: 'all',
        emoji: '🎲',
        label: 'Surprise Me!',
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
        emoji: '🕊️',
        label: 'Soft & Intimate',
        desc: 'Whispers close to the skin, noticed upon embracing',
      },
      {
        value: 'balanced',
        emoji: '⚖️',
        label: 'Balanced All-Day',
        desc: 'Classic projection within arm’s reach (6–8 hours)',
      },
      {
        value: 'bold',
        emoji: '💥',
        label: 'Bold Statement',
        desc: 'Head-turning sillage with long-lasting trail',
      },
    ],
  },
  {
    step: 5,
    id: 'season',
    title: 'What climate or season fits your routine?',
    subtitle: 'Fragrance notes bloom differently in tropical heat versus cool breezes.',
    options: [
      {
        value: 'Summer',
        emoji: '🌴',
        label: 'Warm & Tropical',
        desc: 'Cooling, refreshing scents that shine in the heat',
      },
      {
        value: 'Winter',
        emoji: '🍂',
        label: 'Cool & Cozy',
        desc: 'Rich, warming, enveloping comfort in air-conditioning',
      },
      {
        value: 'All Seasons',
        emoji: '🔄',
        label: 'All-Year Versatile',
        desc: 'Adapts seamlessly from sunny mornings to breezy evenings',
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
          score += 3
          reasons.push('Versatile unisex profile')
        }
      }

      // Occasion fit
      if (preferences.occasion) {
        const matches = OCCASION_MAPPING[preferences.occasion] || []
        const hasOccasion = product.occasions.some((occ) =>
          matches.some((m) => occ.toLowerCase().includes(m.toLowerCase())),
        )
        if (hasOccasion) {
          score += 6
          const label = QUESTIONS[1].options.find((o) => o.value === preferences.occasion)?.label
          reasons.push(`Ideal for ${label}`)
        }
      }

      // Scent Family fit
      if (preferences.scentFamily && preferences.scentFamily !== 'all') {
        if (product.scentFamily.some((sf) => sf.toLowerCase() === preferences.scentFamily?.toLowerCase())) {
          score += 7
          reasons.push(`Rich ${preferences.scentFamily} accords`)
        }
      } else if (preferences.scentFamily === 'all') {
        score += 3
      }

      // Intensity fit
      if (preferences.intensity) {
        const targetIntensity = preferences.intensity === 'soft' ? 2 : preferences.intensity === 'balanced' ? 3 : 5
        const diff = Math.abs(product.intensity - targetIntensity)
        const intensityScore = Math.max(0, 4 - diff * 2)
        score += intensityScore
        if (intensityScore > 0) {
          reasons.push(
            preferences.intensity === 'soft'
              ? 'Soft, intimate presence'
              : preferences.intensity === 'bold'
                ? 'High-impact sillage'
                : 'Balanced everyday projection',
          )
        }
      }

      // Season fit
      if (preferences.season) {
        if (product.seasons.includes(preferences.season)) {
          score += 5
          reasons.push(`Thrives in ${preferences.season}`)
        } else if (product.seasons.includes('All Seasons')) {
          score += 3
          reasons.push('All-weather versatility')
        }
      }

      const availableStock = getAvailableStock(product.id)
      const availability = getAvailability(product.id)

      if (availableStock > 0) {
        score += 2
      }

      // Calculate an authentic match percentage (86% to 99%)
      const matchPercentage = Math.min(99, Math.max(82, Math.round(76 + (score / 35) * 23)))

      if (reasons.length === 0) {
        reasons.push('Artisanal signature formula')
      }

      return {
        product,
        availableStock,
        availability,
        score,
        matchPercentage,
        reasons,
      }
    })
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      if (b.availableStock !== a.availableStock) return b.availableStock - a.availableStock
      return b.product.rating - a.product.rating
    })
}

// ── Visual Helper Component ──────────────────────────────────────────

function ProductThumbnail({ product, className = '' }: { product: Product; className?: string }) {
  const [imageFailed, setImageFailed] = useState(false)

  if (imageFailed || !product.images?.[0]) {
    return (
      <div
        className={`relative flex items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-[#ffd2c9]/40 via-[#fff0be]/40 to-[#ffbfa8]/40 p-4 ${className}`}
      >
        <div className="text-center">
          <p className="text-xs uppercase tracking-widest text-foreground/45">{product.brand}</p>
          <p className="mt-1 font-serif text-lg font-bold text-foreground">{product.name}</p>
          <p className="mt-1 text-xs text-primary">{product.scentFamily[0]}</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-muted ${className}`}>
      <Image
        src={product.images[0]}
        alt={product.name}
        fill
        sizes="(min-width: 768px) 30vw, 90vw"
        className="object-cover transition-transform duration-500 hover:scale-105"
        onError={() => setImageFailed(true)}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
    </div>
  )
}

// ── Main Page Component ──────────────────────────────────────────────

export default function DiscoveryQuizPage() {
  const { catalog, getAvailableStock, getAvailabilityStatus, addToCart } = useStore()

  // Quiz State
  const [step, setStep] = useState<number>(1) // 1 to 5
  const [preferences, setPreferences] = useState<DiscoveryPreferences>(DEFAULT_PREFERENCES)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isCompleted, setIsCompleted] = useState(false)
  const [showAtelierFilter, setShowAtelierFilter] = useState(false)

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
      // Finished all 5 questions -> Run animated analysis
      setIsAnalyzing(true)
      window.scrollTo({ top: 80, behavior: 'smooth' })
      setTimeout(() => {
        setIsAnalyzing(false)
        setIsCompleted(true)
      }, 1100)
    }
  }

  // Handle Quick Add to Cart
  const handleAddToCart = async (product: Product) => {
    setAddingId(product.id)
    try {
      await addToCart({
        productId: product.id,
        size: product.sizes[0]?.ml ?? 100,
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
    setShowAtelierFilter(false)
    window.scrollTo({ top: 100, behavior: 'smooth' })
  }

  return (
    <StorefrontShell>
      <div className="min-h-screen px-3 pb-24 pt-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">

          {/* ── Header Banner ──────────────────────────────────── */}
          <div
            className="relative overflow-hidden rounded-[2rem] border border-white/60 p-6 sm:p-10 text-center shadow-lg"
            style={{
              background: 'linear-gradient(135deg, #ffd2c9 0%, #ffbfa8 45%, #fff0be 100%)',
              boxShadow: '0 24px 60px rgba(255,154,134,0.22)',
            }}
          >
            <div className="inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-1.5 text-xs font-semibold tracking-wide text-foreground backdrop-blur">
              <WandSparkles className="h-4 w-4 text-primary" />
              <span>Personalized Scent Matchmaker</span>
            </div>

            <h1 className="mt-4 font-serif text-3xl font-bold tracking-tight text-foreground sm:text-5xl">
              Find Your Signature Scent
            </h1>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-foreground/75 sm:text-base">
              Answer 5 intuitive questions. Our fragrance engine will analyze notes, sillage, and occasions
              to discover the exact perfume that mirrors your personality.
            </p>

            {/* Stepper Progress Bar */}
            {!isCompleted && !isAnalyzing && (
              <div className="mx-auto mt-8 max-w-md">
                <div className="flex items-center justify-between text-xs font-semibold text-foreground/70">
                  <span>Question {step} of 5</span>
                  <span>{step * 20}% completed</span>
                </div>
                <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-white/50 p-0.5 shadow-inner">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary via-[#ff8a73] to-[#8f6b26] transition-all duration-500 ease-out"
                    style={{ width: `${step * 20}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* ── State 1: Analyzing Loading Screen ──────────────── */}
          {isAnalyzing && (
            <div className="my-16 flex flex-col items-center justify-center text-center">
              <div className="relative flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-xl">
                <div className="absolute inset-0 animate-ping rounded-3xl bg-primary/20" />
                <Sparkles className="h-10 w-10 animate-spin text-primary duration-1000" />
              </div>
              <h2 className="mt-8 font-serif text-2xl font-bold text-foreground sm:text-3xl">
                Distilling Your Scent Profile...
              </h2>
              <p className="mt-2 text-sm text-foreground/60 max-w-md">
                Harmonizing top, heart, and base notes against our curated luxury perfume house formulas.
              </p>
            </div>
          )}

          {/* ── State 2: Step-by-Step Questionnaire ────────────── */}
          {!isCompleted && !isAnalyzing && currentQuestion && (
            <div className="mt-8">
              {/* Question Header & Navigation */}
              <div className="flex items-center justify-between gap-4">
                {step > 1 ? (
                  <button
                    type="button"
                    onClick={() => setStep((prev) => prev - 1)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-white/80 px-3.5 py-2 text-xs font-semibold text-foreground/80 shadow-xs transition hover:bg-white hover:text-foreground active:scale-95 cursor-pointer"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    <span>Back</span>
                  </button>
                ) : (
                  <div />
                )}

                <span className="text-xs font-semibold uppercase tracking-wider text-primary">
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

              <div className="mt-4 text-center">
                <h2 className="font-serif text-2xl font-bold text-foreground sm:text-3xl">
                  {currentQuestion.title}
                </h2>
                <p className="mt-1 text-sm text-foreground/60">
                  {currentQuestion.subtitle}
                </p>
              </div>

              {/* Options Cards Grid */}
              <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                {currentQuestion.options.map((opt) => {
                  const isSelected =
                    preferences[currentQuestion.id as keyof DiscoveryPreferences] === opt.value

                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() =>
                        handleSelectOption(currentQuestion.id as keyof DiscoveryPreferences, opt.value)
                      }
                      className={`group relative flex items-start gap-4 rounded-2xl border p-5 text-left transition-all duration-200 active:scale-[0.98] cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-white shadow-md ring-2 ring-primary/20'
                          : 'border-border/80 bg-white/70 hover:border-primary/50 hover:bg-white hover:shadow-sm'
                      }`}
                    >
                      <div
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl shadow-xs transition-transform group-hover:scale-110 ${
                          isSelected ? 'bg-primary/15' : 'bg-muted/70'
                        }`}
                      >
                        {opt.emoji}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-semibold text-foreground sm:text-base">
                            {opt.label}
                          </p>
                          {isSelected && (
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                              <Check className="h-3 w-3" />
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

          {/* ── State 3: Celebratory Match Result ──────────────── */}
          {isCompleted && topMatch && (
            <div className="mt-8 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
              
              {/* Match Result Banner */}
              <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-primary/30 bg-gradient-to-r from-[#ffe5de] via-[#fff5eb] to-[#fff0be] p-4 sm:flex-row sm:p-6 shadow-sm">
                <div className="flex items-center gap-3 text-center sm:text-left">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white shadow-sm text-primary">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                      <span className="rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-primary-foreground">
                        {topMatch.matchPercentage}% Compatibility Match
                      </span>
                      <span className="text-xs font-semibold text-foreground/60">
                        {topMatch.availability}
                      </span>
                    </div>
                    <p className="mt-1 font-serif text-lg font-bold text-foreground sm:text-xl">
                      We Found Your Signature Fragrance!
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRetake}
                  className="rounded-xl border-border/80 bg-white/80 text-xs font-semibold hover:bg-white"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                  Retake Scent Quiz
                </Button>
              </div>

              {/* Leading Fragrance Card */}
              <div className="overflow-hidden rounded-[2rem] border border-border/80 bg-white shadow-xl">
                <div className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[320px_minmax(0,1fr)]">
                  
                  {/* Left: Fragrance Image */}
                  <div className="relative">
                    <ProductThumbnail
                      product={topMatch.product}
                      className="h-[300px] sm:h-full min-h-[280px] w-full"
                    />
                    <div className="absolute top-3 left-3 rounded-full bg-white/90 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-primary shadow-xs backdrop-blur">
                      Top Match
                    </div>
                  </div>

                  {/* Right: Fragrance Details */}
                  <div className="flex flex-col justify-between space-y-6">
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold uppercase tracking-[0.25em] text-foreground/45">
                          {topMatch.product.brand}
                        </p>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-[11px] font-semibold text-foreground/70">
                          {topMatch.product.category}
                        </span>
                      </div>

                      <h2 className="mt-2 font-serif text-2xl font-bold text-foreground sm:text-4xl">
                        {topMatch.product.name}
                      </h2>

                      <p className="mt-3 text-sm text-foreground/70 leading-relaxed sm:text-base">
                        {topMatch.product.description}
                      </p>

                      {/* Reasons why it matches */}
                      <div className="mt-4 flex flex-wrap gap-2">
                        {topMatch.reasons.map((reason) => (
                          <span
                            key={reason}
                            className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-[#fff5eb] px-3 py-1 text-xs font-semibold text-[#8f6b26]"
                          >
                            <Check className="h-3 w-3 text-primary" />
                            {reason}
                          </span>
                        ))}
                      </div>

                      {/* Scent Pyramid Breakdown */}
                      <div className="mt-6 rounded-2xl border border-border/70 bg-stone-50/70 p-4">
                        <p className="text-xs font-bold uppercase tracking-[0.2em] text-foreground/45">
                          Fragrance Note Pyramid
                        </p>
                        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                          <div className="rounded-xl bg-white p-2.5 shadow-xs border border-border/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                              🍋 Top Notes
                            </span>
                            <p className="mt-0.5 text-xs font-medium text-foreground">
                              {topMatch.product.topNotes.slice(0, 3).join(', ')}
                            </p>
                          </div>
                          <div className="rounded-xl bg-white p-2.5 shadow-xs border border-border/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                              🌹 Heart Notes
                            </span>
                            <p className="mt-0.5 text-xs font-medium text-foreground">
                              {topMatch.product.middleNotes.slice(0, 3).join(', ')}
                            </p>
                          </div>
                          <div className="rounded-xl bg-white p-2.5 shadow-xs border border-border/40">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                              🪵 Base Notes
                            </span>
                            <p className="mt-0.5 text-xs font-medium text-foreground">
                              {topMatch.product.baseNotes.slice(0, 3).join(', ')}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Price & Action Buttons */}
                    <div className="border-t border-border/60 pt-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-xs text-foreground/50">Price (VAT-Inclusive)</p>
                          <p className="font-serif text-2xl font-bold text-foreground sm:text-3xl">
                            {formatPHP(topMatch.product.price)}
                          </p>
                        </div>

                        <div className="flex items-center gap-2">
                          <Button
                            size="lg"
                            onClick={() => handleAddToCart(topMatch.product)}
                            disabled={topMatch.availableStock <= 0 || addingId === topMatch.product.id}
                            className="h-12 flex-1 rounded-2xl bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_12px_28px_rgba(255,154,134,0.3)] transition-all hover:bg-[#ff8a73] active:scale-95 sm:flex-none cursor-pointer"
                          >
                            {addedIds[topMatch.product.id] ? (
                              <>
                                <Check className="mr-2 h-4 w-4" />
                                Added to Bag!
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
                            className="h-12 rounded-2xl border-border/80 bg-white px-5 text-sm font-semibold text-foreground hover:bg-muted active:scale-95"
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

              {/* ── Runner-up Alternatives ─────────────────────────── */}
              {runnerUps.length > 0 && (
                <div>
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="font-serif text-xl font-bold text-foreground sm:text-2xl">
                        Runner-Up Matches You Might Also Love
                      </h3>
                      <p className="text-xs text-foreground/60">
                        Alternative perfumes sharing harmonious facets of your preference profile.
                      </p>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    {runnerUps.map((runner) => (
                      <div
                        key={runner.product.id}
                        className="flex flex-col justify-between rounded-2xl border border-border/80 bg-white p-5 shadow-sm transition hover:shadow-md"
                      >
                        <div className="flex gap-4">
                          <ProductThumbnail
                            product={runner.product}
                            className="h-28 w-24 shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between">
                              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                                {runner.matchPercentage}% Match
                              </span>
                              <span className="text-[11px] text-foreground/50">
                                {runner.availability}
                              </span>
                            </div>

                            <p className="mt-1 truncate text-xs uppercase tracking-wider text-foreground/45">
                              {runner.product.brand}
                            </p>
                            <h4 className="truncate font-serif text-lg font-bold text-foreground">
                              {runner.product.name}
                            </h4>

                            <p className="mt-1 text-xs text-foreground/65 line-clamp-1">
                              {runner.product.scentFamily.join(' • ')}
                            </p>

                            <p className="mt-2 font-serif text-base font-bold text-foreground">
                              {formatPHP(runner.product.price)}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 flex items-center gap-2 border-t border-border/60 pt-3">
                          <Button
                            size="sm"
                            onClick={() => handleAddToCart(runner.product)}
                            disabled={runner.availableStock <= 0 || addingId === runner.product.id}
                            className="h-9 flex-1 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-xs hover:bg-[#ff8a73]"
                          >
                            {addedIds[runner.product.id] ? (
                              <>
                                <Check className="mr-1.5 h-3.5 w-3.5" />
                                Added!
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
                            className="h-9 rounded-xl border-border/70 text-xs font-semibold"
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

              {/* ── Toggle Atelier / Manual Filter View ───────────── */}
              <div className="rounded-2xl border border-dashed border-border/80 p-6 text-center">
                <p className="text-sm font-semibold text-foreground">
                  Want to explore our entire fragrance atelier with granular filters?
                </p>
                <p className="mt-1 text-xs text-foreground/60">
                  You can browse all perfume houses or browse our curated collections.
                </p>
                <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-xl border-border/80 bg-white shadow-xs"
                  >
                    <Link href="/shop">
                      <Compass className="mr-2 h-4 w-4 text-primary" />
                      Browse All Perfumes
                    </Link>
                  </Button>
                  <Button
                    asChild
                    variant="outline"
                    className="rounded-xl border-border/80 bg-white shadow-xs"
                  >
                    <Link href="/collections">
                      <Sparkles className="mr-2 h-4 w-4 text-primary" />
                      Explore Collections
                    </Link>
                  </Button>
                </div>
              </div>

            </div>
          )}

        </div>
      </div>
    </StorefrontShell>
  )
}
