'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Gift, MoveRight, Sparkles, Truck, WandSparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProductCard } from '@/components/product-card'
import { StorefrontShell } from '@/components/storefront-shell'
import {
  HOME_BENEFITS,
  HOME_JOURNAL_ENTRIES,
  HOME_TESTIMONIALS,
} from '@/lib/storefront-content'
import { useStore } from '@/lib/store-context'

const benefitIcons: Record<string, React.ElementType> = {
  craft: Sparkles,
  notes: WandSparkles,
  gifting: Gift,
  delivery: Truck,
}

export default function Home() {
  const { catalog } = useStore()
  const featured = catalog.filter((product) => product.featured).slice(0, 4)
  const bestSellers = [...catalog].sort((left, right) => right.rating - left.rating).slice(0, 4)

  return (
    <StorefrontShell>
      {/* ── Hero ──────────────────────────────────────────────── */}
      <section className="px-3 pb-8 pt-5 sm:px-6 sm:pb-10 sm:pt-8 lg:px-8 lg:pt-10">
        <div
          className="mx-auto max-w-7xl overflow-hidden rounded-[1.75rem] sm:rounded-[2.5rem]"
          style={{
            background: 'linear-gradient(140deg, #ffd2c9 0%, #ffbfa8 42%, #fff0be 100%)',
            boxShadow: '0 32px 90px rgba(182,104,86,0.18)',
          }}
        >
          <div className="grid gap-5 px-5 py-7 sm:gap-8 sm:px-10 sm:py-10 lg:grid-cols-2 lg:px-12 lg:py-14">
            {/* Text content */}
            <div className="relative z-10 flex flex-col justify-center">
              <p className="storefront-eyebrow">Perfume-Only Curation</p>
              <h1
                className="mt-4 font-serif text-foreground"
                style={{ fontSize: 'clamp(1.75rem, 6vw, 2.65rem)', lineHeight: '1.1' }}
              >
                Find A Signature Scent That Feels Personal.
              </h1>
              <p className="mt-4 text-sm leading-7 text-foreground/70 sm:mt-6 sm:text-base sm:leading-8 lg:text-lg">
                Explore editor-style fragrance collections, rich note stories, and long-wear perfume
                picks designed for daily rituals, gifting moments, and evening statements.
              </p>

              <div className="mt-6 flex flex-col gap-3 sm:mt-8 sm:flex-row">
                <Button
                  size="lg"
                  className="h-12 rounded-2xl bg-primary px-5 text-primary-foreground hover:bg-[#ff8a73] sm:px-7"
                  style={{ boxShadow: '0 16px 34px rgba(255,154,134,0.34)' }}
                  asChild
                >
                  <Link href="/shop">
                    Shop Fragrances
                    <MoveRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="h-12 rounded-2xl border-border/70 bg-white/60 px-5 sm:px-7"
                  asChild
                >
                  <Link href="/discovery">Take The Discovery Quiz</Link>
                </Button>
              </div>

              {/* Stats row */}
              <div className="mt-6 grid grid-cols-3 gap-2 sm:mt-10 sm:gap-4">
                {[
                  { title: 'Curated', desc: 'Perfume-only collections' },
                  { title: 'Notes', desc: 'Top, heart & base' },
                  { title: 'Fast', desc: 'Smooth tracking' },
                ].map((stat) => (
                  <div
                    key={stat.title}
                    className="rounded-[1.25rem] border border-white/55 bg-white/45 px-3 py-3 backdrop-blur sm:rounded-[1.5rem] sm:px-4 sm:py-4"
                  >
                    <p className="text-base font-semibold text-foreground sm:text-2xl">{stat.title}</p>
                    <p className="mt-0.5 text-[10px] leading-tight text-foreground/65 sm:mt-1 sm:text-sm">
                      {stat.desc}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {/* Hero image — fixed height, never collapses */}
            <div className="relative flex items-end justify-center" style={{ minHeight: '240px' }}>
              <div className="absolute inset-0 rounded-[2.5rem]" style={{ background: 'radial-gradient(circle at center, rgba(255,255,255,0.38), transparent 56%)' }} />
              <div
                className="relative w-full overflow-hidden rounded-[1.75rem] border border-white/40 bg-white/28 sm:rounded-[2.25rem]"
                style={{ height: '240px', minHeight: '240px', boxShadow: '0 40px 80px rgba(135,77,70,0.18)', background: 'linear-gradient(180deg, rgba(255,214,166,0.4), rgba(255,179,153,0.3))' }}
              >
                <Image
                  src="/hero-banner.jpg"
                  alt="Luxury perfume collection"
                  fill
                  priority
                  sizes="(min-width: 1024px) 50vw, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0" style={{ background: 'linear-gradient(180deg, rgba(255,255,255,0.08), rgba(255,230,220,0.14))' }} />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Featured Fragrances ──────────────────────────────── */}
      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="storefront-eyebrow">Featured Fragrances</p>
              <h2 className="mt-3 text-3xl text-foreground sm:text-4xl lg:text-5xl">Curated Signatures</h2>
            </div>
            <Link href="/shop" className="hidden text-sm font-semibold text-foreground/65 transition hover:text-foreground sm:inline-flex">
              Browse all scents
            </Link>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {featured.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="mt-6 text-center sm:hidden">
            <Link href="/shop" className="text-sm font-semibold text-foreground/65 transition hover:text-foreground">
              Browse all scents →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Why Choose Us ───────────────────────────────────── */}
      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2 lg:gap-12">
          {/* Image */}
          <div
            className="relative w-full overflow-hidden rounded-[2.5rem]"
            style={{ height: '320px', boxShadow: '0 25px 80px rgba(100,60,50,0.2)' }}
          >
            <Image
              src="/why-choose-us.png"
              alt="Premium perfume lifestyle"
              fill
              className="object-cover"
            />
            <div className="absolute inset-0" style={{ background: 'linear-gradient(to top, rgba(0,0,0,0.2), transparent)' }} />
          </div>

          <div className="flex flex-col justify-center">
            <p className="storefront-eyebrow">The Signature Experience</p>
            <h2
              className="mt-5 font-serif text-foreground"
              style={{ fontSize: 'clamp(1.75rem, 5vw, 3.5rem)', lineHeight: '1.15' }}
            >
              A Refined Way To Discover Scent
            </h2>
            <p className="mt-5 text-sm leading-relaxed text-foreground/70 sm:text-base lg:text-lg">
              We curate more than just fragrances. Each bottle is part of a storytelling ritual,
              ensuring your signature scent is as personal as your own story.
            </p>

            {/* Benefits grid */}
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {HOME_BENEFITS.map((benefit) => {
                const Icon = benefitIcons[benefit.id] ?? Sparkles

                return (
                  <div key={benefit.id} className="flex flex-col gap-3">
                    {/* Icon container — inline styles so it NEVER gets purged */}
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '1rem',
                        background: 'rgba(255,154,134,0.12)',
                        color: '#ff9a86',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}
                    >
                      <Icon style={{ width: '20px', height: '20px' }} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-foreground sm:text-xl">{benefit.title}</h3>
                      <p className="mt-2 text-sm leading-relaxed text-foreground/60">{benefit.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ── Best Sellers ─────────────────────────────────────── */}
      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="storefront-eyebrow">Best Sellers</p>
              <h2 className="mt-3 text-3xl text-foreground sm:text-4xl lg:text-5xl">Most-Loved Bottles</h2>
            </div>
            <Button
              variant="outline"
              className="hidden h-11 rounded-2xl border-border/70 bg-white/70 px-5 sm:inline-flex"
              asChild
            >
              <Link href="/collections">Explore Collections</Link>
            </Button>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
            {bestSellers.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          <div className="mt-6 text-center sm:hidden">
            <Link href="/collections" className="text-sm font-semibold text-foreground/65 transition hover:text-foreground">
              Explore Collections →
            </Link>
          </div>
        </div>
      </section>

      {/* ── Testimonials ─────────────────────────────────────── */}
      <section id="reviews" className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p className="storefront-eyebrow">Customer Reviews</p>
            <h2 className="mt-3 text-3xl text-foreground sm:text-4xl lg:text-5xl">What Perfume Buyers Are Saying</h2>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {HOME_TESTIMONIALS.map((testimonial) => (
              <article key={testimonial.name} className="storefront-panel rounded-[2rem] p-6 sm:p-7">
                <div className="flex gap-1 text-primary">
                  {Array.from({ length: 5 }).map((_, index) => (
                    <span key={`${testimonial.name}-${index}`}>★</span>
                  ))}
                </div>
                <p className="mt-5 text-sm leading-7 text-foreground/72 sm:text-base">
                  {testimonial.quote}
                </p>
                <div className="mt-6 border-t border-border/60 pt-4">
                  <p className="font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-sm text-foreground/52">{testimonial.role}</p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* ── Journal ──────────────────────────────────────────── */}
      <section id="journal" className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8">
            <p className="storefront-eyebrow">Journal</p>
            <h2 className="mt-3 text-3xl text-foreground sm:text-4xl lg:text-5xl">Scent Notes And Buying Guides</h2>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {HOME_JOURNAL_ENTRIES.map((entry) => (
              <article key={entry.title} className="storefront-panel overflow-hidden rounded-[2rem]">
                {/* Journal image — fixed height */}
                <div
                  className="relative w-full"
                  style={{
                    height: '220px',
                    background: 'linear-gradient(145deg, #3d261e, #5b3427 55%, #2f1c17)',
                  }}
                >
                  <Image
                    src={entry.image}
                    alt={entry.imageAlt}
                    fill
                    sizes="(min-width: 1024px) 30vw, 100vw"
                    className="scale-[0.86] object-contain object-center p-4"
                  />
                </div>
                <div className="p-5 sm:p-6">
                  <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-foreground/45">
                    <span>{entry.label}</span>
                    <span className="h-1 w-1 rounded-full bg-foreground/25" />
                    <span>{entry.date}</span>
                  </div>
                  <h3 className="mt-4 text-xl leading-tight text-foreground sm:text-2xl">{entry.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-foreground/65">{entry.excerpt}</p>
                  <Link
                    href={entry.href}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-foreground transition hover:text-primary"
                  >
                    Explore More
                    <MoveRight className="h-4 w-4" />
                  </Link>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    </StorefrontShell>
  )
}
