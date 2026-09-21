'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowRight, CornerDownLeft, Search, Sparkles, X } from 'lucide-react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { formatPHP } from '@/lib/currency'
import { useStore } from '@/lib/store-context'
import type { Product } from '@/lib/products'

const QUICK_TAGS = ['Floral', 'Woody', 'Fresh', 'Citrus', 'Vanilla', 'Unisex', '1 Peso']

interface SearchModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function SearchModal({ open, onOpenChange }: SearchModalProps) {
  const router = useRouter()
  const { catalog, getAvailableStock, getInventoryRecord } = useStore()
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setQuery('')
      setTimeout(() => {
        inputRef.current?.focus()
      }, 50)
    }
  }, [open])

  // Filter products live based on query
  const matchingProducts = useMemo(() => {
    const trimmed = query.trim().toLowerCase()
    if (!trimmed) return []

    return catalog
      .filter((product) => {
        const record = getInventoryRecord(product.id)
        if (record?.isArchived) return false

        const nameMatch = product.name.toLowerCase().includes(trimmed)
        const brandMatch = product.brand.toLowerCase().includes(trimmed)
        const categoryMatch = product.category.toLowerCase().includes(trimmed)
        const descMatch = product.description.toLowerCase().includes(trimmed)
        const scentMatch = product.scentFamily?.some((f) => f.toLowerCase().includes(trimmed))
        const genderMatch = product.gender?.toLowerCase().includes(trimmed)
        const priceMatch = trimmed === '1 peso' || trimmed === '1' ? product.price === 1 : false

        return nameMatch || brandMatch || categoryMatch || descMatch || scentMatch || genderMatch || priceMatch
      })
      .slice(0, 8)
  }, [catalog, getInventoryRecord, query])

  const featuredProducts = useMemo(() => {
    return catalog
      .filter((p) => !getInventoryRecord(p.id)?.isArchived)
      .slice(0, 3)
  }, [catalog, getInventoryRecord])

  const handleSelectProduct = (productId: string) => {
    onOpenChange(false)
    router.push(`/products/${productId}`)
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = query.trim()
    onOpenChange(false)
    if (trimmed) {
      router.push(`/shop?q=${encodeURIComponent(trimmed)}`)
    } else {
      router.push('/shop')
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        onOpenAutoFocus={(e) => {
          e.preventDefault()
          inputRef.current?.focus()
        }}
        className="max-w-2xl overflow-hidden rounded-[2rem] border border-border/70 bg-white/95 p-0 shadow-[0_25px_60px_rgba(0,0,0,0.18)] backdrop-blur-2xl sm:max-w-2xl"
      >
        {/* Search Input Bar */}
        <form onSubmit={handleSearchSubmit} className="relative border-b border-border/70">
          <div className="flex items-center px-5 py-4 sm:px-6">
            <Search className="h-5 w-5 shrink-0 text-foreground/45" />
            <input
              ref={inputRef}
              type="text"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search perfumes, brands, scent notes (e.g. Vanilla, Woody)..."
              className="ml-3 flex-1 bg-transparent text-base text-foreground placeholder:text-foreground/40 focus:outline-none"
              aria-label="Search perfumes"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="rounded-full p-1 text-foreground/40 hover:bg-muted hover:text-foreground"
                aria-label="Clear search query"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
              <span className="hidden rounded-md border border-border/70 bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold text-foreground/50 sm:inline-block">
                ESC
              </span>
            )}
          </div>
        </form>

        {/* Results / Suggestions Container */}
        <div className="max-h-[60vh] overflow-y-auto p-5 sm:p-6">
          {query.trim() ? (
            matchingProducts.length > 0 ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45">
                  <span>Found {matchingProducts.length} fragrance{matchingProducts.length === 1 ? '' : 's'}</span>
                  <span className="text-[11px] lowercase tracking-normal text-foreground/40">
                    Click to view details
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2">
                  {matchingProducts.map((product) => {
                    const stock = getAvailableStock(product.id)
                    const isOutOfStock = stock <= 0

                    return (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelectProduct(product.id)}
                        className="group flex items-center gap-3.5 rounded-2xl border border-border/60 bg-white/70 p-3 text-left transition hover:border-primary/50 hover:bg-white hover:shadow-md"
                      >
                        <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted/30">
                          {product.images[0] ? (
                            <Image
                              src={product.images[0]}
                              alt={product.name}
                              fill
                              className="object-cover transition-transform duration-300 group-hover:scale-105"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-foreground/40">
                              Perfume
                            </div>
                          )}
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                            {product.name}
                          </p>
                          <p className="truncate text-xs text-foreground/50">
                            {product.brand} · {product.category}
                          </p>
                          <div className="mt-1 flex items-center justify-between">
                            <span className="font-mono text-xs font-bold text-foreground">
                              {formatPHP(product.price)}
                            </span>
                            {isOutOfStock ? (
                              <span className="text-[10px] font-semibold text-destructive">
                                Out of stock
                              </span>
                            ) : (
                              <span className="text-[10px] text-foreground/45">
                                {stock} left
                              </span>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleSearchSubmit}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-primary/20 bg-primary/10 py-3 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white"
                  >
                    <span>View all matching results in Shop</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center">
                <p className="text-base font-semibold text-foreground">No perfumes found</p>
                <p className="mt-1 text-xs text-foreground/50">
                  We couldn&apos;t find any fragrance matching &ldquo;{query}&rdquo;. Try another name or scent note.
                </p>
                <div className="mt-5">
                  <button
                    type="button"
                    onClick={() => {
                      onOpenChange(false)
                      router.push('/shop')
                    }}
                    className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-primary-foreground hover:bg-[#ff8a73]"
                  >
                    Browse All Perfumes in Shop
                  </button>
                </div>
              </div>
            )
          ) : (
            <div className="space-y-6">
              {/* Quick Suggestions / Scent families */}
              <div>
                <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45">
                  <Sparkles className="h-3.5 w-3.5 text-primary" />
                  Popular Scent Notes & Searches
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {QUICK_TAGS.map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      onClick={() => setQuery(tag)}
                      className="rounded-full border border-border/70 bg-white/70 px-3.5 py-1.5 text-xs font-medium text-foreground/75 transition hover:border-primary/60 hover:bg-primary/10 hover:text-primary"
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Featured Fragrances */}
              {featuredProducts.length > 0 && (
                <div className="border-t border-border/60 pt-4">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45">
                    Featured Fragrances
                  </p>
                  <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
                    {featuredProducts.map((product) => (
                      <button
                        key={product.id}
                        type="button"
                        onClick={() => handleSelectProduct(product.id)}
                        className="group flex items-center gap-2.5 rounded-2xl border border-border/60 bg-white/60 p-2 text-left transition hover:border-primary/40 hover:bg-white"
                      >
                        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl bg-muted/30">
                          {product.images[0] && (
                            <Image
                              src={product.images[0]}
                              alt={product.name}
                              fill
                              className="object-cover"
                            />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground group-hover:text-primary">
                            {product.name}
                          </p>
                          <p className="text-[11px] font-mono font-medium text-foreground/60">
                            {formatPHP(product.price)}
                          </p>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer info */}
        <div className="flex items-center justify-between border-t border-border/70 bg-muted/30 px-5 py-3 text-[11px] text-foreground/50">
          <span>Press <kbd className="rounded border border-border/80 bg-white px-1 font-mono">↵ Enter</kbd> to search shop</span>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="hover:text-foreground hover:underline"
          >
            Close
          </button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
