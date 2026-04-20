'use client'

import Image from 'next/image'
import Link from 'next/link'
import { Trash2 } from 'lucide-react'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { formatPHP } from '@/lib/currency'
import { useStore } from '@/lib/store-context'
import { isPaymentTestCart } from '@/lib/store-engine'
import { toast } from '@/hooks/use-toast'

const CHECKOUT_SIGN_IN_HREF = '/auth/signin?redirectTo=%2Fcheckout&reason=checkout'

export default function CartPage() {
  const {
    cart,
    getAvailabilityStatus,
    getAvailableStock,
    getInventoryRecord,
    getProductById,
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
                  <div className="relative h-32 w-full overflow-hidden rounded-[1.5rem] bg-muted/30 sm:w-32">
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
                      <div className="inline-flex items-center gap-2 rounded-2xl border border-border/70 bg-white/75 p-1">
                        <button
                          type="button"
                          onClick={() => void handleQuantityChange(item.productId, item.size, item.quantity - 1)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg transition hover:bg-muted"
                          aria-label="Decrease quantity"
                        >
                          -
                        </button>
                        <span className="w-10 text-center font-semibold text-foreground">{item.quantity}</span>
                        <button
                          type="button"
                          onClick={() => void handleQuantityChange(item.productId, item.size, item.quantity + 1)}
                          className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-lg transition hover:bg-muted"
                          aria-label="Increase quantity"
                        >
                          +
                        </button>
                      </div>

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

            <div className="mt-6 space-y-4 text-sm text-foreground/68">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatPHP(subtotal)}</span>
              </div>
              <div className="flex justify-between">
                <span>Shipping</span>
                <span>{shipping === 0 ? 'Free' : formatPHP(shipping)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{formatPHP(tax)}</span>
              </div>

              {isTestCart ? (
                <p className="rounded-[1.25rem] bg-[#fff0be] px-4 py-3 text-xs leading-6 text-foreground/70">
                  Payment test item: tax and shipping are waived for this cart.
                </p>
              ) : null}

              {!isTestCart && shipping === 0 && subtotal > 0 ? (
                <p className="rounded-[1.25rem] bg-[#fff0be] px-4 py-3 text-xs leading-6 text-foreground/70">
                  Shipping is free on perfume orders of {formatPHP(400)} or more.
                </p>
              ) : null}
            </div>

            <div className="mt-6 border-t border-border/70 pt-5">
              <div className="flex items-end justify-between gap-4">
                <span className="text-base font-semibold text-foreground">Total</span>
                <span className="text-4xl text-foreground">{formatPHP(total)}</span>
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
