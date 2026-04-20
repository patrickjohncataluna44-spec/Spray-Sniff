import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'
import { SITE_NAME } from '@/lib/site'

const values = [
  {
    title: 'Curated Selection',
    description:
      'Every featured bottle is chosen to cover a clear mood, occasion, or scent direction instead of overwhelming you with noise.',
  },
  {
    title: 'Note-Led Shopping',
    description:
      'We believe perfume becomes easier to love when shoppers can understand top, heart, and base notes before they commit.',
  },
  {
    title: 'Wearable Luxury',
    description:
      'Our focus is premium-feeling fragrance that fits real routines, real gifting, and real signature-scent habits.',
  },
]

const processSteps = [
  {
    title: 'Sourcing',
    description:
      'We build our assortment around scent families and perfume moods that feel polished, wearable, and giftable.',
  },
  {
    title: 'Curation',
    description:
      'Each fragrance earns its place through composition, wearability, and how clearly it fits the customer journey on site.',
  },
  {
    title: 'Testing',
    description:
      'We look for perfumes that retain character from the first spray through the dry down, not just the opening note.',
  },
  {
    title: 'Presentation',
    description:
      'From product pages to delivery updates, we keep the full perfume-buying experience soft, warm, and easy to revisit.',
  },
]

export default function AboutPage() {
  return (
    <StorefrontShell>
      <StorefrontPageHero
        eyebrow="Our Story"
        title="A Boutique Built Around Perfume"
        description={`${SITE_NAME} is a fragrance-first destination shaped around note storytelling, curated scent families, and premium perfume shopping that still feels warm and approachable.`}
      />

      <section className="px-4 pb-16 pt-2 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="storefront-panel relative min-h-[420px] overflow-hidden rounded-[2rem]">
            <Image
              src="/hero-banner.jpg"
              alt={`${SITE_NAME} perfume story`}
              fill
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(45,33,36,0.08),rgba(45,33,36,0.32))]" />
          </div>

          <div className="space-y-6">
            <article className="storefront-panel rounded-[2rem] p-7 sm:p-9">
              <p className="storefront-eyebrow">Fragrance Philosophy</p>
              <h2 className="mt-3 text-4xl text-foreground">Why {SITE_NAME}</h2>
              <p className="mt-4 text-base leading-8 text-foreground/68 sm:text-lg">
                Spray &amp; Sniff began with one simple belief: perfume should be expressive, memorable,
                and easy to shop when the story behind the scent is clear. We built the store around
                discovery, note education, and wardrobe-ready fragrance edits that feel luxurious without losing warmth.
              </p>
              <p className="mt-4 text-base leading-8 text-foreground/68 sm:text-lg">
                Based in Mabini, our boutique perspective favors polished daily signatures, evening statements,
                and gift-ready bottles that make it easier to choose perfume with confidence.
              </p>
            </article>

            <div className="grid gap-4 sm:grid-cols-3">
              {values.map((value) => (
                <article key={value.title} className="storefront-panel rounded-[1.75rem] p-5">
                  <h3 className="text-2xl text-foreground">{value.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-foreground/62">{value.description}</p>
                </article>
              ))}
            </div>
          </div>
        </div>

        <div className="mx-auto mt-8 max-w-7xl">
          <article className="storefront-panel rounded-[2rem] p-7 sm:p-9">
            <p className="storefront-eyebrow">How We Work</p>
            <h2 className="mt-3 text-4xl text-foreground">From Selection To Delivery</h2>
            <div className="mt-8 grid gap-4 md:grid-cols-2">
              {processSteps.map((step, index) => (
                <div key={step.title} className="rounded-[1.5rem] bg-muted/30 p-5">
                  <p className="text-sm font-semibold uppercase tracking-[0.24em] text-foreground/46">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-3 text-2xl text-foreground">{step.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-foreground/64">{step.description}</p>
                </div>
              ))}
            </div>
            <Button className="mt-8 h-11 rounded-2xl bg-primary px-6 text-primary-foreground hover:bg-[#ff8a73]" asChild>
              <Link href="/shop">Discover Your Scent</Link>
            </Button>
          </article>
        </div>
      </section>
    </StorefrontShell>
  )
}
