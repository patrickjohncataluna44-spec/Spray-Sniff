import Image from 'next/image'
import Link from 'next/link'
import { Droplets, Sparkles, MoveRight, ShieldCheck, HeartHandshake } from 'lucide-react'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'
import { SITE_NAME } from '@/lib/site'

const values = [
  {
    icon: Droplets,
    title: 'Pure Oil Concentration',
    description:
      'We formulate at Eau de Parfum and Extrait strengths so your chosen scent endures from first morning spray to late evening plans.',
  },
  {
    icon: Sparkles,
    title: 'Note-Led Education',
    description:
      'We demystify perfumery by clearly cataloguing top, heart, and base notes before you commit, removing the guesswork from fragrance shopping.',
  },
  {
    icon: HeartHandshake,
    title: 'Mabini Atelier Roots',
    description:
      'Born in Manila’s historic cultural quarter, our boutique blends timeless European formulation methods with an intimate, contemporary local perspective.',
  },
]

const processSteps = [
  {
    step: 'Phase I',
    title: 'Botanical Extraction',
    description:
      'Direct sourcing of high-grade essential oils, absolute resins, and aromatic isolates from sustainable distilleries.',
  },
  {
    step: 'Phase II',
    title: 'Artisanal Maceration',
    description:
      'Blends rest in dark glass maturation vessels for a minimum of 21 days, allowing molecules to bind without heat distortion.',
  },
  {
    step: 'Phase III',
    title: 'Olfactory Balancing',
    description:
      'Every batch undergoes skin testing in tropical conditions to verify projection, sillage, and stability across humidity.',
  },
  {
    step: 'Phase IV',
    title: 'Atelier Bottling & Inspection',
    description:
      'Hand-filled, fitted with micro-mist atomizers, sealed, and packaged with individual fragrance story cards.',
  },
]

export default function AboutPage() {
  return (
    <StorefrontShell>
      <StorefrontPageHero
        title="A Boutique Built Around Perfume"
        description={`${SITE_NAME} is an independent fragrance atelier in Manila dedicated to note storytelling, pure maceration, and signature scents that feel deeply personal.`}
      />

      <section className="px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-12">
          {/* Main Editorial Story */}
          <div className="grid gap-10 rounded-3xl border border-border/80 bg-white p-8 sm:p-12 lg:grid-cols-12 lg:items-center">
            <div className="relative h-[340px] sm:h-[440px] rounded-2xl overflow-hidden lg:col-span-6 bg-neutral-100">
              <Image
                src="/hero-banner.jpg"
                alt={`${SITE_NAME} perfume story`}
                fill
                sizes="(min-width: 1024px) 50vw, 100vw"
                className="object-cover"
              />
            </div>

            <div className="space-y-6 lg:col-span-6">
              <span className="text-xs font-semibold text-primary">
                Our Philosophy
              </span>
              <h2 className="font-serif text-3xl sm:text-4xl text-foreground leading-tight">
                Fragrance Is The Architecture Of Presence
              </h2>
              <p className="text-base text-foreground/75 leading-relaxed">
                Spray &amp; Sniff was founded on the belief that scent is not a cosmetic afterthought, but invisible architecture. A great perfume does not mask who you are; it accentuates your posture, settles into your garments, and lingers in the memories of those who meet you.
              </p>
              <p className="text-base text-foreground/75 leading-relaxed">
                From our boutique in the cultural heart of Mabini, Manila, we curate compositions that balance polished elegance with authentic, daily wearability.
              </p>
              <div className="pt-2">
                <Link
                  href="/shop"
                  className="inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:bg-foreground/85"
                >
                  <span>Explore The Catalog</span>
                  <MoveRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </div>

          {/* Three Pillars */}
          <div className="grid gap-6 sm:grid-cols-3">
            {values.map((value) => {
              const Icon = value.icon
              return (
                <div
                  key={value.title}
                  className="rounded-3xl border border-border/80 bg-[#fffdfa] p-8 space-y-3"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="font-serif text-2xl text-foreground">
                    {value.title}
                  </h3>
                  <p className="text-sm text-foreground/70 leading-relaxed">
                    {value.description}
                  </p>
                </div>
              )
            })}
          </div>

          {/* How We Craft Fragrances */}
          <div className="rounded-3xl border border-border/80 bg-white p-8 sm:p-12">
            <div className="max-w-2xl mb-10">
              <h2 className="font-serif text-3xl sm:text-4xl text-foreground">
                The Four Pillars Of Formulation
              </h2>
              <p className="mt-2 text-base text-foreground/70">
                From distillation to aging, our slow-perfumery process guarantees consistent quality and olfactive clarity.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {processSteps.map((step) => (
                <div
                  key={step.title}
                  className="rounded-2xl border border-border/60 bg-[#fffaf5] p-6 space-y-3"
                >
                  <span className="text-xs font-semibold text-primary">
                    {step.step}
                  </span>
                  <h3 className="font-serif text-xl text-foreground">
                    {step.title}
                  </h3>
                  <p className="text-sm text-foreground/65 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* The Olfactory Pyramid Educational Section */}
          <div className="grid gap-8 rounded-3xl border border-border/80 bg-[#fffdfa] p-8 sm:p-12 lg:grid-cols-12 lg:items-center">
            <div className="lg:col-span-5 space-y-4">
              <h2 className="font-serif text-3xl text-foreground">
                How Fragrance Evolves On Skin
              </h2>
              <p className="text-sm text-foreground/70 leading-relaxed">
                When you spray a Spray &amp; Sniff creation, the perfume unfolds in three distinct acts as heat evaporates lighter molecules and reveals deeper resins.
              </p>
              <div className="pt-2">
                <Link
                  href="/journal"
                  className="text-xs font-semibold text-primary hover:underline"
                >
                  Read our full Fragrance Wardrobe Guide →
                </Link>
              </div>
            </div>

            <div className="lg:col-span-7 space-y-4">
              <div className="rounded-2xl border border-border/70 bg-white p-5">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-lg text-foreground">1. Top Notes</h4>
                  <span className="text-xs text-foreground/50">0 to 30 mins</span>
                </div>
                <p className="text-xs text-foreground/70 mt-1 leading-relaxed">
                  Citrus, aromatic herbs, pink pepper, and green aldehydes that provide an immediate sensory greeting.
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-white p-5">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-lg text-foreground">2. Heart Notes</h4>
                  <span className="text-xs text-foreground/50">1 to 4 hours</span>
                </div>
                <p className="text-xs text-foreground/70 mt-1 leading-relaxed">
                  Rose absolute, white jasmine, clary sage, and warm spices that define the emotional soul of the perfume.
                </p>
              </div>

              <div className="rounded-2xl border border-border/70 bg-white p-5">
                <div className="flex items-center justify-between">
                  <h4 className="font-serif text-lg text-foreground">3. Base Notes</h4>
                  <span className="text-xs text-foreground/50">5 to 10+ hours</span>
                </div>
                <p className="text-xs text-foreground/70 mt-1 leading-relaxed">
                  Sandalwood, bourbon vanilla, labdanum, and clean musk that anchor to your pulse points until the end of the day.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </StorefrontShell>
  )
}
