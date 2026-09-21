'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  ChevronRight,
  Compass,
  Heart,
  Home,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  MessageCircle,
  Package,
  Search,
  ShoppingBag,
  Sparkles,
  User,
  WandSparkles,
  X,
} from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { useStore } from '@/lib/store-context'
import { Button } from '@/components/ui/button'

const SCENT_CHIPS = [
  { label: 'Floral', emoji: '🌸', query: 'Floral' },
  { label: 'Woody', emoji: '🌲', query: 'Woody' },
  { label: 'Citrus', emoji: '🍋', query: 'Citrus' },
  { label: 'Fresh', emoji: '🌊', query: 'Fresh' },
  { label: 'Vanilla', emoji: '🍦', query: 'Vanilla' },
  { label: 'Unisex', emoji: '⚖️', query: 'Unisex' },
]

export function MobileBottomNav() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, canAccessBackoffice, logout } = useAuth()
  const { cartCount, wishlistIds, orders } = useStore()
  const wishlistCount = wishlistIds?.length ?? 0

  const [drawerOpen, setDrawerOpen] = useState(false)

  // Listen to external toggle events (e.g. from top header hamburger button)
  useEffect(() => {
    const handleToggle = () => setDrawerOpen((prev) => !prev)
    window.addEventListener('toggle-mobile-drawer', handleToggle)
    return () => window.removeEventListener('toggle-mobile-drawer', handleToggle)
  }, [])

  // Close drawer whenever route changes
  useEffect(() => {
    setDrawerOpen(false)
  }, [pathname])

  // Prevent background scrolling when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [drawerOpen])

  // Close drawer on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [drawerOpen])

  // Compute active / in-transit orders count for authenticated user
  const userOrders = useMemo(() => {
    if (!isAuthenticated || !user) return []
    return orders.filter((order) => {
      if (order.source !== 'ONLINE') return false
      if (user.role === 'USER') return true
      const userEmail = user.email?.toLowerCase().trim()
      return (
        order.customerId === user.id ||
        (userEmail && order.customerEmail.toLowerCase().trim() === userEmail)
      )
    })
  }, [orders, user, isAuthenticated])

  const activeOrdersCount = useMemo(() => {
    return userOrders.filter((order) =>
      ['Pending', 'Processing', 'Shipped', 'In Transit', 'Out for Delivery'].includes(order.status),
    ).length
  }, [userOrders])

  // Do not render bottom nav on admin dashboard pages
  if (pathname?.startsWith('/admin')) {
    return null
  }

  const handleChipClick = (query: string) => {
    setDrawerOpen(false)
    router.push(`/shop?q=${encodeURIComponent(query)}`)
  }

  const handleOpenSupport = () => {
    setDrawerOpen(false)
    window.dispatchEvent(new CustomEvent('open-support-widget'))
  }

  const isHomeActive = pathname === '/'
  const isShopActive = pathname === '/shop' || pathname.startsWith('/products/')
  const isOrdersActive = pathname === '/orders' || pathname === '/track'
  const isCartActive = pathname === '/cart' || pathname === '/checkout'

  return (
    <>
      {/* ── Fixed Bottom Navigation Bar ────────────────────────── */}
      <nav
        aria-label="Mobile Navigation"
        className="fixed bottom-0 inset-x-0 z-40 md:hidden bg-white/95 backdrop-blur-lg border-t border-border/70 shadow-[0_-8px_30px_rgba(0,0,0,0.06)]"
        style={{
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 10px))',
        }}
      >
        <div className="mx-auto flex h-14 max-w-md items-center justify-around px-1">
          {/* 1. Home Tab */}
          <Link
            href="/"
            className={`relative flex flex-1 flex-col items-center justify-center py-1 transition-all duration-200 active:scale-90 ${
              isHomeActive ? 'text-primary font-semibold' : 'text-foreground/55 hover:text-foreground'
            }`}
          >
            <Home
              className={`h-5 w-5 transition-transform duration-200 ${
                isHomeActive ? 'scale-110 text-primary stroke-[2.4] fill-primary/15' : 'stroke-[1.8]'
              }`}
            />
            <span className={`mt-1 text-[10px] tracking-tight ${isHomeActive ? 'text-primary font-bold' : 'text-foreground/60'}`}>
              Home
            </span>
            {isHomeActive && <span className="absolute bottom-0 h-1 w-6 rounded-full bg-primary" />}
          </Link>

          {/* 2. Shop Tab */}
          <Link
            href="/shop"
            className={`relative flex flex-1 flex-col items-center justify-center py-1 transition-all duration-200 active:scale-90 ${
              isShopActive ? 'text-primary font-semibold' : 'text-foreground/55 hover:text-foreground'
            }`}
          >
            <LayoutGrid
              className={`h-5 w-5 transition-transform duration-200 ${
                isShopActive ? 'scale-110 text-primary stroke-[2.4]' : 'stroke-[1.8]'
              }`}
            />
            <span className={`mt-1 text-[10px] tracking-tight ${isShopActive ? 'text-primary font-bold' : 'text-foreground/60'}`}>
              Shop
            </span>
            {isShopActive && <span className="absolute bottom-0 h-1 w-6 rounded-full bg-primary" />}
          </Link>

          {/* 3. Orders Tab (Direct 1-tap access to customer purchases & tracking) */}
          <Link
            href="/orders"
            className={`relative flex flex-1 flex-col items-center justify-center py-1 transition-all duration-200 active:scale-90 ${
              isOrdersActive ? 'text-primary font-semibold' : 'text-foreground/55 hover:text-foreground'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <Package
                className={`h-5 w-5 transition-transform duration-200 ${
                  isOrdersActive ? 'scale-110 text-primary stroke-[2.4] fill-primary/15' : 'stroke-[1.8]'
                }`}
              />
              {activeOrdersCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-2.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-[#f97316] px-1 text-[9px] font-bold text-white shadow-xs animate-in zoom-in-75"
                  style={{ boxShadow: '0 2px 6px rgba(249,115,22,0.4)' }}
                  title={`${activeOrdersCount} active order(s)`}
                >
                  {activeOrdersCount}
                </span>
              )}
            </div>
            <span className={`mt-1 text-[10px] tracking-tight ${isOrdersActive ? 'text-primary font-bold' : 'text-foreground/60'}`}>
              Orders
            </span>
            {isOrdersActive && <span className="absolute bottom-0 h-1 w-6 rounded-full bg-primary" />}
          </Link>

          {/* 4. Cart Tab */}
          <Link
            href="/cart"
            className={`relative flex flex-1 flex-col items-center justify-center py-1 transition-all duration-200 active:scale-90 ${
              isCartActive ? 'text-primary font-semibold' : 'text-foreground/55 hover:text-foreground'
            }`}
          >
            <div className="relative flex items-center justify-center">
              <ShoppingBag
                className={`h-5 w-5 transition-transform duration-200 ${
                  isCartActive ? 'scale-110 text-primary stroke-[2.4]' : 'stroke-[1.8]'
                }`}
              />
              {cartCount > 0 && (
                <span
                  className="absolute -top-1.5 -right-2.5 flex h-4 min-w-[1rem] items-center justify-center rounded-full bg-primary px-1 text-[9px] font-bold text-primary-foreground shadow-xs animate-in zoom-in-75"
                  style={{ boxShadow: '0 2px 6px rgba(255,154,134,0.4)' }}
                >
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </div>
            <span className={`mt-1 text-[10px] tracking-tight ${isCartActive ? 'text-primary font-bold' : 'text-foreground/60'}`}>
              Cart
            </span>
            {isCartActive && <span className="absolute bottom-0 h-1 w-6 rounded-full bg-primary" />}
          </Link>

          {/* 5. Menu Button (Opens the Luxury Slide-Up Bottom Sheet Drawer) */}
          <button
            type="button"
            onClick={() => setDrawerOpen((prev) => !prev)}
            aria-label="Open navigation menu"
            className={`relative flex flex-1 flex-col items-center justify-center py-1 transition-all duration-200 active:scale-90 ${
              drawerOpen ? 'text-primary font-semibold' : 'text-foreground/55 hover:text-foreground'
            }`}
          >
            <div className="relative flex items-center justify-center">
              {drawerOpen ? (
                <X className="h-5 w-5 scale-110 text-primary stroke-[2.4]" />
              ) : (
                <svg
                  className="h-5 w-5 stroke-[2] transition-transform duration-200"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="4" x2="20" y1="6" y2="6" />
                  <line x1="4" x2="20" y1="12" y2="12" />
                  <line x1="4" x2="20" y1="18" y2="18" />
                </svg>
              )}
              {wishlistCount > 0 && !drawerOpen && (
                <span className="absolute -top-1 -right-1.5 h-2 w-2 rounded-full bg-primary animate-pulse" />
              )}
            </div>
            <span className={`mt-1 text-[10px] tracking-tight ${drawerOpen ? 'text-primary font-bold' : 'text-foreground/60'}`}>
              Menu
            </span>
            {drawerOpen && <span className="absolute bottom-0 h-1 w-6 rounded-full bg-primary" />}
          </button>
        </div>
      </nav>

      {/* ── Slide-Up Bottom Sheet Drawer ────────────────────────── */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 md:hidden animate-in fade-in duration-200">
          {/* Backdrop */}
          <button
            type="button"
            aria-label="Close menu drawer backdrop"
            onClick={() => setDrawerOpen(false)}
            className="absolute inset-0 bg-black/50 backdrop-blur-xs transition-opacity"
          />

          {/* Bottom Sheet Modal Container */}
          <div
            className="absolute inset-x-0 bottom-0 flex max-h-[88vh] flex-col rounded-t-[2.25rem] border-t border-white/60 bg-[#fffaf5] shadow-[0_-20px_60px_rgba(0,0,0,0.22)] animate-in slide-in-from-bottom duration-300 ease-out"
            style={{
              paddingBottom: 'max(1.25rem, env(safe-area-inset-bottom, 16px))',
            }}
          >
            {/* Drag handle pill */}
            <div className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full bg-foreground/20" />

            {/* Sheet Header */}
            <div className="flex items-center justify-between px-6 pb-3 pt-2">
              <div>
                <p className="font-serif text-xl font-bold tracking-tight text-foreground">
                  Spray & Sniff
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-foreground/45">
                  Perfume House & Discovery
                </p>
              </div>

              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-border/70 bg-white/80 text-foreground/60 transition hover:bg-white hover:text-foreground"
                aria-label="Close menu"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Sheet Scrollable Body */}
            <div className="flex-1 overflow-y-auto px-5 pb-6 pt-1 space-y-5">
              {/* 1. Profile / Account Card */}
              {isAuthenticated ? (
                <div className="rounded-[1.5rem] border border-border/70 bg-white/85 p-4 shadow-[0_8px_24px_rgba(145,84,73,0.06)]">
                  <div className="flex items-center gap-3.5">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffb399] to-[#ff9a86] text-white font-serif font-bold text-lg shadow-sm">
                      {user?.name?.[0]?.toUpperCase() ?? 'U'}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground">
                          {user?.name}
                        </p>
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                          {user?.role === 'STAFF' ? 'Staff' : user?.role === 'ADMIN' ? 'Admin' : 'Member'}
                        </span>
                      </div>
                      <p className="truncate text-xs text-foreground/55 mt-0.5">
                        {user?.email}
                      </p>
                    </div>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 rounded-xl border-border/70 bg-white/80 text-xs font-semibold text-foreground hover:border-primary/50"
                      asChild
                    >
                      <Link href="/account" onClick={() => setDrawerOpen(false)}>
                        <User className="mr-1.5 h-3.5 w-3.5 text-primary" />
                        Account
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 rounded-xl border-border/70 bg-white/80 text-xs font-semibold text-foreground hover:border-primary/50"
                      asChild
                    >
                      <Link href="/orders" onClick={() => setDrawerOpen(false)}>
                        <Package className="mr-1.5 h-3.5 w-3.5 text-primary" />
                        My Orders
                      </Link>
                    </Button>
                  </div>

                  {canAccessBackoffice && (
                    <Button
                      size="sm"
                      className="mt-2 h-10 w-full rounded-xl bg-slate-900 text-white text-xs font-semibold hover:bg-slate-800"
                      asChild
                    >
                      <Link href="/admin/dashboard" onClick={() => setDrawerOpen(false)}>
                        <LayoutDashboard className="mr-2 h-3.5 w-3.5" />
                        Admin Dashboard
                      </Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div
                  className="rounded-[1.5rem] border border-border/70 p-4"
                  style={{
                    background: 'linear-gradient(135deg, rgba(255,229,222,0.6) 0%, rgba(255,240,190,0.6) 100%)',
                  }}
                >
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">
                    Welcome Guest
                  </p>
                  <p className="mt-1 text-sm font-semibold text-foreground">
                    Sign in to track orders & save favorites
                  </p>
                  <p className="mt-1 text-xs leading-relaxed text-foreground/65">
                    Create an account to track delivery progress and enjoy seamless fragrance shopping.
                  </p>

                  <div className="mt-3.5 flex gap-2">
                    <Button
                      size="sm"
                      className="h-10 flex-1 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-xs hover:bg-[#ff8a73]"
                      asChild
                    >
                      <Link href="/auth/signin" onClick={() => setDrawerOpen(false)}>Sign In</Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-10 flex-1 rounded-xl border-border/70 bg-white/80 text-xs font-semibold text-foreground hover:bg-white"
                      asChild
                    >
                      <Link href="/auth/signup" onClick={() => setDrawerOpen(false)}>Create Account</Link>
                    </Button>
                  </div>
                </div>
              )}

              {/* 2. Wishlist Shortcut */}
              <Link
                href="/wishlist"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center justify-between rounded-2xl border border-border/70 bg-white/80 p-3.5 shadow-xs transition hover:bg-white"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ffe5de] text-primary">
                    <Heart className="h-5 w-5 fill-primary text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">My Wishlist</p>
                    <p className="text-xs text-foreground/50">Your saved perfumes</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {wishlistCount > 0 ? (
                    <span className="rounded-full bg-primary px-2 py-0.5 text-xs font-bold text-primary-foreground">
                      {wishlistCount}
                    </span>
                  ) : (
                    <span className="text-xs text-foreground/45">Empty</span>
                  )}
                  <ChevronRight className="h-4 w-4 text-foreground/40" />
                </div>
              </Link>

              {/* 3. Scent Discovery & Collections */}
              <div className="space-y-2">
                <p className="px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/45">
                  Fragrance Discovery
                </p>
                <div className="grid gap-2">
                  <Link
                    href="/discovery"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center justify-between rounded-2xl border border-border/70 bg-white/80 p-3.5 transition hover:bg-white hover:border-primary/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#fff0be] text-[#8f6b26]">
                        <WandSparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Discovery Quiz</p>
                        <p className="text-xs text-foreground/50">Find your personalized signature scent</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-foreground/40" />
                  </Link>

                  <Link
                    href="/collections"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center justify-between rounded-2xl border border-border/70 bg-white/80 p-3.5 transition hover:bg-white hover:border-primary/50"
                  >
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ffe8d9] text-[#9c624d]">
                        <Sparkles className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">Curated Collections</p>
                        <p className="text-xs text-foreground/50">Editor-picked luxury themes</p>
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-foreground/40" />
                  </Link>
                </div>
              </div>

              {/* 4. Scent Notes Quick Chips */}
              <div className="space-y-2">
                <p className="px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/45">
                  Explore Scent Families
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {SCENT_CHIPS.map((chip) => (
                    <button
                      key={chip.label}
                      type="button"
                      onClick={() => handleChipClick(chip.query)}
                      className="flex items-center justify-center gap-1.5 rounded-xl border border-border/70 bg-white/80 px-2.5 py-2.5 text-xs font-semibold text-foreground/80 shadow-xs transition hover:border-primary/60 hover:bg-white hover:text-primary active:scale-95"
                    >
                      <span className="text-sm">{chip.emoji}</span>
                      <span>{chip.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 5. Help, Tracking & Support */}
              <div className="space-y-2">
                <p className="px-1 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground/45">
                  Customer Care & Support
                </p>
                <div className="space-y-1.5 rounded-2xl border border-border/70 bg-white/80 p-2">
                  <Link
                    href="/track"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium text-foreground/80 transition hover:bg-muted"
                  >
                    <span className="flex items-center gap-2.5">
                      <Package className="h-4 w-4 text-primary" />
                      Track Parcel Delivery
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-foreground/35" />
                  </Link>

                  <Link
                    href="/help/faq"
                    onClick={() => setDrawerOpen(false)}
                    className="flex items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium text-foreground/80 transition hover:bg-muted"
                  >
                    <span className="flex items-center gap-2.5">
                      <Compass className="h-4 w-4 text-primary" />
                      Help & FAQs
                    </span>
                    <ChevronRight className="h-3.5 w-3.5 text-foreground/35" />
                  </Link>

                  <button
                    type="button"
                    onClick={handleOpenSupport}
                    className="flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-xs font-medium text-foreground/80 transition hover:bg-muted"
                  >
                    <span className="flex items-center gap-2.5">
                      <MessageCircle className="h-4 w-4 text-[#FF758C]" />
                      Chat With Live Support Bot
                    </span>
                    <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[9px] font-bold text-emerald-700">
                      Online
                    </span>
                  </button>
                </div>
              </div>

              {/* 6. Dedicated Bottom Sign Out (Native App Style) */}
              {user && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setDrawerOpen(false)
                      await logout()
                      router.push('/')
                    }}
                    className="flex w-full items-center justify-center gap-2 rounded-2xl border border-rose-200/80 bg-rose-50/70 p-3.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100/80 active:scale-[0.98] cursor-pointer"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>Sign Out of Account</span>
                  </button>
                </div>
              )}

              {/* Version & Brand Footer */}
              <div className="pt-2 pb-1 text-center">
                <p className="text-[10px] text-foreground/40 uppercase tracking-widest font-medium">
                  Spray &amp; Sniff &bull; Luxury Fragrance House v1.0
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
