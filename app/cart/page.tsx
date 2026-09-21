'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Check, Trash2 } from 'lucide-react'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/lib/auth-context'
import { calculateVatBreakdown, formatPHP } from '@/lib/currency'
import { useStore } from '@/lib/store-context'
import { isPaymentTestCart } from '@/lib/store-engine'
import { toast } from '@/hooks/use-toast'

const CHECKOUT_SIGN_IN_HREF = '/auth/signin?redirectTo=%2Fcheckout&reason=checkout'
const CART_SELECTED_STORAGE_KEY = 'fragrance_selected_cart_items'

function getCartItemKey(productId: string, size: number) {
  return `${productId}-${size}`
}

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

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem(CART_SELECTED_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) {
          return new Set(parsed)
        }
      }
    } catch {}
    return new Set()
  })

  // Synchronize selection with cart items
  useEffect(() => {
    if (cart.length === 0) return

    setSelectedKeys((prev) => {
      const availableKeys = cart
        .filter((item) => {
          const record = getInventoryRecord(item.productId)
          const stock = getAvailableStock(item.productId)
          return record && !record.isArchived && stock >= item.quantity
        })
        .map((item) => getCartItemKey(item.productId, item.size))

      // If user had no previous selection saved, default all available items to selected
      if (prev.size === 0) {
        const next = new Set(availableKeys)
        try {
          localStorage.setItem(CART_SELECTED_STORAGE_KEY, JSON.stringify(Array.from(next)))
        } catch {}
        return next
      }

      // Retain existing selections that are still present in cart
      const currentCartKeys = new Set(cart.map((item) => getCartItemKey(item.productId, item.size)))
      const next = new Set<string>()
      for (const key of prev) {
        if (currentCartKeys.has(key)) {
          next.add(key)
        }
      }

      // If all previously selected items were removed or none matched, select available
      if (next.size === 0 && availableKeys.length > 0) {
        for (const k of availableKeys) next.add(k)
      }

      try {
        localStorage.setItem(CART_SELECTED_STORAGE_KEY, JSON.stringify(Array.from(next)))
      } catch {}

      return next
    })
  }, [cart, getAvailableStock, getInventoryRecord])

  const updateSelectedKeys = (updater: (prev: Set<string>) => Set<string>) => {
    setSelectedKeys((prev) => {
      const next = updater(prev)
      try {
        localStorage.setItem(CART_SELECTED_STORAGE_KEY, JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }

  const toggleItemSelection = (productId: string, size: number) => {
    const key = getCartItemKey(productId, size)
    updateSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  const availableCartItems = useMemo(
    () =>
      cart.filter((item) => {
        const record = getInventoryRecord(item.productId)
        const stock = getAvailableStock(item.productId)
        return record && !record.isArchived && stock >= item.quantity
      }),
    [cart, getAvailableStock, getInventoryRecord],
  )

  const isAllSelected =
    availableCartItems.length > 0 &&
    availableCartItems.every((item) => selectedKeys.has(getCartItemKey(item.productId, item.size)))

  const toggleSelectAll = () => {
    if (isAllSelected) {
      updateSelectedKeys(() => new Set())
    } else {
      updateSelectedKeys(
        () => new Set(availableCartItems.map((item) => getCartItemKey(item.productId, item.size))),
      )
    }
  }

  // Calculate totals strictly based on SELECTED items
  const selectedCart = useMemo(
    () => cart.filter((item) => selectedKeys.has(getCartItemKey(item.productId, item.size))),
    [cart, selectedKeys],
  )

  const selectedCount = selectedCart.reduce((sum, item) => sum + item.quantity, 0)
  const subtotal = selectedCart.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const isTestCart = isPaymentTestCart(selectedCart)
  // Standard Philippine BIR 12% VAT-inclusive:
  // Price shown is already VAT-inclusive, VAT amount is extracted rather than added
  const { vatAmount: tax } = isTestCart ? { vatAmount: 0 } : calculateVatBreakdown(subtotal)
  const shipping = isTestCart ? 0 : subtotal >= 400 || subtotal === 0 ? 0 : 75
  const total = subtotal + shipping
  const checkoutHref = isAuthenticated ? '/checkout' : CHECKOUT_SIGN_IN_HREF

  const hasSelectedUnavailableItems = selectedCart.some((item) => {
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
          <div className="space-y-4">
            {/* Shopee-style Select All Toolbar */}
            <div className="storefront-panel flex items-center justify-between rounded-[1.75rem] px-5 py-3.5 sm:px-6 sm:py-4">
              <label className="flex items-center gap-3 cursor-pointer select-none text-sm font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={isAllSelected}
                  onChange={toggleSelectAll}
                  disabled={availableCartItems.length === 0}
                  className="sr-only"
                />
                <div
                  className={`flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-lg border-2 transition-all ${
                    isAllSelected
                      ? 'border-primary bg-primary text-white shadow-xs'
                      : 'border-border/80 bg-white/90 hover:border-primary/70'
                  } ${availableCartItems.length === 0 ? 'opacity-40 cursor-not-allowed' : ''}`}
                >
                  {isAllSelected && <Check className="h-3.5 w-3.5 sm:h-4 sm:w-4 stroke-[3]" />}
                </div>
                <span className="font-semibold text-foreground">
                  Select All
                  <span className="ml-2 text-xs font-normal text-foreground/50">
                    ({selectedCart.length} of {cart.length} {cart.length === 1 ? 'item' : 'items'} selected)
                  </span>
                </span>
              </label>

              {selectedCart.length > 0 && (
                <button
                  type="button"
                  onClick={() => updateSelectedKeys(() => new Set())}
                  className="text-xs font-medium text-foreground/50 hover:text-primary transition underline underline-offset-2"
                >
                  Deselect all
                </button>
              )}
            </div>

            {/* Cart Items List */}
            {cart.map((item) => {
              const product = getProductById(item.productId)
              if (!product) {
                return null
              }

              const itemKey = getCartItemKey(item.productId, item.size)
              const isSelected = selectedKeys.has(itemKey)
              const availability = getAvailabilityStatus(product.id)
              const availableStock = getAvailableStock(product.id)
              const isArchived = getInventoryRecord(product.id)?.isArchived ?? false
              const isItemUnavailable = !product || isArchived || availableStock < item.quantity

              return (
                <article
                  key={itemKey}
                  className={`storefront-panel flex flex-col gap-4 sm:gap-5 rounded-[2rem] p-5 sm:flex-row sm:items-start sm:p-6 transition-all duration-200 ${
                    isSelected
                      ? 'ring-2 ring-primary/40 bg-white/95 shadow-xs'
                      : isItemUnavailable
                        ? 'opacity-60 bg-muted/20'
                        : 'hover:border-primary/30'
                  }`}
                >
                  {/* Shopee-style Checkbox on the side */}
                  <div className="flex items-center sm:self-center sm:pt-0">
                    <label
                      htmlFor={`select-${itemKey}`}
                      className={`relative flex items-center justify-center cursor-pointer p-1.5 -m-1.5 rounded-xl transition ${
                        isItemUnavailable ? 'cursor-not-allowed opacity-40' : 'hover:bg-primary/10'
                      }`}
                      title={
                        isItemUnavailable
                          ? 'Unavailable for checkout'
                          : isSelected
                            ? 'Uncheck item'
                            : 'Select item for checkout'
                      }
                    >
                      <input
                        id={`select-${itemKey}`}
                        type="checkbox"
                        checked={isSelected}
                        disabled={isItemUnavailable}
                        onChange={() => toggleItemSelection(item.productId, item.size)}
                        className="sr-only"
                        aria-label={`Select ${product.name} for checkout`}
                      />
                      <div
                        className={`flex h-6 w-6 items-center justify-center rounded-lg border-2 transition-all ${
                          isSelected
                            ? 'border-primary bg-primary text-white shadow-xs scale-105'
                            : isItemUnavailable
                              ? 'border-border/40 bg-muted/40 text-transparent'
                              : 'border-border/80 bg-white/90 hover:border-primary/70 text-transparent'
                        }`}
                      >
                        <Check
                          className={`h-4 w-4 stroke-[3] transition-transform ${
                            isSelected ? 'scale-100' : 'scale-50 opacity-0'
                          }`}
                        />
                      </div>
                    </label>
                  </div>

                  {/* Product Image */}
                  <div
                    className="relative w-full overflow-hidden rounded-[1.5rem] bg-muted/30 sm:w-32 sm:flex-shrink-0"
                    style={{ height: '128px', minHeight: '128px' }}
                  >
                    <Image src={product.images[0]} alt={product.name} fill className="object-cover" />
                  </div>

                  {/* Product Details */}
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
                <span className="text-foreground/60">
                  Price (Subtotal{selectedCart.length > 0 ? ` · ${selectedCount} ${selectedCount === 1 ? 'item' : 'items'}` : ''})
                </span>
                <span className="font-mono font-medium text-foreground">{formatPHP(subtotal)}</span>
              </div>
              <div className="flex justify-between items-center text-foreground/70">
                <span className="inline-flex items-center gap-1.5 text-foreground/60">
                  12% VAT
                  <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[9px] font-bold text-emerald-600">Included</span>
                </span>
                <span className="font-mono font-medium text-foreground/80">{formatPHP(tax)}</span>
              </div>
              <div className="flex justify-between items-center text-foreground/70">
                <span className="text-foreground/60">Shipping</span>
                <span className="font-mono font-medium text-foreground">
                  {selectedCart.length === 0 ? (
                    '₱0'
                  ) : shipping === 0 ? (
                    <span className="text-emerald-600 font-semibold text-[11px] uppercase">Free</span>
                  ) : (
                    formatPHP(shipping)
                  )}
                </span>
              </div>

              {selectedCart.length > 0 && isTestCart ? (
                <p className="rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 text-[10px] leading-4 text-amber-900">
                  Payment test item: tax and shipping are waived for this cart.
                </p>
              ) : null}

              {selectedCart.length > 0 && !isTestCart && shipping === 0 && subtotal > 0 ? (
                <p className="rounded-lg bg-primary/5 border border-primary/15 px-2.5 py-1.5 text-[10px] leading-4 text-foreground/70">
                  Shipping is free on perfume orders of {formatPHP(400)} or more.
                </p>
              ) : null}
            </div>

            <div className="mt-6 border-t border-border/70 pt-4">
              <div className="flex items-baseline justify-between gap-4">
                <div>
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground">Total</span>
                  <p className="text-[10px] text-foreground/45 mt-0.5">
                    {selectedCart.length > 0 ? 'VAT-Inclusive · Free delivery ₱400+' : 'No items selected'}
                  </p>
                </div>
                <span className="text-3xl font-serif font-bold text-foreground">{formatPHP(total)}</span>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              {authLoading ? (
                <Button className="h-12 w-full rounded-2xl bg-primary text-primary-foreground" disabled>
                  Checking account...
                </Button>
              ) : selectedCart.length === 0 ? (
                <Button className="h-12 w-full rounded-2xl bg-muted text-foreground/40 cursor-not-allowed" disabled>
                  Select Items To Checkout
                </Button>
              ) : (
                <Button className="h-12 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-[#ff8a73]" asChild>
                  <Link
                    href={checkoutHref}
                    aria-disabled={hasSelectedUnavailableItems}
                    className={hasSelectedUnavailableItems ? 'pointer-events-none opacity-50' : undefined}
                  >
                    {isAuthenticated ? `Proceed To Checkout (${selectedCount})` : 'Sign In To Checkout'}
                  </Link>
                </Button>
              )}

              <Button variant="outline" className="h-12 w-full rounded-2xl border-border/70 bg-white/70" asChild>
                <Link href="/shop">Continue Shopping</Link>
              </Button>
            </div>

            {selectedCart.length === 0 ? (
              <p className="mt-4 text-center text-xs leading-5 text-foreground/50">
                Pilia ang mga fragrance nga gusto nimo i-checkout gamit ang checkbox sa kilid.
              </p>
            ) : hasSelectedUnavailableItems ? (
              <p className="mt-4 text-sm leading-7 text-destructive">
                Remove or uncheck unavailable items before continuing to checkout.
              </p>
            ) : !authLoading && !isAuthenticated ? (
              <p className="mt-4 text-sm leading-7 text-foreground/58">Sign in to continue to checkout.</p>
            ) : null}
          </aside>
        </div>
      </section>
    </StorefrontShell>
  )
}
