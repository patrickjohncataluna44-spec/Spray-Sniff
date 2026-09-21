'use client'

import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { Search, ShoppingBag, Heart, Menu, X, LayoutDashboard, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthMenu } from '@/components/auth-menu'
import { useState, useEffect, useRef, useMemo } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStore } from '@/lib/store-context'
import { SITE_NAME } from '@/lib/site'
import { STOREFRONT_NAV_ITEMS } from '@/lib/storefront-content'
import { formatPHP } from '@/lib/currency'

const QUICK_TAGS = ['Floral', 'Woody', 'Fresh', 'Citrus', 'Vanilla', 'Unisex', '1 Peso']

function resolveNavHref(pathname: string, href: string, kind: 'route' | 'anchor') {
  if (kind === 'route') {
    return href
  }

  return pathname === '/' ? href : `/${href}`
}

function isNavActive(pathname: string, href: string) {
  if (href === '/') {
    return pathname === '/'
  }

  if (href === '/shop') {
    return pathname === '/shop' || pathname.startsWith('/products/')
  }

  return pathname === href
}

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const headerRef = useRef<HTMLElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [mobileSearchQuery, setMobileSearchQuery] = useState('')

  const { user, isAuthenticated, canAccessBackoffice, isLoading, logout } = useAuth()
  const { cartCount, wishlistIds, catalog, getAvailableStock, getInventoryRecord } = useStore()
  const wishlistCount = wishlistIds?.length ?? 0

  // Cmd+K / Ctrl+K keyboard shortcut to open search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setSearchOpen((prev) => !prev)
      } else if (e.key === 'Escape' && searchOpen) {
        setSearchOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [searchOpen])

  // Automatically focus input whenever search opens
  useEffect(() => {
    if (searchOpen) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus()
        searchInputRef.current?.select()
      }, 30)
      return () => clearTimeout(timer)
    }
  }, [searchOpen])

  // Close search when route changes
  useEffect(() => {
    setSearchOpen(false)
    setMobileMenuOpen(false)
  }, [pathname])

  // Close dropdown on click outside header
  useEffect(() => {
    if (!searchOpen) return
    const handleClickOutside = (e: MouseEvent) => {
      if (headerRef.current && !headerRef.current.contains(e.target as Node)) {
        setSearchOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [searchOpen])

  // Filter products live based on search query
  const matchingProducts = useMemo(() => {
    const trimmed = searchQuery.trim().toLowerCase()
    if (!trimmed) return []

    return catalog
      .filter((product) => {
        const record = getInventoryRecord(product.id)
        if (record?.isArchived) return false

        const nameMatch = product.name.toLowerCase().includes(trimmed)
        const brandMatch = product.brand.toLowerCase().includes(trimmed)
        const categoryMatch = product.category?.toLowerCase().includes(trimmed)
        const descMatch = product.description?.toLowerCase().includes(trimmed)
        const scentMatch = product.scentFamily?.some((f) => f.toLowerCase().includes(trimmed))
        const genderMatch = product.gender?.toLowerCase().includes(trimmed)
        const priceMatch = trimmed === '1 peso' || trimmed === '1' ? product.price === 1 : false

        return nameMatch || brandMatch || categoryMatch || descMatch || scentMatch || genderMatch || priceMatch
      })
      .slice(0, 8)
  }, [catalog, getInventoryRecord, searchQuery])

  const featuredProducts = useMemo(() => {
    return catalog
      .filter((p) => !getInventoryRecord(p.id)?.isArchived)
      .slice(0, 3)
  }, [catalog, getInventoryRecord])

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = searchQuery.trim()
    setSearchOpen(false)
    if (trimmed) {
      router.push(`/shop?q=${encodeURIComponent(trimmed)}`)
    } else {
      router.push('/shop')
    }
  }

  const handleMobileMenuSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = mobileSearchQuery.trim()
    setMobileMenuOpen(false)
    if (trimmed) {
      router.push(`/shop?q=${encodeURIComponent(trimmed)}`)
    } else {
      router.push('/shop')
    }
  }

  const handleSelectProduct = (productId: string) => {
    setSearchOpen(false)
    router.push(`/products/${productId}`)
  }

  const openSearch = () => {
    setSearchOpen(true)
    setTimeout(() => {
      searchInputRef.current?.focus()
    }, 20)
  }

  return (
    <header ref={headerRef} className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/95 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
        {searchOpen ? (
          /* ACTIVE EXPANDED SEARCH BAR (Header morphs into search input) */
          <div className="flex h-16 items-center gap-3 sm:h-20 sm:gap-4">
            <Link
              href="/"
              onClick={() => setSearchOpen(false)}
              className="hidden shrink-0 items-center gap-2 sm:flex sm:gap-3"
            >
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(160deg,#ffb399,#ff9a86)] text-sm font-semibold text-white shadow-[0_12px_30px_rgba(255,154,134,0.35)] sm:h-11 sm:w-11">
                SS
              </span>
              <span className="hidden font-serif text-lg leading-tight text-foreground md:block">
                {SITE_NAME}
              </span>
            </Link>

            {/* Main Interactive Search Input */}
            <form onSubmit={handleSearchSubmit} className="relative flex flex-1 items-center">
              <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-primary" />
              <input
                ref={searchInputRef}
                type="text"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search perfumes, brands, scent notes (e.g. Vanilla, Woody, 1 Peso)..."
                className="h-11 w-full rounded-2xl border-2 border-primary/50 bg-white/95 pl-11 pr-11 text-sm font-normal text-foreground shadow-[0_4px_20px_rgba(255,154,134,0.18)] placeholder:text-foreground/45 focus:border-primary focus:outline-none focus:ring-4 focus:ring-primary/15 sm:h-12 sm:text-base"
                aria-label="Search fragrances"
              />
              {searchQuery ? (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('')
                    searchInputRef.current?.focus()
                  }}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-foreground/45 transition hover:bg-muted hover:text-foreground"
                  aria-label="Clear search"
                >
                  <X className="h-4 w-4" />
                </button>
              ) : null}
            </form>

            {/* Search Submit & Cancel Actions */}
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                onClick={handleSearchSubmit}
                className="h-11 rounded-2xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-sm hover:bg-[#ff8a73] sm:px-5 sm:text-sm"
              >
                Search
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setSearchOpen(false)
                  setSearchQuery('')
                }}
                className="h-11 rounded-2xl px-3 text-xs font-medium text-foreground/70 hover:bg-muted hover:text-foreground sm:px-4 sm:text-sm"
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          /* STANDARD NAVIGATION BAR (Search pill + Nav links + Actions) */
          <div className="flex h-16 items-center justify-between gap-3 sm:h-20 lg:grid lg:grid-cols-[auto_1fr_auto] lg:gap-4 xl:gap-6">
            <Link href="/" className="flex shrink-0 items-center gap-2.5 sm:gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[linear-gradient(160deg,#ffb399,#ff9a86)] text-sm font-semibold text-white shadow-[0_12px_30px_rgba(255,154,134,0.35)] sm:h-11 sm:w-11">
                SS
              </span>
              <span className="min-w-0">
                <span className="block whitespace-nowrap font-serif text-lg leading-tight text-foreground sm:text-xl xl:text-2xl">
                  {SITE_NAME}
                </span>
                <span className="hidden text-[10px] uppercase tracking-[0.24em] text-foreground/45 lg:block">
                  Perfume House
                </span>
              </span>
            </Link>

            <div className="hidden min-w-0 justify-center lg:flex">
              <nav className="flex max-w-full items-center gap-1 overflow-x-auto rounded-full border border-border/70 bg-white/65 px-2 py-2 shadow-[0_16px_38px_rgba(145,84,73,0.08)] [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
                {STOREFRONT_NAV_ITEMS.map((item) => {
                  const href = resolveNavHref(pathname, item.href, item.kind)
                  const active = item.kind === 'route' && isNavActive(pathname, item.href)

                  return (
                    <Link
                      key={`${item.kind}-${item.label}`}
                      href={href}
                      className={`shrink-0 whitespace-nowrap rounded-full px-3 py-2 text-[13px] font-medium transition xl:px-4 xl:text-sm ${
                        active
                          ? 'bg-primary text-primary-foreground shadow-[0_10px_24px_rgba(255,154,134,0.3)]'
                          : 'text-foreground/72 hover:bg-muted hover:text-foreground'
                      }`}
                    >
                      {item.label}
                    </Link>
                  )
                })}
              </nav>
            </div>

            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              {/* Clickable Search Bar Pill (Medium & Desktop screens) */}
              <button
                type="button"
                onClick={openSearch}
                className="hidden sm:inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-white/80 px-3.5 py-2.5 text-xs text-foreground/55 shadow-xs transition hover:border-primary/50 hover:bg-white hover:text-foreground lg:px-4"
                title="Search fragrances (Click or press ⌘K to type)"
              >
                <Search className="h-4 w-4 text-foreground/45" />
                <span className="hidden md:inline">Search perfumes, notes...</span>
                <span className="md:hidden">Search...</span>
                <kbd className="hidden rounded-md border border-border/70 bg-muted/60 px-1.5 py-0.5 text-[10px] font-semibold text-foreground/40 xl:inline-block">
                  ⌘K
                </kbd>
              </button>

              {/* Mobile Search Button (Clean, rounded, spaced gracefully on the far right) */}
              <button
                type="button"
                suppressHydrationWarning
                aria-label="Search"
                onClick={openSearch}
                className="inline-flex h-10 items-center gap-2 rounded-2xl border border-border/70 bg-white/85 px-3.5 text-xs font-medium text-foreground/75 shadow-xs transition hover:bg-white hover:border-primary/50 sm:hidden active:scale-95"
                title="Search fragrances"
              >
                <Search className="h-4 w-4 text-primary" />
                <span className="text-[12px] font-medium text-foreground/70">Search</span>
              </button>

              {/* Wishlist Link - Desktop & Tablet only (already in bottom nav on mobile) */}
              <Link
                href="/wishlist"
                aria-label="Wishlist"
                className="relative hidden md:inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-white/75 transition hover:bg-muted sm:h-11 sm:w-11"
              >
                <Heart
                  className={`h-5 w-5 transition-colors ${
                    wishlistCount > 0 ? 'fill-primary text-primary' : 'text-foreground'
                  }`}
                />
                {wishlistCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground shadow-xs animate-in zoom-in-50 duration-200">
                    {wishlistCount}
                  </span>
                )}
              </Link>

              {/* Cart Link - Desktop & Tablet only (already in bottom nav on mobile) */}
              <Link
                href="/cart"
                aria-label="Cart"
                className="relative hidden md:inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-white/75 transition hover:bg-muted sm:h-11 sm:w-11"
              >
                <ShoppingBag className="h-5 w-5 text-foreground" />
                {cartCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                    {cartCount}
                  </span>
                )}
              </Link>

              <div className="ml-1 hidden md:inline-flex">
                <AuthMenu />
              </div>

              {/* Hamburger Button - Tablet only (hidden on mobile because of bottom nav, hidden on desktop because of full navbar) */}
              <button
                type="button"
                suppressHydrationWarning
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="hidden md:inline-flex lg:hidden h-10 w-10 items-center justify-center rounded-2xl border border-border/70 bg-white/75 transition hover:bg-muted sm:h-11 sm:w-11"
                aria-label="Toggle menu"
              >
                <Menu className="h-5 w-5 text-foreground" />
              </button>
            </div>
          </div>
        )}

        {/* LIVE SEARCH RESULTS & SUGGESTIONS DROPDOWN */}
        {searchOpen && (
          <div className="border-t border-border/70 py-4 sm:py-5 animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Quick Scent Tags */}
            <div className="flex flex-wrap items-center gap-1.5 pb-3">
              <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-foreground/45 mr-1">
                Quick Tags:
              </span>
              {QUICK_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  onClick={() => {
                    setSearchQuery(tag)
                    searchInputRef.current?.focus()
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                    searchQuery.toLowerCase() === tag.toLowerCase()
                      ? 'border-primary bg-primary text-primary-foreground shadow-xs'
                      : 'border-border/70 bg-white/80 text-foreground/75 hover:border-primary/50 hover:bg-white hover:text-foreground'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>

            {/* Matching Products or Featured Suggestions */}
            {searchQuery.trim() ? (
              matchingProducts.length > 0 ? (
                <div className="mt-2 space-y-3">
                  <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45">
                    <span>Matching Fragrances ({matchingProducts.length})</span>
                    <span className="text-[11px] font-normal lowercase tracking-normal text-foreground/45">
                      Click any perfume to view details
                    </span>
                  </div>

                  <div className="grid gap-2.5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 max-h-[55vh] overflow-y-auto pr-1">
                    {matchingProducts.map((product) => {
                      const stock = getAvailableStock(product.id)
                      const isOutOfStock = stock <= 0

                      return (
                        <button
                          key={product.id}
                          type="button"
                          onClick={() => handleSelectProduct(product.id)}
                          className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-white/80 p-2.5 text-left transition hover:border-primary/60 hover:bg-white hover:shadow-md"
                        >
                          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-muted/40">
                            {product.images[0] ? (
                              <Image
                                src={product.images[0]}
                                alt={product.name}
                                fill
                                className="object-cover transition-transform duration-200 group-hover:scale-105"
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-[10px] text-foreground/40">
                                Perfume
                              </div>
                            )}
                          </div>

                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs sm:text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                              {product.name}
                            </p>
                            <p className="truncate text-[11px] text-foreground/50">
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

                  <div className="pt-2 flex items-center justify-between border-t border-border/60">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleSearchSubmit}
                      className="h-10 rounded-2xl border-border/70 bg-white/80 px-5 text-xs font-medium text-foreground hover:bg-white hover:border-primary/50"
                    >
                      View all results for &ldquo;{searchQuery}&rdquo; in Shop &rarr;
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="rounded-2xl border border-border/60 bg-white/60 p-6 text-center">
                  <p className="text-sm font-medium text-foreground">
                    No fragrances matched &ldquo;{searchQuery}&rdquo;
                  </p>
                  <p className="mt-1 text-xs text-foreground/50">
                    Try searching for scent notes like &ldquo;Vanilla&rdquo;, &ldquo;Floral&rdquo;, &ldquo;Citrus&rdquo;, or &ldquo;1 Peso&rdquo;.
                  </p>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleSearchSubmit}
                    className="mt-3 h-9 rounded-2xl border-border/70 text-xs"
                  >
                    Search in Shop catalog &rarr;
                  </Button>
                </div>
              )
            ) : (
              <div className="mt-2 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground/45">
                  Popular Fragrances
                </p>
                <div className="grid gap-2.5 sm:grid-cols-3">
                  {featuredProducts.map((product) => (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => handleSelectProduct(product.id)}
                      className="group flex items-center gap-3 rounded-2xl border border-border/60 bg-white/70 p-2.5 text-left transition hover:border-primary/50 hover:bg-white"
                    >
                      <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-xl bg-muted/40">
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
                        <p className="font-mono text-[11px] text-foreground/60">
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

        {/* MOBILE MENU DRAWER (With direct interactive search input) */}
        {mobileMenuOpen && !searchOpen && (
          <nav className="space-y-4 border-t border-border/70 py-4 sm:py-5 lg:hidden">
            {/* Real Search Input inside Mobile Menu Drawer */}
            <form onSubmit={handleMobileMenuSearchSubmit} className="relative">
              <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/45" />
              <input
                type="text"
                value={mobileSearchQuery}
                onChange={(e) => setMobileSearchQuery(e.target.value)}
                placeholder="Search perfumes, brands, notes..."
                className="h-11 w-full rounded-2xl border border-border/70 bg-white/90 pl-11 pr-10 text-sm text-foreground placeholder:text-foreground/45 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                aria-label="Search perfumes in menu"
              />
              {mobileSearchQuery && (
                <button
                  type="button"
                  onClick={() => setMobileSearchQuery('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-foreground/45 hover:bg-muted hover:text-foreground"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </form>

            <div className="grid gap-2 sm:grid-cols-2">
              <Link
                href="/wishlist"
                className="flex items-center justify-between rounded-2xl border border-border/60 bg-white/70 px-4 py-3 text-sm font-medium text-foreground/78 transition hover:bg-muted"
                onClick={() => setMobileMenuOpen(false)}
              >
                <div className="flex items-center gap-2.5">
                  <Heart className={`h-4 w-4 ${wishlistCount > 0 ? 'fill-primary text-primary' : 'text-foreground/70'}`} />
                  <span>Wishlist</span>
                </div>
                {wishlistCount > 0 && (
                  <span className="inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold text-primary-foreground">
                    {wishlistCount}
                  </span>
                )}
              </Link>
              {STOREFRONT_NAV_ITEMS.map((item) => (
                <Link
                  key={`${item.kind}-mobile-${item.label}`}
                  href={resolveNavHref(pathname, item.href, item.kind)}
                  className="rounded-2xl border border-border/60 bg-white/70 px-4 py-3 text-sm font-medium text-foreground/78 transition hover:bg-muted"
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {item.label}
                </Link>
              ))}
            </div>

            {!isLoading && (
              <div className="rounded-[1.75rem] border border-border/70 bg-white/72 p-4 shadow-[0_18px_42px_rgba(145,84,73,0.08)]">
                {isAuthenticated ? (
                  <div className="space-y-3">
                    <div className="rounded-2xl bg-muted/40 px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/90">
                          <User className="h-5 w-5 text-foreground" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-foreground">
                            {user?.name}
                          </p>
                          <p className="truncate text-xs text-foreground/60">
                            {user?.email}
                          </p>
                        </div>
                      </div>
                    </div>

                    {canAccessBackoffice ? (
                      <Button className="h-11 w-full justify-start rounded-2xl" asChild>
                        <Link
                          href="/admin/dashboard"
                          onClick={() => setMobileMenuOpen(false)}
                        >
                          <LayoutDashboard className="h-4 w-4" />
                          {user?.role === 'STAFF' ? 'Staff Dashboard' : 'Admin Dashboard'}
                        </Link>
                      </Button>
                    ) : (
                      <Button variant="outline" className="h-11 w-full justify-start rounded-2xl" asChild>
                        <Link href="/account" onClick={() => setMobileMenuOpen(false)}>
                          <User className="h-4 w-4" />
                          My Account
                        </Link>
                      </Button>
                    )}

                    <Button
                      variant="outline"
                      className="h-11 w-full justify-start rounded-2xl text-red-600 hover:text-red-600"
                      onClick={async () => {
                        setMobileMenuOpen(false)
                        await logout()
                        router.push('/')
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Sign Out
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm leading-6 text-foreground/60">
                      Sign in to save favorites, track perfume orders, and check out faster from any device.
                    </p>
                    <div className="flex flex-col gap-3">
                      <Button className="h-11 w-full rounded-2xl" asChild>
                        <Link href="/auth/signin" onClick={() => setMobileMenuOpen(false)}>
                          Sign In
                        </Link>
                      </Button>
                      <Button variant="outline" className="h-11 w-full rounded-2xl" asChild>
                        <Link href="/auth/signup" onClick={() => setMobileMenuOpen(false)}>
                          Create Account
                        </Link>
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </nav>
        )}
      </div>
    </header>
  )
}
