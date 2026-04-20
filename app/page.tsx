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

const benefitIcons = {
  craft: Sparkles,
  notes: WandSparkles,
  gifting: Gift,
  delivery: Truck,
} as const

export default function Home() {
  const { catalog } = useStore()
  const featured = catalog.filter((product) => product.featured).slice(0, 4)
  const bestSellers = [...catalog].sort((left, right) => right.rating - left.rating).slice(0, 4)

  return (
    <StorefrontShell>
      <section className="px-4 pb-10 pt-8 sm:px-6 lg:px-8 lg:pt-10">
        <div className="mx-auto grid max-w-7xl gap-8 overflow-hidden rounded-[2.5rem] bg-[linear-gradient(140deg,#ffd2c9_0%,#ffbfa8_42%,#fff0be_100%)] px-7 py-10 shadow-[0_32px_90px_rgba(182,104,86,0.18)] sm:px-10 lg:grid-cols-[0.95fr_1.05fr] lg:px-12 lg:py-14">
          <div className="relative z-10 flex flex-col justify-center">
            <p className="storefront-eyebrow">Perfume-Only Curation</p>
            <h1 className="mt-5 max-w-xl font-serif text-5xl leading-[0.98] text-foreground sm:text-6xl lg:text-7xl">
              Find A Signature Scent That Feels Personal.
            </h1>
            <p className="mt-6 max-w-xl text-base leading-8 text-foreground/70 sm:text-lg">
              Explore editor-style fragrance collections, rich note stories, and long-wear perfume
              picks designed for daily rituals, gifting moments, and evening statements.
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button
                size="lg"
                className="h-12 rounded-2xl bg-primary px-7 text-primary-foreground shadow-[0_16px_34px_rgba(255,154,134,0.34)] hover:bg-[#ff8a73]"
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
                className="h-12 rounded-2xl border-border/70 bg-white/60 px-7"
                asChild
              >
                <Link href="/discovery">Take The Discovery Quiz</Link>
              </Button>
            </div>

            <div className="mt-10 grid max-w-xl gap-4 sm:grid-cols-3">
              <div className="rounded-[1.5rem] border border-white/55 bg-white/45 px-4 py-4 backdrop-blur">
                <p className="text-2xl font-semibold text-foreground">Curated</p>
                <p className="mt-1 text-sm text-foreground/65">Perfume-only collections</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/55 bg-white/45 px-4 py-4 backdrop-blur">
                <p className="text-2xl font-semibold text-foreground">Notes</p>
                <p className="mt-1 text-sm text-foreground/65">Top, heart, and base clarity</p>
              </div>
              <div className="rounded-[1.5rem] border border-white/55 bg-white/45 px-4 py-4 backdrop-blur">
                <p className="text-2xl font-semibold text-foreground">Fast</p>
                <p className="mt-1 text-sm text-foreground/65">Smooth order tracking</p>
              </div>
            </div>
          </div>

          <div className="relative flex min-h-[360px] items-end justify-center lg:min-h-[560px]">
            <div className="absolute inset-0 rounded-[2.5rem] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.38),transparent_56%)]" />
            <div className="absolute right-2 top-4 h-[76%] w-[78%] rounded-full bg-[linear-gradient(180deg,rgba(255,154,134,0.18),rgba(255,255,255,0.08))] blur-[1px]" />
            <div className="relative h-[320px] w-full max-w-[560px] overflow-hidden rounded-[2.25rem] border border-white/40 bg-white/28 shadow-[0_40px_80px_rgba(135,77,70,0.18)] sm:h-[420px]">
              <Image
                src="/hero-banner.jpg"
                alt="Luxury perfume collection"
                fill
                preload
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.08),rgba(255,230,220,0.14))]" />
            </div>

            <div className="absolute left-0 top-8 hidden max-w-[200px] rounded-[1.75rem] border border-white/50 bg-white/72 p-4 text-left shadow-[0_18px_50px_rgba(135,77,70,0.14)] sm:block">
              <p className="storefront-eyebrow">Fragrance Mood</p>
              <p className="mt-3 font-serif text-2xl text-foreground">Soft floral, warm woods, and polished citrus.</p>
            </div>

            <div className="absolute bottom-4 right-0 hidden max-w-[220px] rounded-[1.75rem] border border-white/50 bg-white/78 p-4 shadow-[0_18px_50px_rgba(135,77,70,0.14)] sm:block">
              <p className="text-sm font-semibold text-foreground">Gift-ready picks</p>
              <p className="mt-2 text-sm leading-6 text-foreground/66">
                Discover scents with elegant wear, refined note transitions, and effortless gifting appeal.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="storefront-eyebrow">Featured Fragrances</p>
              <h2 className="mt-3 text-4xl text-foreground sm:text-5xl">Curated Signatures</h2>
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
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.88fr_1.12fr]">
          <div className="storefront-panel relative min-h-[340px] overflow-hidden rounded-[2rem]">
            <Image
              src="/collections/timeless-classics-banner.jpg"
              alt="Perfume bottles from the Timeless Classics collection"
              fill
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(45,33,36,0.1),rgba(45,33,36,0.24))]" />
          </div>

          <div className="rounded-[2rem] bg-[linear-gradient(180deg,rgba(255,179,153,0.12),rgba(255,240,190,0.34))] p-6 sm:p-8">
            <p className="storefront-eyebrow">Why Choose Us</p>
            <h2 className="mt-3 text-4xl text-foreground sm:text-5xl">A Warmer Way To Shop Perfume</h2>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-foreground/68 sm:text-base">
              Every section is built around fragrance selection, note storytelling, gifting confidence,
              and a checkout experience that stays polished from browse to order tracking.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              {HOME_BENEFITS.map((benefit) => {
                const Icon = benefitIcons[benefit.id]

                return (
                  <article key={benefit.id} className="storefront-panel rounded-[1.5rem] p-5">
                    <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(160deg,#ffd6a6,#ffb399)] text-foreground">
                      <Icon className="h-5 w-5" />
                    </span>
                    <h3 className="mt-4 text-2xl text-foreground">{benefit.title}</h3>
                    <p className="mt-2 text-sm leading-7 text-foreground/64">{benefit.description}</p>
                  </article>
                )
              })}
            </div>
          </div>
        </div>
      </section>

      <section className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="storefront-eyebrow">Best Sellers</p>
              <h2 className="mt-3 text-4xl text-foreground sm:text-5xl">Most-Loved Bottles</h2>
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
        </div>
      </section>

      <section id="reviews" className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="text-center">
            <p className="storefront-eyebrow">Customer Reviews</p>
            <h2 className="mt-3 text-4xl text-foreground sm:text-5xl">What Perfume Buyers Are Saying</h2>
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-3">
            {HOME_TESTIMONIALS.map((testimonial) => (
              <article key={testimonial.name} className="storefront-panel rounded-[2rem] p-7">
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

      <section id="journal" className="px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="mb-8 flex items-end justify-between gap-4">
            <div>
              <p className="storefront-eyebrow">Journal</p>
              <h2 className="mt-3 text-4xl text-foreground sm:text-5xl">Scent Notes And Buying Guides</h2>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-3">
            {HOME_JOURNAL_ENTRIES.map((entry) => (
              <article key={entry.title} className="storefront-panel overflow-hidden rounded-[2rem]">
                <div className="relative h-64">
                  <Image
                    src={entry.image}
                    alt={entry.imageAlt}
                    fill
                    sizes="(min-width: 1024px) 30vw, 100vw"
                    className="object-cover"
                  />
                </div>
                <div className="p-6">
                  <div className="flex items-center gap-3 text-xs uppercase tracking-[0.2em] text-foreground/45">
                    <span>{entry.label}</span>
                    <span className="h-1 w-1 rounded-full bg-foreground/25" />
                    <span>{entry.date}</span>
                  </div>
                  <h3 className="mt-4 text-2xl leading-tight text-foreground">{entry.title}</h3>
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
