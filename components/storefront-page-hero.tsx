import type { ReactNode } from 'react'

interface StorefrontPageHeroProps {
  eyebrow: string
  title: string
  description: string
  actions?: ReactNode
}

export function StorefrontPageHero({
  eyebrow,
  title,
  description,
  actions,
}: StorefrontPageHeroProps) {
  return (
    <section className="px-4 pb-6 pt-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl overflow-hidden rounded-[2.25rem] bg-[linear-gradient(135deg,rgba(255,214,166,0.34),rgba(255,179,153,0.28),rgba(255,255,255,0.85))] px-7 py-10 shadow-[0_24px_70px_rgba(145,84,73,0.12)] sm:px-10 sm:py-12">
        <div className="max-w-3xl">
          <p className="storefront-eyebrow">{eyebrow}</p>
          <h1 className="mt-4 text-5xl leading-tight text-foreground sm:text-6xl">{title}</h1>
          <p className="mt-4 max-w-2xl text-base leading-8 text-foreground/68 sm:text-lg">
            {description}
          </p>
        </div>

        {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  )
}
