'use client'

import { useState } from 'react'
import Link from 'next/link'
import { CheckCircle2, MessageSquarePlus, MoveRight, Star, ThumbsUp, X } from 'lucide-react'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'
import { Button } from '@/components/ui/button'
import { STOREFRONT_TESTIMONIALS } from '@/lib/storefront-content'

const BOTTLE_FILTERS = [
  'All Bottles',
  'Midnight Elegance',
  'Forest Trail',
  'Dawn Light',
  'Velvet Spice',
  'Silk Dreams',
  'Golden Hour',
]

export default function ReviewsPage() {
  const [selectedBottle, setSelectedBottle] = useState('All Bottles')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  // Form states
  const [authorName, setAuthorName] = useState('')
  const [productName, setProductName] = useState('Midnight Elegance')
  const [rating, setRating] = useState(5)
  const [longevity, setLongevity] = useState('8-10 hours')
  const [reviewText, setReviewText] = useState('')

  const filteredReviews =
    selectedBottle === 'All Bottles'
      ? STOREFRONT_TESTIMONIALS
      : STOREFRONT_TESTIMONIALS.filter((r) => r.productName === selectedBottle)

  const handleSubmitReview = (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitted(true)
    setTimeout(() => {
      setIsModalOpen(false)
      setSubmitted(false)
      setAuthorName('')
      setReviewText('')
    }, 2000)
  }

  return (
    <StorefrontShell>
      <StorefrontPageHero
        title="Customer Reviews"
        description="Authentic wear experiences, longevity reports, and olfactive impressions from verified fragrance collectors."
      />

      <section className="px-4 pb-20 pt-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl space-y-10">
          {/* Top Metrics Banner */}
          <div className="grid gap-6 rounded-3xl border border-border/80 bg-white p-8 sm:p-10 lg:grid-cols-12 lg:items-center">
            {/* Score */}
            <div className="lg:col-span-4 text-center lg:text-left space-y-2">
              <div className="flex items-center justify-center lg:justify-start gap-2">
                <span className="font-serif text-5xl font-bold text-foreground">4.8</span>
                <span className="text-xl text-foreground/40">/ 5.0</span>
              </div>
              <div className="flex items-center justify-center lg:justify-start gap-1 text-primary">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-current" />
                ))}
              </div>
              <p className="text-xs text-foreground/60">
                Based on 850+ verified collector purchases across the Philippines
              </p>
            </div>

            {/* Performance Stats */}
            <div className="lg:col-span-5 grid grid-cols-2 gap-4 py-6 lg:py-0 lg:px-8">
              <div>
                <p className="text-2xl font-serif text-foreground">8.2 hrs</p>
                <p className="text-xs text-foreground/60 mt-0.5">Average Skin Longevity</p>
              </div>
              <div>
                <p className="text-2xl font-serif text-foreground">96%</p>
                <p className="text-xs text-foreground/60 mt-0.5">Would Recommend to a Friend</p>
              </div>
            </div>

            {/* Action */}
            <div className="lg:col-span-3 text-center lg:text-right">
              <Button
                onClick={() => setIsModalOpen(true)}
                className="h-12 rounded-xl bg-primary px-6 text-sm font-semibold text-primary-foreground hover:bg-[#ff8a73] cursor-pointer"
              >
                <MessageSquarePlus className="mr-2 h-4 w-4" />
                Write A Review
              </Button>
            </div>
          </div>

          {/* Bottle Filter Chips */}
          <div className="flex items-center gap-2 overflow-x-auto pb-2">
            {BOTTLE_FILTERS.map((bottle) => {
              const active = selectedBottle === bottle
              return (
                <button
                  key={bottle}
                  type="button"
                  onClick={() => setSelectedBottle(bottle)}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                    active
                      ? 'bg-foreground text-background'
                      : 'border border-border/80 bg-white text-foreground hover:border-primary/60'
                  }`}
                >
                  {bottle}
                </button>
              )
            })}
          </div>

          {/* Reviews Grid */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredReviews.map((review) => (
              <article
                key={review.id}
                className="flex flex-col justify-between rounded-3xl border border-border/80 bg-white p-7"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-4">
                    <div className="flex text-primary">
                      {Array.from({ length: review.rating }).map((_, i) => (
                        <Star key={i} className="h-4 w-4 fill-current" />
                      ))}
                    </div>
                    <span className="text-xs text-foreground/50">{review.date}</span>
                  </div>

                  <p className="font-serif text-base text-foreground/85 leading-relaxed italic">
                    &ldquo;{review.quote}&rdquo;
                  </p>
                </div>

                <div className="mt-6 pt-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm text-foreground">{review.name}</p>
                        {review.verified && (
                          <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                        )}
                      </div>
                      <p className="text-xs text-foreground/50">{review.role}</p>
                    </div>
                    <span className="text-xs text-foreground/60 bg-[#fffaf5] px-2.5 py-1 rounded-md border border-border/60">
                      {review.longevity}
                    </span>
                  </div>

                  <div className="pt-1 flex items-center justify-between text-xs">
                    <span className="font-semibold text-primary">{review.productName}</span>
                    <span className="text-foreground/45 flex items-center gap-1">
                      <ThumbsUp className="h-3 w-3" /> Helpful
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>

          {/* Interactive Review Modal */}
          {isModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
              <div className="relative w-full max-w-lg rounded-3xl border border-border/80 bg-white p-8">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="absolute right-5 top-5 rounded-full p-1 text-foreground/50 hover:text-foreground cursor-pointer"
                >
                  <X className="h-5 w-5" />
                </button>

                <h3 className="font-serif text-2xl text-foreground">
                  Share Your Olfactive Experience
                </h3>
                <p className="text-xs text-foreground/60 mt-1">
                  Your impressions help other fragrance collectors find their match.
                </p>

                {submitted ? (
                  <div className="my-8 rounded-2xl bg-[#fff7f1] p-6 text-center text-sm font-semibold text-foreground">
                    Thank you! Your verified review has been submitted for publication.
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReview} className="mt-6 space-y-4">
                    <div>
                      <label className="text-xs font-semibold text-foreground/70 block mb-1">
                        Your Name
                      </label>
                      <input
                        type="text"
                        required
                        value={authorName}
                        onChange={(e) => setAuthorName(e.target.value)}
                        placeholder="e.g. Maria Clara"
                        className="h-10 w-full rounded-xl border border-border px-3 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-foreground/70 block mb-1">
                        Fragrance Reviewed
                      </label>
                      <select
                        value={productName}
                        onChange={(e) => setProductName(e.target.value)}
                        className="h-10 w-full rounded-xl border border-border px-3 text-sm focus:border-primary focus:outline-none"
                      >
                        {BOTTLE_FILTERS.slice(1).map((b) => (
                          <option key={b} value={b}>{b}</option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-xs font-semibold text-foreground/70 block mb-1">
                          Rating (Stars)
                        </label>
                        <select
                          value={rating}
                          onChange={(e) => setRating(Number(e.target.value))}
                          className="h-10 w-full rounded-xl border border-border px-3 text-sm focus:border-primary focus:outline-none"
                        >
                          <option value={5}>5 Stars - Exceptional</option>
                          <option value={4}>4 Stars - Very Good</option>
                          <option value={3}>3 Stars - Average</option>
                        </select>
                      </div>

                      <div>
                        <label className="text-xs font-semibold text-foreground/70 block mb-1">
                          Wear Longevity
                        </label>
                        <select
                          value={longevity}
                          onChange={(e) => setLongevity(e.target.value)}
                          className="h-10 w-full rounded-xl border border-border px-3 text-sm focus:border-primary focus:outline-none"
                        >
                          <option value="10+ hours">10+ hours</option>
                          <option value="8-10 hours">8-10 hours</option>
                          <option value="6-8 hours">6-8 hours</option>
                          <option value="4-6 hours">4-6 hours</option>
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="text-xs font-semibold text-foreground/70 block mb-1">
                        Your Review &amp; Note Impressions
                      </label>
                      <textarea
                        required
                        rows={4}
                        value={reviewText}
                        onChange={(e) => setReviewText(e.target.value)}
                        placeholder="Describe the opening, the projection, and how it settled on your skin..."
                        className="w-full rounded-xl border border-border p-3 text-sm focus:border-primary focus:outline-none"
                      />
                    </div>

                    <div className="pt-2 flex justify-end gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setIsModalOpen(false)}
                        className="rounded-xl border-border text-xs"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="rounded-xl bg-primary px-6 text-xs font-semibold text-primary-foreground hover:bg-[#ff8a73]"
                      >
                        Submit Review
                      </Button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </StorefrontShell>
  )
}

