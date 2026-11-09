import type { ReactNode } from 'react'

interface StorefrontPageHeroProps {
  eyebrow?: string
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
      <div className="mx-auto max-w-7xl rounded-3xl border border-border/70 bg-[#fffdfa] px-6 py-10 sm:px-12 sm:py-14">
        <div className="max-w-3xl">
          {eyebrow ? (
            <p className="text-sm font-medium text-foreground/60 mb-3">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="font-serif text-3xl leading-tight text-foreground sm:text-5xl lg:text-6xl">
            {title}
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-foreground/70 sm:text-lg">
            {description}
          </p>
        </div>

        {actions ? <div className="mt-8 flex flex-wrap gap-3">{actions}</div> : null}
      </div>
    </section>
  )
}
