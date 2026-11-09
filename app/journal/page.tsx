'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { BookOpen, Calendar, Clock, MoveRight, User, X } from 'lucide-react'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'
import { Button } from '@/components/ui/button'
import {
  STOREFRONT_JOURNAL_ARTICLES,
  type StorefrontJournalArticle,
} from '@/lib/storefront-content'

export default function JournalPage() {
  const [activeArticle, setActiveArticle] = useState<StorefrontJournalArticle | null>(null)

  return (
    <StorefrontShell>
      <StorefrontPageHero
        title="The Scent Journal"
        description="Fragrance education, olfactory styling, and perfumery craft essays from our Mabini editorial desk."
      />

      <section className="px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-12">
          {/* Featured Article Hero Spread */}
          {STOREFRONT_JOURNAL_ARTICLES[0] && (
            <article className="overflow-hidden rounded-3xl border border-border/80 bg-white">
              <div className="grid lg:grid-cols-12 lg:items-center">
                <div className="relative h-[320px] sm:h-[440px] lg:col-span-7 bg-neutral-100">
                  <Image
                    src={STOREFRONT_JOURNAL_ARTICLES[0].image}
                    alt={STOREFRONT_JOURNAL_ARTICLES[0].imageAlt}
                    fill
                    priority
                    sizes="(min-width: 1024px) 58vw, 100vw"
                    className="object-cover"
                  />
                </div>

                <div className="p-8 sm:p-12 lg:col-span-5 space-y-4">
                  <div className="flex items-center gap-3 text-xs text-foreground/50">
                    <span className="font-semibold text-primary">
                      {STOREFRONT_JOURNAL_ARTICLES[0].category}
                    </span>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {STOREFRONT_JOURNAL_ARTICLES[0].readTime}
                    </span>
                  </div>

                  <h2 className="font-serif text-3xl sm:text-4xl text-foreground leading-tight">
                    {STOREFRONT_JOURNAL_ARTICLES[0].title}
                  </h2>

                  <p className="text-base text-foreground/75 leading-relaxed">
                    {STOREFRONT_JOURNAL_ARTICLES[0].excerpt}
                  </p>

                  <div className="pt-2">
                    <Button
                      onClick={() => setActiveArticle(STOREFRONT_JOURNAL_ARTICLES[0])}
                      className="rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-[#ff8a73] cursor-pointer"
                    >
                      <span>Read Full Essay</span>
                      <MoveRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </article>
          )}

          {/* Grid of Journal Articles */}
          <div>
            <h3 className="font-serif text-2xl text-foreground mb-6">
              Recent Fragrance Guides
            </h3>

            <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
              {STOREFRONT_JOURNAL_ARTICLES.map((article) => (
                <article
                  key={article.id}
                  className="group flex flex-col justify-between overflow-hidden rounded-3xl border border-border/80 bg-white"
                >
                  <div>
                    <div className="relative h-[220px] w-full overflow-hidden bg-neutral-100">
                      <Image
                        src={article.image}
                        alt={article.imageAlt}
                        fill
                        sizes="(min-width: 768px) 33vw, 100vw"
                        className="object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                    </div>

                    <div className="p-6">
                      <div className="flex items-center gap-2 text-xs text-foreground/50 mb-2">
                        <span>{article.category}</span>
                        <span>·</span>
                        <span>{article.readTime}</span>
                      </div>

                      <h4 className="font-serif text-xl text-foreground leading-snug group-hover:text-primary transition">
                        {article.title}
                      </h4>

                      <p className="mt-3 text-sm text-foreground/65 leading-relaxed">
                        {article.excerpt}
                      </p>
                    </div>
                  </div>

                  <div className="p-6 pt-0 mt-4 flex items-center justify-between">
                    <span className="text-xs text-foreground/50">{article.date}</span>
                    <button
                      type="button"
                      onClick={() => setActiveArticle(article)}
                      className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:underline cursor-pointer"
                    >
                      <span>Read Story</span>
                      <MoveRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </div>

          {/* Reading Modal */}
          {activeArticle && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 overflow-y-auto">
              <div className="relative my-8 w-full max-w-2xl rounded-3xl border border-border/80 bg-white p-6 sm:p-10 max-h-[90vh] overflow-y-auto">
                <button
                  type="button"
                  onClick={() => setActiveArticle(null)}
                  className="absolute right-5 top-5 rounded-full p-1.5 text-foreground/50 hover:text-foreground cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>

                <div className="flex items-center gap-2 text-xs text-foreground/50 mb-3">
                  <span className="text-primary font-semibold">{activeArticle.category}</span>
                  <span>·</span>
                  <span>{activeArticle.readTime}</span>
                  <span>·</span>
                  <span>By {activeArticle.author}</span>
                </div>

                <h2 className="font-serif text-3xl sm:text-4xl text-foreground leading-tight">
                  {activeArticle.title}
                </h2>

                <div className="relative my-6 h-[240px] w-full rounded-2xl overflow-hidden bg-neutral-100">
                  <Image
                    src={activeArticle.image}
                    alt={activeArticle.imageAlt}
                    fill
                    className="object-cover"
                  />
                </div>

                <div className="space-y-4 text-base text-foreground/80 leading-relaxed font-sans">
                  {activeArticle.content.map((paragraph, idx) => (
                    <p key={idx}>{paragraph}</p>
                  ))}
                </div>

                {activeArticle.relatedScents?.length > 0 && (
                  <div className="mt-8 pt-6">
                    <p className="text-xs font-semibold text-foreground/70 mb-2">
                      Featured Fragrances In This Guide
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {activeArticle.relatedScents.map((scent) => (
                        <Link
                          key={scent}
                          href="/shop"
                          onClick={() => setActiveArticle(null)}
                          className="rounded-xl border border-border/80 bg-[#fffaf5] px-3.5 py-1.5 text-xs font-semibold text-foreground hover:border-primary"
                        >
                          {scent} →
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </StorefrontShell>
  )
}

