import Image from 'next/image'
import Link from 'next/link'
import { MoveRight } from 'lucide-react'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'

const collections = [
  {
    id: 1,
    name: 'Timeless Classics',
    subtitle: 'Signature Woods & Resilient Florals',
    description:
      'Signature perfumes with polished silhouettes, refined woods, and floral trails designed for lasting daily wear and distinguished presence.',
    notes: 'Bergamot · Damask Rose · Aged Sandalwood · Clean Musk',
    occasion: 'Daily Signature, Executive, Evening Gathering',
    image: '/collections/timeless-classics-banner.jpg',
    imageAlt: 'Timeless Classics luxury fragrance collection',
    featured: true,
  },
  {
    id: 2,
    name: 'Fresh Essence',
    subtitle: 'Dewy Botanicals & Morning Citrus',
    description:
      'Light, sparkling fragrances that bring citrus, green freshness, and easy elegance into your daytime rotation. Formulated with airy sillage that refreshes the senses.',
    notes: 'Italian Lemon · Neroli · Magnolia · Coastal Pine',
    occasion: 'Morning Rituals, Warm Weather, Weekend Strolls',
    image: '/collections/fresh-essence-banner.jpg',
    imageAlt: 'Fresh Essence luxury fragrance collection',
    featured: false,
  },
  {
    id: 3,
    name: 'Evening Elegance',
    subtitle: 'Dark Florals, Amber & Smoky Resins',
    description:
      'Sophisticated blends for late dinners, formal events, and perfume wardrobes that lean rich and memorable. Formulated as high-concentration Extraits.',
    notes: 'Black Currant · Iris Absolute · Amber Resins · Vetiver',
    occasion: 'Intimate Dinners, Galas, Midnight Conversation',
    image: '/collections/evening-elegance-banner.jpg',
    imageAlt: 'Evening Elegance luxury fragrance collection',
    featured: false,
  },
  {
    id: 4,
    name: 'Oriental Dreams',
    subtitle: 'Warm Spices & Bourbon Vanilla',
    description:
      'Warm, sensual compositions layered with crushed cardamom, cinnamon bark, and deep balsamic resins for statement fragrance lovers.',
    notes: 'Cardamom · Nutmeg · Labdanum · Bourbon Vanilla',
    occasion: 'Cold Weather, Date Nights, Celebrations',
    image: '/collections/oriental-dreams-banner.jpg',
    imageAlt: 'Oriental Dreams luxury fragrance collection',
    featured: false,
  },
]

export default function CollectionsPage() {
  return (
    <StorefrontShell>
      <StorefrontPageHero
        title="Curated Collections"
        description="Explore fragrance edits shaped around mood, occasion, and olfactory family so you can discover perfume with intention."
      />

      <section className="px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-12">
          {collections.map((collection, index) => (
            <article
              key={collection.id}
              className="overflow-hidden rounded-3xl border border-border/80 bg-white"
            >
              <div className={`grid lg:grid-cols-12 lg:items-center ${index % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''}`}>
                {/* Visual Editorial Image */}
                <div className="relative h-[300px] sm:h-[400px] lg:h-[480px] lg:col-span-7 bg-neutral-100 overflow-hidden">
                  <Image
                    src={collection.image}
                    alt={collection.imageAlt}
                    fill
                    className="object-cover"
                    sizes="(min-width: 1024px) 58vw, 100vw"
                  />
                </div>

                {/* Editorial Story */}
                <div className="p-8 sm:p-12 lg:col-span-5 space-y-6">
                  <div>
                    {collection.featured && (
                      <span className="inline-block rounded-full bg-primary/15 text-primary text-xs font-semibold px-3 py-1 mb-3">
                        Featured Atelier Edit
                      </span>
                    )}
                    <h2 className="font-serif text-3xl sm:text-4xl text-foreground">
                      {collection.name}
                    </h2>
                    <p className="text-sm font-medium text-foreground/60 mt-1">
                      {collection.subtitle}
                    </p>
                  </div>

                  <p className="text-base text-foreground/75 leading-relaxed">
                    {collection.description}
                  </p>

                  <div className="space-y-3 pt-2 text-xs text-foreground/70">
                    <div>
                      <span className="font-semibold text-foreground">Accords: </span>
                      <span>{collection.notes}</span>
                    </div>
                    <div>
                      <span className="font-semibold text-foreground">Occasions: </span>
                      <span>{collection.occasion}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <Link
                      href={`/shop?search=${encodeURIComponent(collection.name.split(' ')[0])}`}
                      className="inline-flex items-center gap-2 rounded-xl bg-foreground px-6 py-3 text-sm font-semibold text-background transition hover:bg-foreground/85"
                    >
                      <span>Explore {collection.name}</span>
                      <MoveRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </StorefrontShell>
  )
}
