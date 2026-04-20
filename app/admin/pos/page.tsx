'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Minus, Plus, ReceiptText, Trash2 } from 'lucide-react'
import { AdminSidebar } from '@/components/admin-sidebar'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { formatPHP } from '@/lib/currency'
import { isPaymentTestCart } from '@/lib/store-engine'
import { POS_PAYMENT_METHODS, type CartItem, useStore } from '@/lib/store-context'
import { toast } from '@/hooks/use-toast'

export default function PosPage() {
  const { user } = useAuth()
  const {
    catalog,
    createPosSale,
    getAvailableStock,
    getInventoryRecord,
    getProductById,
    posTransactions,
  } = useStore()
  const activeCatalog = useMemo(
    () => catalog.filter((product) => !getInventoryRecord(product.id)?.isArchived),
    [catalog, getInventoryRecord],
  )
  const [selectedProductId, setSelectedProductId] = useState(activeCatalog[0]?.id ?? '')
  const [selectedSize, setSelectedSize] = useState(activeCatalog[0]?.sizes[0]?.ml ?? 0)
  const [quantity, setQuantity] = useState(1)
  const [paymentMethod, setPaymentMethod] = useState<(typeof POS_PAYMENT_METHODS)[number]>('Cash')
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [saleItems, setSaleItems] = useState<CartItem[]>([])

  const selectedProduct = useMemo(
    () => activeCatalog.find((product) => product.id === selectedProductId),
    [activeCatalog, selectedProductId],
  )

  useEffect(() => {
    if (!selectedProductId || !activeCatalog.some((product) => product.id === selectedProductId)) {
      setSelectedProductId(activeCatalog[0]?.id ?? '')
      setSelectedSize(activeCatalog[0]?.sizes[0]?.ml ?? 0)
      setQuantity(1)
      return
    }

    if (selectedProduct && !selectedProduct.sizes.some((size) => size.ml === selectedSize)) {
      setSelectedSize(selectedProduct.sizes[0]?.ml ?? 0)
    }
  }, [activeCatalog, selectedProduct, selectedProductId, selectedSize])

  const subtotal = saleItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const isTestCart = isPaymentTestCart(saleItems)
  const tax = isTestCart ? 0 : subtotal * 0.12
  const total = subtotal + tax

  const addSaleItem = () => {
    if (!selectedProduct) {
      return
    }

    const availableStock = getAvailableStock(selectedProduct.id)
    const selectedVariant =
      selectedProduct.sizes.find((size) => size.ml === selectedSize) ??
      selectedProduct.sizes[0]
    const totalQuantityForProduct = saleItems
      .filter((item) => item.productId === selectedProduct.id)
      .reduce((sum, item) => sum + item.quantity, 0)

    if (availableStock === 0) {
      toast({
        title: 'Unavailable',
        description: `${selectedProduct.name} is currently out of stock.`,
        variant: 'destructive',
      })
      return
    }

    const existingItem = saleItems.find(
      (item) => item.productId === selectedProduct.id && item.size === selectedVariant.ml,
    )

    if (totalQuantityForProduct + quantity > availableStock) {
      toast({
        title: 'Insufficient stock',
        description: `Only ${availableStock} unit(s) are available for ${selectedProduct.name}.`,
        variant: 'destructive',
      })
      return
    }

    setSaleItems((current) =>
      existingItem
        ? current.map((item) =>
            item.productId === selectedProduct.id && item.size === selectedVariant.ml
              ? { ...item, quantity: item.quantity + quantity }
              : item,
          )
        : [
            ...current,
            {
              productId: selectedProduct.id,
              quantity,
              size: selectedVariant.ml,
              unitPrice: selectedVariant.price,
            },
          ],
    )
  }

  const handleSubmit = async () => {
    const result = await createPosSale({
      cashierName: user?.name || 'Store Staff',
      customerName,
      items: saleItems,
      notes,
      paymentMethod,
    })

    toast({
      title: result.ok ? 'POS sale completed' : 'Unable to process sale',
      description: result.message,
      variant: result.ok ? 'default' : 'destructive',
    })

    if (result.ok) {
      setSaleItems([])
      setCustomerName('')
      setNotes('')
      setQuantity(1)
      setPaymentMethod('Cash')
    }
  }

  return (
    <ProtectedRoute requiredRole={['ADMIN', 'STAFF']}>
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <div className="flex-1">
          <div className="border-b border-border bg-card">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex items-center gap-4 mb-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin/dashboard" className="flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Link>
                </Button>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="font-serif text-3xl text-foreground">Point of Sale</h1>
                  <p className="mt-2 text-sm text-foreground/60">
                    Staff can process in-store transactions with automatic totals, tax, and stock deductions.
                  </p>
                </div>

                <div className="rounded-full bg-accent/10 px-4 py-2 text-sm font-medium text-accent">
                  Cashier: {user?.name}
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid gap-8 xl:grid-cols-[0.9fr_1.1fr]">
              <section className="rounded-2xl border border-border bg-card p-6">
                <h2 className="font-serif text-2xl text-foreground mb-6">Build Sale</h2>

                <div className="space-y-5">
                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-foreground">Product</label>
                    <select
                      value={selectedProductId}
                      onChange={(event) => {
                        const nextProduct = activeCatalog.find(
                          (product) => product.id === event.target.value,
                        )
                        setSelectedProductId(event.target.value)
                        setSelectedSize(nextProduct?.sizes[0]?.ml ?? 0)
                        setQuantity(1)
                      }}
                      className="rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      {activeCatalog.map((product) => (
                        <option key={product.id} value={product.id}>
                          {product.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {selectedProduct ? (
                    <>
                      <div className="grid gap-2">
                        <label className="text-sm font-medium text-foreground">Size</label>
                        <select
                          value={selectedSize}
                          onChange={(event) => setSelectedSize(Number(event.target.value))}
                          className="rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                        >
                          {selectedProduct.sizes.map((size) => (
                            <option key={size.ml} value={size.ml}>
                              {size.ml}ml - {formatPHP(size.price)}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="grid gap-2">
                        <label className="text-sm font-medium text-foreground">Quantity</label>
                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="min-w-8 text-center font-medium text-foreground">{quantity}</span>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            onClick={() =>
                              setQuantity((current) =>
                                Math.min(getAvailableStock(selectedProduct.id), current + 1),
                              )
                            }
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <span className="text-sm text-foreground/60">
                            {getAvailableStock(selectedProduct.id)} available
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-6 text-sm text-foreground/60">
                      No active products are available for POS sales right now.
                    </div>
                  )}

                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-foreground">Customer Name</label>
                    <input
                      type="text"
                      value={customerName}
                      onChange={(event) => setCustomerName(event.target.value)}
                      placeholder="Walk-in Customer"
                      className="rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-foreground">Payment Method</label>
                    <select
                      value={paymentMethod}
                      onChange={(event) =>
                        setPaymentMethod(event.target.value as (typeof POS_PAYMENT_METHODS)[number])
                      }
                      className="rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      {POS_PAYMENT_METHODS.map((method) => (
                        <option key={method} value={method}>
                          {method}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid gap-2">
                    <label className="text-sm font-medium text-foreground">Notes</label>
                    <textarea
                      value={notes}
                      onChange={(event) => setNotes(event.target.value)}
                      placeholder="Receipt note or cashier memo"
                      className="min-h-28 rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent"
                    />
                  </div>

                  <Button
                    type="button"
                    className="w-full"
                    onClick={addSaleItem}
                    disabled={!selectedProduct}
                  >
                    Add Item
                  </Button>
                </div>
              </section>

              <section className="rounded-2xl border border-border bg-card p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="font-serif text-2xl text-foreground">Current Transaction</h2>
                  <ReceiptText className="h-5 w-5 text-accent" />
                </div>

                <div className="space-y-4">
                  {saleItems.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border p-10 text-center text-foreground/60">
                      Add products to start the sale.
                    </div>
                  ) : (
                    saleItems.map((item) => {
                      const product = getProductById(item.productId)
                      return (
                        <div
                          key={`${item.productId}-${item.size}`}
                          className="rounded-xl border border-border bg-background/70 p-4"
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <p className="font-medium text-foreground">{product?.name}</p>
                              <p className="text-sm text-foreground/60">
                                {item.quantity} x {item.size}ml
                              </p>
                            </div>
                            <button
                              onClick={() =>
                                setSaleItems((current) =>
                                  current.filter(
                                    (entry) =>
                                      !(
                                        entry.productId === item.productId &&
                                        entry.size === item.size
                                      ),
                                  ),
                                )
                              }
                              className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                              aria-label="Remove sale item"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                          <p className="mt-3 font-medium text-foreground">
                            {formatPHP(item.unitPrice * item.quantity)}
                          </p>
                        </div>
                      )
                    })
                  )}
                </div>

                <div className="mt-8 border-t border-border pt-6 space-y-3">
                  <div className="flex justify-between text-foreground/70">
                    <span>Subtotal</span>
                    <span>{formatPHP(subtotal)}</span>
                  </div>
                  <div className="flex justify-between text-foreground/70">
                    <span>Tax</span>
                    <span>{formatPHP(tax)}</span>
                  </div>
                  <div className="flex justify-between text-lg font-medium text-foreground">
                    <span>Total</span>
                    <span>{formatPHP(total)}</span>
                  </div>
                </div>

                <Button
                  className="mt-6 w-full bg-accent hover:bg-accent/90 text-accent-foreground"
                  onClick={handleSubmit}
                  disabled={saleItems.length === 0}
                >
                  Process Payment
                </Button>

                <div className="mt-8 border-t border-border pt-6">
                  <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/50 mb-4">
                    Recent POS Activity
                  </h3>
                  <div className="space-y-3">
                    {posTransactions.slice(0, 4).map((transaction) => (
                      <div
                        key={transaction.id}
                        className="rounded-xl border border-border bg-background/70 p-4"
                      >
                        <div className="flex items-center justify-between gap-4">
                          <p className="font-medium text-foreground">{transaction.id}</p>
                          <p className="text-sm text-foreground/60">{transaction.paymentMethod}</p>
                        </div>
                        <p className="mt-2 text-sm text-foreground/60">
                          {transaction.itemsCount} item(s) by {transaction.cashierName}
                        </p>
                        <p className="mt-2 font-medium text-foreground">
                          {formatPHP(transaction.total)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
