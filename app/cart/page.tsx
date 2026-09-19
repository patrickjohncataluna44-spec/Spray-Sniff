'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/lib/auth-context'
import { formatPHP } from '@/lib/currency'
import { useStore } from '@/lib/store-context'
import { isPaymentTestCart } from '@/lib/store-engine'
import { toast } from '@/hooks/use-toast'

const CHECKOUT_SIGN_IN_HREF = '/auth/signin?redirectTo=%2Fcheckout&reason=checkout'

function CartQuantityInput({
  quantity,
  maxStock,
  onChange,
}: {
  quantity: number
  maxStock: number
  onChange: (nextQuantity: number) => void
}) {
  const [val, setVal] = useState(String(quantity))

  useEffect(() => {
    setVal(String(quantity))
  }, [quantity])

  const commit = (inputStr: string) => {
    const parsed = parseInt(inputStr, 10)
    if (isNaN(parsed) || parsed < 1) {
      setVal('1')
      onChange(1)
    } else {
      const clamped = Math.min(Math.max(1, parsed), Math.max(1, maxStock))
      setVal(String(clamped))
      if (clamped !== quantity) {
        onChange(clamped)
      }
    }
  }

  return (
    <div className="inline-flex items-center gap-1 rounded-2xl border border-border/70 bg-white/75 p-1">
      <button
        type="button"
        onClick={() => onChange(Math.max(1, quantity - 1))}
        disabled={quantity <= 1}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Decrease quantity"
      >
        -
      </button>
      <input
        type="number"
        min={1}
        max={Math.max(1, maxStock)}
        value={val}
        onChange={(e) => {
          setVal(e.target.value)
          const parsed = parseInt(e.target.value, 10)
          if (!isNaN(parsed) && parsed >= 1 && parsed <= maxStock) {
            onChange(parsed)
          }
        }}
        onBlur={(e) => commit(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            commit(val)
            ;(e.target as HTMLInputElement).blur()
          }
        }}
        className="w-12 text-center font-semibold text-foreground bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-accent rounded-lg py-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
        aria-label="Quantity"
      />
      <button
        type="button"
        onClick={() => onChange(Math.min(Math.max(1, maxStock), quantity + 1))}
        disabled={maxStock <= 0 || quantity >= maxStock}
        className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        aria-label="Increase quantity"
      >
        +
      </button>
    </div>
  )
}

export default function CartPage() {
  const {
    cart,
    getAvailabilityStatus,
    getAvailableStock,
    getInventoryRecord,
    getProductById,
    isStoreLoading,
    removeFromCart,
    updateCartQuantity,
  } = useStore()
  const { isAuthenticated, isLoading: authLoading } = useAuth()

  const subtotal = cart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const isTestCart = isPaymentTestCart(cart)
  const tax = isTestCart ? 0 : subtotal * 0.12
  const shipping = isTestCart ? 0 : subtotal >= 400 || subtotal === 0 ? 0 : 75
  const total = subtotal + tax + shipping
  const checkoutHref = isAuthenticated ? '/checkout' : CHECKOUT_SIGN_IN_HREF
  const hasUnavailableItems = cart.some((item) => {
    const record = getInventoryRecord(item.productId)
    const availableStock = getAvailableStock(item.productId)

    return !record || record.isArchived || availableStock < item.quantity
  })

  const handleQuantityChange = async (productId: string, size: number, nextQuantity: number) => {
    const result = await updateCartQuantity(productId, size, nextQuantity)

    if (!result.ok) {
      toast({
        title: 'Cart update failed',
        description: result.message,
        variant: 'destructive',
      })
    }
  }

  if (authLoading || isStoreLoading) {
    return (
      <StorefrontShell>
        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto flex min-h-[36vh] max-w-3xl items-center justify-center">
            <div className="flex items-center gap-3 text-foreground/70">
              <Spinner className="h-5 w-5" />
              <p>{authLoading ? 'Checking your account...' : 'Loading your cart...'}</p>
            </div>
          </div>
        </section>
      </StorefrontShell>
    )
  }

  if (cart.length === 0) {
    return (
      <StorefrontShell>
        <StorefrontPageHero
          eyebrow="Shopping Bag"
          title="Your cart is empty"
          description="Add a few fragrance picks to your bag and come back when you are ready to check out."
        />

        <section className="px-4 pb-16 pt-2 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl">
            <div className="storefront-panel rounded-[2rem] p-12 text-center">
              <Button className="h-11 rounded-2xl bg-primary px-6 text-primary-foreground hover:bg-[#ff8a73]" asChild>
                <Link href="/shop">Continue Shopping</Link>
              </Button>
            </div>
          </div>
        </section>
      </StorefrontShell>
    )
  }

  return (
    <StorefrontShell>
      <StorefrontPageHero
        eyebrow="Shopping Bag"
        title="Your Fragrance Cart"
        description="Review sizes, quantities, and delivery totals before you move into checkout."
      />

      <section className="px-4 pb-16 pt-2 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="space-y-5">
            {cart.map((item) => {
              const product = getProductById(item.productId)
              if (!product) {
                return null
              }

              const availability = getAvailabilityStatus(product.id)
              const availableStock = getAvailableStock(product.id)
              const isArchived = getInventoryRecord(product.id)?.isArchived ?? false

              return (
                <article
                  key={`${item.productId}-${item.size}`}
                  className="storefront-panel flex flex-col gap-5 rounded-[2rem] p-5 sm:flex-row sm:items-start sm:p-6"
                >
                  <div className="relative w-full overflow-hidden rounded-[1.5rem] bg-muted/30 sm:w-32 sm:flex-shrink-0" style={{ height: '128px', minHeight: '128px' }}>
                    <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <Link href={`/products/${product.id}`} className="transition hover:text-primary">
                          <h2 className="text-3xl leading-tight text-foreground">{product.name}</h2>
                        </Link>
                        <p className="mt-1 text-sm uppercase tracking-[0.18em] text-foreground/42">
                          {item.size}ml
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => void removeFromCart(item.productId, item.size)}
                        className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-red-200 bg-red-50 text-red-500 transition hover:bg-red-100"
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <p className="mt-4 text-sm leading-7 text-foreground/62">
                      {isArchived
                        ? 'This fragrance has been archived and cannot be checked out.'
                        : availability === 'Low Stock'
                          ? `Low stock: only ${availableStock} left`
                          : availability === 'Out of Stock'
                            ? 'Out of stock now. Adjust quantity before checkout.'
                            : `${availableStock} unit(s) currently available`}
                    </p>

                    <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                      <CartQuantityInput
                        quantity={item.quantity}
                        maxStock={availableStock}
                        onChange={(next) => void handleQuantityChange(item.productId, item.size, next)}
                      />

                      <div className="text-left sm:text-right">
                        <p className="text-3xl text-foreground">{formatPHP(item.unitPrice * item.quantity)}</p>
                        <p className="mt-1 text-sm text-foreground/54">{formatPHP(item.unitPrice)} each</p>
                      </div>
                    </div>
                  </div>
                </article>
              )
            })}
          </div>

          <aside className="storefront-panel sticky top-28 h-fit rounded-[2rem] p-6 sm:p-7">
            <p className="storefront-eyebrow">Order Summary</p>
            <h2 className="mt-3 text-3xl text-foreground">Ready For Checkout</h2>

            <div className="mt-6 space-y-2.5 text-xs">
              <div className="flex justify-between items-center text-foreground/70">
                <span className="text-foreground/60">Price (Subtotal)</span>
                <span className="font-mono font-medium text-foreground">{formatPHP(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-foreground/70">
                <span className="inline-flex items-center gap-1.5 text-foreground/60">
                  VAT (12%)
                  <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold text-primary">BIR</span>
                </span>
                <span className="font-mono font-medium text-foreground">{formatPHP(tax)}</span>
              </div>
              <div className="flex justify-between items-center text-foreground/70">
                <span className="text-foreground/60">Shipping</span>
                <span className="font-mono font-medium text-foreground">
                  {shipping === 0 ? <span className="text-emerald-600 font-semibold text-[11px] uppercase">Free</span> : formatPHP(shipping)}
                </span>
              </div>

              {isTestCart ? (
                <p className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 text-[10px] leading-4 text-amber-900">
                  Payment test item: tax and shipping are waived for this cart.
                </p>
              ) : null}

              {!isTestCart && shipping === 0 && subtotal > 0 ? (
                <p className="rounded-lg bg-primary/5 border border-primary/15 px-2.5 py-1.5 text-[10px] leading-4 text-foreground/70">
                  Shipping is free on perfume orders of {formatPHP(400)} or more.
                </p>
              ) : null}
            </div>

            <div className="mt-6 border-t border-border/70 pt-4">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Total</span>
                  <p className="text-[10px] text-foreground/45 mt-0.5">Incl. 12% VAT & delivery</p>
                </div>
                <span className="text-3xl font-serif font-bold text-foreground">{formatPHP(total)}</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {authLoading ? (
                <Button className="h-12 w-full rounded-2xl bg-primary text-primary-foreground" disabled>
                  Checking account...
                </Button>
              ) : (
                <Button className="h-12 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-[#ff8a73]" asChild>
                  <Link
                    href={checkoutHref}
                    aria-disabled={hasUnavailableItems}
                    className={hasUnavailableItems ? 'pointer-events-none opacity-50' : undefined}
                  >
                    {isAuthenticated ? 'Proceed To Checkout' : 'Sign In To Checkout'}
                  </Link>
                </Button>
              )}

              <Button variant="outline" className="h-12 w-full rounded-2xl border-border/70 bg-white/70" asChild>
                <Link href="/shop">Continue Shopping</Link>
              </Button>
            </div>

            {hasUnavailableItems ? (
              <p className="mt-4 text-sm leading-7 text-destructive">
                Remove or adjust unavailable items before continuing to checkout.
              </p>
            ) : null}

            {!authLoading && !isAuthenticated && !hasUnavailableItems ? (
              <p className="mt-4 text-sm leading-7 text-foreground/58">Sign in to continue to checkout.</p>
            ) : null}
          </aside>
        </div>
      </section>
    </StorefrontShell>
  )
}
