import Image from 'next/image'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'

const collections = [
  {
    id: 1,
    name: 'Timeless Classics',
    description:
      'Signature perfumes with polished silhouettes, refined woods, and floral trails designed for lasting daily wear.',
    image: '/collections/timeless-classics-banner.jpg',
    imageAlt: 'Timeless Classics luxury fragrance collection',
    featured: true,
  },
  {
    id: 2,
    name: 'Fresh Essence',
    description:
      'Light, sparkling fragrances that bring citrus, green freshness, and easy elegance into your daytime rotation.',
    image: '/collections/fresh-essence-banner.jpg',
    imageAlt: 'Fresh Essence luxury fragrance collection',
    featured: false,
  },
  {
    id: 3,
    name: 'Evening Elegance',
    description:
      'Sophisticated blends for late dinners, formal events, and perfume wardrobes that lean rich and memorable.',
    image: '/collections/evening-elegance-banner.jpg',
    imageAlt: 'Evening Elegance luxury fragrance collection',
    featured: false,
  },
  {
    id: 4,
    name: 'Oriental Dreams',
    description:
      'Warm, sensual compositions layered with spice, amber, and deeper notes for statement fragrance lovers.',
    image: '/collections/oriental-dreams-banner.jpg',
    imageAlt: 'Oriental Dreams luxury fragrance collection',
    featured: false,
  },
]

export default function CollectionsPage() {
  return (
    <StorefrontShell>
      <StorefrontPageHero
        eyebrow="Curated Perfume Stories"
        title="Collections"
        description="Explore fragrance edits shaped around mood, occasion, and scent family so you can shop perfume with more intention."
      />

      <section className="px-4 pb-16 pt-2 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-8">
          {collections.map((collection, index) => (
            <article
              key={collection.id}
              className={`grid items-center gap-8 rounded-[2rem] p-4 sm:p-6 lg:grid-cols-[1.02fr_0.98fr] ${index % 2 === 1 ? 'lg:[&>*:first-child]:order-2' : ''}`}
            >
              <div className="storefront-panel relative min-h-[340px] overflow-hidden rounded-[2rem]">
                <Image
                  src={collection.image}
                  alt={collection.imageAlt}
                  fill
                  className="object-cover"
                  sizes="(min-width: 1024px) 48vw, 100vw"
                />
                <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(45,33,36,0.08),rgba(45,33,36,0.28))]" />
              </div>

              <div className="storefront-panel rounded-[2rem] p-7 sm:p-9">
                {collection.featured ? <p className="storefront-eyebrow">Featured Collection</p> : null}
                <h2 className="mt-3 text-4xl text-foreground sm:text-5xl">{collection.name}</h2>
                <p className="mt-4 text-base leading-8 text-foreground/66 sm:text-lg">
                  {collection.description}
                </p>
                <Button className="mt-8 h-11 rounded-2xl bg-primary px-6 text-primary-foreground hover:bg-[#ff8a73]" asChild>
                  <Link href="/shop">Explore Collection</Link>
                </Button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </StorefrontShell>
  )
}
