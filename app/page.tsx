'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import {
  Compass,
  Droplets,
  MoveRight,
  ShieldCheck,
  Sparkles,
  Star,
  Wind,
} from 'lucide-react'
import { ProductCard } from '@/components/product-card'
import { StorefrontShell } from '@/components/storefront-shell'
import {
  HOME_BENEFITS,
  STOREFRONT_JOURNAL_ARTICLES,
  STOREFRONT_TESTIMONIALS,
} from '@/lib/storefront-content'
import { useStore } from '@/lib/store-context'
import { formatPHP } from '@/lib/currency'

const ACCORDS = [
  {
    id: 'woody',
    name: 'Smoky Woods & Pine',
    leadNote: 'Atlas Cedar & Wet Earth',
    bottleId: '3',
    bottleName: 'Forest Trail',
    pyramid: {
      top: 'Pine Needles, Crisp Juniper',
      heart: 'Cedarwood, Clary Sage',
      base: 'Oakmoss, Vetiver, Amber',
    },
    mood: 'Contemplative, fresh, grounded',
    image: '/products/forest-trail-1.jpg',
  },
  {
    id: 'floral',
    name: 'Midnight Florals',
    leadNote: 'Damask Rose & Iris',
    bottleId: '1',
    bottleName: 'Midnight Elegance',
    pyramid: {
      top: 'Bergamot, Black Currant',
      heart: 'Rose Absolute, Jasmine, Iris',
      base: 'Aged Sandalwood, Musk, Amber',
    },
    mood: 'Seductive, mysterious, formal',
    image: '/products/midnight-elegance-1.jpg',
  },
  {
    id: 'citrus',
    name: 'Solar Citrus',
    leadNote: 'Neroli & Pink Grapefruit',
    bottleId: '2',
    bottleName: 'Dawn Light',
    pyramid: {
      top: 'Italian Lemon, Grapefruit',
      heart: 'White Peony, Magnolia',
      base: 'Clean Musk, Pale Cedar',
    },
    mood: 'Dewy morning, uplifting, bright',
    image: '/products/dawn-light-1.jpg',
  },
  {
    id: 'amber',
    name: 'Warm Amber & Cardamom',
    leadNote: 'Cardamom & Tonka',
    bottleId: '4',
    bottleName: 'Velvet Spice',
    pyramid: {
      top: 'Crushed Cardamom, Ginger',
      heart: 'Nutmeg, Cinnamon Bark',
      base: 'Bourbon Vanilla, Labdanum',
    },
    mood: 'Intimate, magnetic, enveloping',
    image: '/products/velvet-spice-1.jpg',
  },
]

export default function Home() {
  const { catalog } = useStore()
  const [activeAccord, setActiveAccord] = useState(ACCORDS[0])

  const featured = catalog.filter((product) => product.featured).slice(0, 4)
  const bestSellers = [...catalog].sort((left, right) => right.rating - left.rating).slice(0, 4)

  return (
    <StorefrontShell>
      {/* ── 1. Hero: Integrated Luxury 2-Column Banner (Fits Cleanly Above The Fold) ── */}
      <section className="relative overflow-hidden bg-[#fffaf5] px-4 py-8 sm:px-6 sm:py-12 lg:px-8 lg:py-16">
        <div className="mx-auto max-w-7xl">
          <div className="grid gap-12 lg:grid-cols-12 lg:items-center">
            {/* Left Column: Narrative, Value, & Actions */}
            <div className="lg:col-span-7 space-y-6 text-left">
              <span className="inline-block rounded-full bg-primary/10 px-3.5 py-1 text-xs font-semibold text-primary">
                Mabini Perfume Atelier · Small Batch Curation
              </span>

              <h1 className="font-serif text-4xl sm:text-6xl lg:text-7xl leading-[1.08] text-foreground tracking-tight">
                A Signature Scent That Feels Personal.
              </h1>

              <p className="text-base sm:text-lg text-foreground/75 max-w-xl leading-relaxed">
                Curated olfactive compositions hand-finished in our Mabini atelier. Formulated for longevity, intimate sillage, and emotional resonance.
              </p>

              <div className="flex flex-wrap items-center gap-3 pt-2">
                <span className="rounded-xl bg-[#fff0be] px-3 py-1.5 text-xs font-medium text-foreground/80">
                  From ₱155 · 8+ Hours Wear
                </span>
                <span className="rounded-xl border border-border/80 px-3 py-1.5 text-xs text-foreground/60">
                  Pure Macerated Oils
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-2">
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 rounded-2xl bg-primary px-7 py-3.5 text-sm font-semibold text-primary-foreground transition hover:bg-[#ff8a73]"
                >
                  <span>Explore Catalog</span>
                  <MoveRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/discovery"
                  className="inline-flex items-center gap-2 rounded-2xl border border-border/80 bg-white px-7 py-3.5 text-sm font-semibold text-foreground transition hover:border-primary/60 hover:text-primary"
                >
                  <Compass className="h-4 w-4 text-primary" />
                  <span>Take Discovery Quiz</span>
                </Link>
              </div>

              {/* Trust Indicators */}
              <div className="grid grid-cols-3 gap-4 pt-6 max-w-md">
                <div>
                  <div className="flex items-center gap-1 font-serif text-xl sm:text-2xl text-foreground">
                    <span>4.8</span>
                    <Star className="h-4 w-4 fill-primary text-primary" />
                  </div>
                  <p className="text-xs text-foreground/60 mt-0.5">850+ Verified Reviews</p>
                </div>
                <div>
                  <p className="font-serif text-xl sm:text-2xl text-foreground">21 Days</p>
                  <p className="text-xs text-foreground/60 mt-0.5">Artisanal Maceration</p>
                </div>
                <div>
                  <p className="font-serif text-xl sm:text-2xl text-foreground">100%</p>
                  <p className="text-xs text-foreground/60 mt-0.5">Local Batch Dispatch</p>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Bottle Showcase Frame */}
            <div className="lg:col-span-5">
              <div className="relative mx-auto max-w-md rounded-3xl border border-border/70 bg-[#fff5ee] p-8 sm:p-10">
                <div className="flex items-center justify-between text-xs text-foreground/60 mb-2">
                  <span className="font-semibold text-primary">Featured Signature</span>
                  <span>Batch SS-2026</span>
                </div>

                <div className="relative h-[320px] sm:h-[380px] w-full flex items-center justify-center my-4">
                  <Image
                    src="/products/midnight-elegance-1.jpg"
                    alt="Midnight Elegance signature fragrance bottle"
                    fill
                    priority
                    sizes="(min-width: 1024px) 35vw, 90vw"
                    className="object-contain p-2 transition-transform duration-700 hover:scale-105"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-serif text-2xl text-foreground">
                      Midnight Elegance
                    </h3>
                    <span className="font-serif text-lg font-bold text-foreground">
                      ₱185
                    </span>
                  </div>

                  <p className="text-xs text-foreground/65 leading-relaxed">
                    Notes of Italian Bergamot, Damask Rose, and Aged Sandalwood.
                  </p>

                  <div className="pt-3">
                    <Link
                      href="/products/1"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground py-2.5 text-xs font-semibold text-background transition hover:bg-foreground/85"
                    >
                      <span>Discover Bottle</span>
                      <MoveRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 2. The One Live Thing: Olfactory Accord Explorer ──────────── */}
      <section className="bg-white px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <h2 className="font-serif text-3xl sm:text-4xl text-foreground">
              Explore The Olfactory Accords
            </h2>
            <p className="mt-3 text-base text-foreground/70 leading-relaxed">
              Touch an accord to inspect the note architecture and discover which composition speaks to your mood.
            </p>
          </div>

          {/* Accord Selection Buttons */}
          <div className="mt-8 flex flex-wrap gap-2.5">
            {ACCORDS.map((accord) => {
              const isSelected = activeAccord.id === accord.id
              return (
                <button
                  key={accord.id}
                  type="button"
                  onClick={() => setActiveAccord(accord)}
                  className={`rounded-2xl px-5 py-3 text-sm font-medium transition cursor-pointer ${
                    isSelected
                      ? 'bg-foreground text-background'
                      : 'border border-border/80 bg-[#fffaf5] text-foreground hover:border-primary/50'
                  }`}
                >
                  {accord.name}
                </button>
              )
            })}
          </div>

          {/* Interactive Note Stage */}
          <div className="mt-8 grid gap-8 rounded-3xl border border-border/70 bg-[#fffdfa] p-6 sm:p-10 lg:grid-cols-12 lg:items-center">
            {/* Bottle Render */}
            <div className="relative lg:col-span-4 h-[280px] flex items-center justify-center bg-white rounded-2xl border border-border/40 p-4">
              <Image
                src={activeAccord.image}
                alt={activeAccord.bottleName}
                fill
                sizes="(min-width: 1024px) 25vw, 80vw"
                className="object-contain p-4"
              />
            </div>

            {/* Note Breakdown */}
            <div className="lg:col-span-8 space-y-6">
              <div>
                <span className="text-xs font-semibold text-primary">
                  {activeAccord.mood}
                </span>
                <h3 className="font-serif text-3xl text-foreground mt-1">
                  {activeAccord.bottleName}
                </h3>
                <p className="text-base text-foreground/75 mt-1 font-medium">
                  Signature Note: {activeAccord.leadNote}
                </p>
              </div>

              {/* 3-Part Pyramid Breakdown */}
              <div className="grid gap-4 sm:grid-cols-3 pt-2">
                <div className="rounded-2xl border border-border/60 bg-white p-4">
                  <div className="flex items-center gap-2 text-foreground/50 text-xs font-semibold mb-1">
                    <Wind className="h-3.5 w-3.5" />
                    <span>Top Notes</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{activeAccord.pyramid.top}</p>
                  <p className="text-xs text-foreground/50 mt-1">First 15-30 minutes</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-white p-4">
                  <div className="flex items-center gap-2 text-foreground/50 text-xs font-semibold mb-1">
                    <Droplets className="h-3.5 w-3.5" />
                    <span>Heart Notes</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{activeAccord.pyramid.heart}</p>
                  <p className="text-xs text-foreground/50 mt-1">2 to 4 hours</p>
                </div>

                <div className="rounded-2xl border border-border/60 bg-white p-4">
                  <div className="flex items-center gap-2 text-foreground/50 text-xs font-semibold mb-1">
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>Base Notes</span>
                  </div>
                  <p className="text-sm font-medium text-foreground">{activeAccord.pyramid.base}</p>
                  <p className="text-xs text-foreground/50 mt-1">5 to 10+ hours</p>
                </div>
              </div>

              <div className="pt-2 flex flex-wrap gap-3 items-center">
                <Link
                  href={`/products/${activeAccord.bottleId}`}
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition hover:bg-[#ff8a73]"
                >
                  <span>Order Bottle</span>
                  <MoveRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/shop"
                  className="text-sm font-medium text-foreground/70 hover:text-foreground underline underline-offset-4"
                >
                  Browse all {activeAccord.name} scents
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. Featured Fragrances ───────────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl sm:text-5xl text-foreground">
                Curated Signatures
              </h2>
              <p className="mt-2 text-base text-foreground/65 max-w-xl">
                Our core compositions, hand-selected for high versatility, distinctive scent trails, and pure note expression.
              </p>
            </div>
            <Link
              href="/shop"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition"
            >
              <span>Explore all fragrances</span>
              <MoveRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 4. The Atelier & Craft ───────────────────────────────────── */}
      <section className="bg-[#fff7f1] px-4 py-20 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl grid gap-12 lg:grid-cols-12 lg:items-center">
          {/* Visual Canvas */}
          <div className="relative lg:col-span-5 h-[380px] sm:h-[460px] rounded-3xl overflow-hidden border border-border/70">
            <Image
              src="/why-choose-us.png"
              alt="Spray & Sniff Atelier Mabini"
              fill
              className="object-cover"
              sizes="(min-width: 1024px) 40vw, 90vw"
            />
          </div>

          {/* Editorial Content */}
          <div className="lg:col-span-7 space-y-8">
            <div>
              <h2 className="font-serif text-3xl sm:text-5xl text-foreground leading-tight">
                Crafted In Mabini, Worn Everywhere.
              </h2>
              <p className="mt-4 text-base sm:text-lg text-foreground/75 leading-relaxed">
                Spray &amp; Sniff was founded on a simple conviction: fragrance should never be generic mass production. We compose scents that interact honestly with your individual skin chemistry.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {HOME_BENEFITS.map((benefit) => (
                <div key={benefit.id} className="space-y-2">
                  <h3 className="font-serif text-xl text-foreground">
                    {benefit.title}
                  </h3>
                  <p className="text-sm text-foreground/65 leading-relaxed">
                    {benefit.description}
                  </p>
                </div>
              ))}
            </div>

            <div className="pt-2">
              <Link
                href="/about"
                className="inline-flex items-center gap-2 rounded-2xl bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:bg-foreground/85"
              >
                <span>Read Our Atelier Story</span>
                <MoveRight className="h-4 w-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── 5. Most-Loved Bottles ─────────────────────────────────────── */}
      <section className="px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl sm:text-5xl text-foreground">
                Most-Loved Bottles
              </h2>
              <p className="mt-2 text-base text-foreground/65">
                Fragrances with the highest wear ratings and verified customer repeat orders.
              </p>
            </div>
            <Link
              href="/collections"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-foreground hover:text-primary transition"
            >
              <span>View Collections</span>
              <MoveRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {bestSellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </section>

      {/* ── 6. Customer Reviews ───────────────────────────────────────── */}
      <section id="reviews" className="bg-white px-4 py-20 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-10">
            <div>
              <h2 className="font-serif text-3xl sm:text-5xl text-foreground">
                What Perfume Wearers Say
              </h2>
              <p className="mt-2 text-base text-foreground/65">
                Authentic feedback from verified fragrance collectors across the Philippines.
              </p>
            </div>
            <Link
              href="/reviews"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <span>See all 850+ reviews</span>
              <MoveRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            {STOREFRONT_TESTIMONIALS.slice(0, 3).map((testimonial) => (
              <article
                key={testimonial.id}
                className="flex flex-col justify-between rounded-3xl border border-border/80 bg-[#fffdfa] p-7"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex text-primary">
                      {Array.from({ length: testimonial.rating }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <span className="text-xs text-foreground/50">{testimonial.longevity}</span>
                  </div>

                  <p className="text-base text-foreground/80 leading-relaxed italic font-serif">
                    &ldquo;{testimonial.quote}&rdquo;
                  </p>
                </div>

                <div className="mt-6 pt-4 flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-sm text-foreground">{testimonial.name}</p>
                    <p className="text-xs text-foreground/50">{testimonial.role}</p>
                  </div>
                  <span className="text-xs text-primary font-medium">
                    {testimonial.productName}
                  </span>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── 7. Scent Journal ──────────────────────────────────────────── */}
      <section id="journal" className="px-4 py-16 sm:px-6 lg:px-8 scroll-mt-20">
        <div className="mx-auto max-w-7xl">
          <div className="mb-10 flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
            <div>
              <h2 className="font-serif text-3xl sm:text-5xl text-foreground">
                The Scent Journal
              </h2>
              <p className="mt-2 text-base text-foreground/65">
                Olfactive education, note pairing guides, and perfume wardrobe insights.
              </p>
            </div>
            <Link
              href="/journal"
              className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
            >
              <span>Read all articles</span>
              <MoveRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {STOREFRONT_JOURNAL_ARTICLES.map((article) => (
              <article
                key={article.id}
                className="group flex flex-col overflow-hidden rounded-3xl border border-border/80 bg-white"
              >
                <div className="relative h-[220px] w-full overflow-hidden bg-neutral-100">
                  <Image
                    src={article.image}
                    alt={article.imageAlt}
                    fill
                    sizes="(min-width: 768px) 33vw, 100vw"
                    className="object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                </div>
                <div className="flex flex-1 flex-col justify-between p-6">
                  <div>
                    <div className="flex items-center gap-2 text-xs text-foreground/50">
                      <span>{article.category}</span>
                      <span>·</span>
                      <span>{article.readTime}</span>
                    </div>
                    <h3 className="font-serif text-xl text-foreground mt-2 leading-snug group-hover:text-primary transition">
                      {article.title}
                    </h3>
                    <p className="mt-3 text-sm text-foreground/65 line-clamp-3 leading-relaxed">
                      {article.excerpt}
                    </p>
                  </div>
                  <div className="mt-6 pt-4">
                    <Link
                      href="/journal"
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground hover:text-primary transition"
                    >
                      <span>Read Story</span>
                      <MoveRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </StorefrontShell>
  )
}
