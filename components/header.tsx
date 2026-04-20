'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { Search, ShoppingBag, Heart, Menu, X, LayoutDashboard, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { AuthMenu } from '@/components/auth-menu'
import { useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import { useStore } from '@/lib/store-context'
import { SITE_NAME } from '@/lib/site'
import { STOREFRONT_NAV_ITEMS } from '@/lib/storefront-content'

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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const { user, isAuthenticated, canAccessBackoffice, isLoading, logout } = useAuth()
  const { cartCount } = useStore()

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/82 backdrop-blur-xl">
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
        <div className="grid h-20 grid-cols-[auto_1fr_auto] items-center gap-4 xl:gap-6">
          <Link href="/" className="flex min-w-0 shrink-0 items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(160deg,#ffb399,#ff9a86)] text-sm font-semibold text-white shadow-[0_12px_30px_rgba(255,154,134,0.35)]">
              SS
            </span>
            <span className="min-w-0">
              <span className="block font-serif text-lg text-foreground sm:text-xl xl:text-2xl">
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

          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              suppressHydrationWarning
              aria-label="Search"
              onClick={() => router.push('/shop')}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-white/75 transition hover:bg-muted"
            >
              <Search className="h-5 w-5 text-foreground" />
            </button>

            <Link
              href="/wishlist"
              aria-label="Wishlist"
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-white/75 transition hover:bg-muted"
            >
              <Heart className="h-5 w-5 text-foreground" />
            </Link>

            <Link
              href="/cart"
              aria-label="Cart"
              className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-white/75 transition hover:bg-muted"
            >
              <ShoppingBag className="h-5 w-5 text-foreground" />
              {cartCount > 0 && (
                <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {cartCount}
                </span>
              )}
            </Link>

            <div className="ml-1 hidden sm:inline-flex">
              <AuthMenu />
            </div>

            <button
              type="button"
              suppressHydrationWarning
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-border/70 bg-white/75 transition hover:bg-muted lg:hidden"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5 text-foreground" />
              ) : (
                <Menu className="h-5 w-5 text-foreground" />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <nav className="space-y-4 border-t border-border/70 py-5 lg:hidden">
            <div className="grid gap-2 sm:grid-cols-2">
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
