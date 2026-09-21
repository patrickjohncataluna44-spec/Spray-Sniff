'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  Banknote,
  CreditCard,
  Loader2,
  Minus,
  Plus,
  ReceiptText,
  RotateCcw,
  ShoppingBag,
  Smartphone,
  Trash2,
} from 'lucide-react'
import { AdminSidebar } from '@/components/admin-sidebar'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { calculateVatBreakdown, formatPHP } from '@/lib/currency'
import { isPaymentTestCart } from '@/lib/store-engine'
import { POS_PAYMENT_METHODS, type CartItem, useStore } from '@/lib/store-context'
import { toast } from '@/hooks/use-toast'

function generateClientSaleId() {
  return `pos_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

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
  const [saleItems, setSaleItems] = useState<CartItem[]>([])

  // Checkout info
  const [paymentMethod, setPaymentMethod] = useState<(typeof POS_PAYMENT_METHODS)[number]>('Cash')
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [cashTendered, setCashTendered] = useState('')

  // Double-submission protection
  const [isProcessing, setIsProcessing] = useState(false)
  const isProcessingRef = useRef(false)
  const clientSaleIdRef = useRef(generateClientSaleId())

  const selectedProduct = useMemo(
    () => activeCatalog.find((product) => product.id === selectedProductId),
    [activeCatalog, selectedProductId],
  )

  // Stock calculations for currently selected product
  const availableStock = selectedProduct ? getAvailableStock(selectedProduct.id) : 0
  const quantityInSale = useMemo(() => {
    if (!selectedProduct) return 0
    return saleItems
      .filter((item) => item.productId === selectedProduct.id)
      .reduce((sum, item) => sum + item.quantity, 0)
  }, [saleItems, selectedProduct])

  const remainingStock = Math.max(0, availableStock - quantityInSale)
  const isOutOfStock = availableStock <= 0
  const isAllInTransaction = !isOutOfStock && remainingStock <= 0

  // Keep selected product & size valid
  useEffect(() => {
    if (!selectedProductId || !activeCatalog.some((product) => product.id === selectedProductId)) {
      const first = activeCatalog[0]
      setSelectedProductId(first?.id ?? '')
      setSelectedSize(first?.sizes[0]?.ml ?? 0)
      return
    }

    if (selectedProduct && !selectedProduct.sizes.some((size) => size.ml === selectedSize)) {
      setSelectedSize(selectedProduct.sizes[0]?.ml ?? 0)
    }
  }, [activeCatalog, selectedProduct, selectedProductId, selectedSize])

  // Adjust quantity when remainingStock changes or when product switches
  useEffect(() => {
    if (remainingStock <= 0) {
      setQuantity(0)
    } else if (quantity < 1 || quantity > remainingStock) {
      setQuantity(1)
    }
  }, [remainingStock, selectedProductId])

  const subtotal = saleItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const isTestCart = isPaymentTestCart(saleItems)
  const { vatAmount: tax } = isTestCart ? { vatAmount: 0 } : calculateVatBreakdown(subtotal)
  const total = subtotal

  // Cash change calculation
  const numericTendered = parseFloat(cashTendered)
  const changeAmount = !isNaN(numericTendered) && numericTendered >= total ? numericTendered - total : 0
  const shortageAmount = !isNaN(numericTendered) && numericTendered < total ? total - numericTendered : 0

  const addSaleItem = () => {
    if (!selectedProduct) return

    const currentStock = getAvailableStock(selectedProduct.id)
    if (currentStock <= 0) {
      toast({
        title: 'Out of Stock',
        description: `${selectedProduct.name} is currently out of stock.`,
        variant: 'destructive',
      })
      return
    }

    const currentInSale = saleItems
      .filter((item) => item.productId === selectedProduct.id)
      .reduce((sum, item) => sum + item.quantity, 0)

    const remaining = Math.max(0, currentStock - currentInSale)
    if (remaining <= 0) {
      toast({
        title: 'Insufficient stock',
        description: `All ${currentStock} unit(s) of ${selectedProduct.name} are already in this sale.`,
        variant: 'destructive',
      })
      return
    }

    const selectedVariant =
      selectedProduct.sizes.find((size) => size.ml === selectedSize) ??
      selectedProduct.sizes[0]

    const qtyToAdd = Math.min(Math.max(1, quantity), remaining)

    const existingItem = saleItems.find(
      (item) => item.productId === selectedProduct.id && item.size === selectedVariant.ml,
    )

    setSaleItems((current) =>
      existingItem
        ? current.map((item) =>
            item.productId === selectedProduct.id && item.size === selectedVariant.ml
              ? { ...item, quantity: item.quantity + qtyToAdd }
              : item,
          )
        : [
            ...current,
            {
              productId: selectedProduct.id,
              quantity: qtyToAdd,
              size: selectedVariant.ml,
              unitPrice: selectedVariant.price,
            },
          ],
    )

    // Reset quantity after adding
    const nextRemaining = remaining - qtyToAdd
    setQuantity(nextRemaining > 0 ? 1 : 0)
  }

  const updateItemQuantity = (productId: string, size: number, newQty: number) => {
    if (newQty <= 0) {
      setSaleItems((current) =>
        current.filter((entry) => !(entry.productId === productId && entry.size === size)),
      )
      return
    }

    const stock = getAvailableStock(productId)
    const otherSizesQty = saleItems
      .filter((entry) => entry.productId === productId && entry.size !== size)
      .reduce((sum, item) => sum + item.quantity, 0)

    if (otherSizesQty + newQty > stock) {
      toast({
        title: 'Stock limit reached',
        description: `Only ${stock} unit(s) are available for this product.`,
        variant: 'destructive',
      })
      return
    }

    setSaleItems((current) =>
      current.map((item) =>
        item.productId === productId && item.size === size
          ? { ...item, quantity: newQty }
          : item,
      ),
    )
  }

  const handleClearSale = () => {
    setSaleItems([])
    setCustomerName('')
    setNotes('')
    setCashTendered('')
  }

  const handleSubmit = async () => {
    // Prevent multiple submissions
    if (isProcessingRef.current || isProcessing) {
      return
    }

    if (saleItems.length === 0) {
      toast({
        title: 'Cart is empty',
        description: 'Please add at least one product to process payment.',
        variant: 'destructive',
      })
      return
    }

    isProcessingRef.current = true
    setIsProcessing(true)

    try {
      const clientSaleId = clientSaleIdRef.current
      const result = await createPosSale({
        cashierName: user?.name || 'Store Staff',
        customerName: customerName.trim() || 'Walk-in Customer',
        items: saleItems,
        notes,
        paymentMethod,
        clientSaleId,
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
        setCashTendered('')
        // Generate new clientSaleId for next transaction
        clientSaleIdRef.current = generateClientSaleId()
      }
    } catch (error) {
      toast({
        title: 'Payment processing error',
        description: error instanceof Error ? error.message : 'An unexpected error occurred.',
        variant: 'destructive',
      })
    } finally {
      isProcessingRef.current = false
      setIsProcessing(false)
    }
  }

  return (
    <ProtectedRoute requiredRole={['ADMIN', 'STAFF']}>
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <div className="flex-1">
          {/* Header */}
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
                    Process in-store transactions with real-time stock deductions, automatic VAT, and instant receipts.
                  </p>
                </div>

                <div className="rounded-full bg-accent/10 px-4 py-2 text-sm font-medium text-accent">
                  Cashier: {user?.name || 'Store Staff'}
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
            <div className="grid gap-8 lg:grid-cols-[1fr_1.25fr]">
              {/* Left Column: Build Sale / Add Items */}
              <section className="rounded-2xl border border-border bg-card p-6 flex flex-col h-fit">
                <div className="flex items-center gap-2 mb-6">
                  <ShoppingBag className="h-5 w-5 text-accent" />
                  <h2 className="font-serif text-2xl text-foreground">Build Sale</h2>
                </div>

                <div className="space-y-5">
                  {/* Product Selector */}
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
                      }}
                      className="rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                    >
                      {activeCatalog.map((product) => {
                        const stock = getAvailableStock(product.id)
                        return (
                          <option key={product.id} value={product.id}>
                            {product.name} {stock <= 0 ? '— (Out of Stock)' : `(${stock} available)`}
                          </option>
                        )
                      })}
                    </select>
                  </div>

                  {selectedProduct ? (
                    <>
                      {/* Size Selector */}
                      <div className="grid gap-2">
                        <label className="text-sm font-medium text-foreground">Size & Price</label>
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

                      {/* Quantity Selector */}
                      <div className="grid gap-2">
                        <div className="flex items-center justify-between">
                          <label className="text-sm font-medium text-foreground">Quantity</label>
                          {isOutOfStock ? (
                            <span className="rounded-full bg-destructive/15 px-2.5 py-0.5 text-xs font-semibold text-destructive">
                              Out of Stock
                            </span>
                          ) : isAllInTransaction ? (
                            <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-600 dark:text-amber-400">
                              All {availableStock} in transaction
                            </span>
                          ) : (
                            <span className="text-xs text-foreground/60">
                              {remainingStock} of {availableStock} available
                              {quantityInSale > 0 && ` (${quantityInSale} in cart)`}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={quantity <= 1 || remainingStock <= 0}
                            onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                            aria-label="Decrease quantity"
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <input
                            type="number"
                            min={1}
                            max={Math.max(1, remainingStock)}
                            value={remainingStock > 0 ? quantity : 0}
                            disabled={remainingStock <= 0}
                            onChange={(e) => {
                              const val = e.target.value
                              if (val === '') {
                                setQuantity(1)
                                return
                              }
                              const parsed = parseInt(val, 10)
                              if (!isNaN(parsed)) {
                                setQuantity(
                                  Math.min(
                                    Math.max(1, parsed),
                                    Math.max(1, remainingStock),
                                  ),
                                )
                              }
                            }}
                            className="w-16 rounded-md border border-border bg-background py-1.5 text-center font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            aria-label="POS Item Quantity"
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            disabled={quantity >= remainingStock || remainingStock <= 0}
                            onClick={() =>
                              setQuantity((current) => Math.min(remainingStock, current + 1))
                            }
                            aria-label="Increase quantity"
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                          <span className="text-sm text-foreground/60">
                            {remainingStock > 0
                              ? `${remainingStock} available`
                              : 'No stock left'}
                          </span>
                        </div>
                      </div>

                      {/* Add Item Button */}
                      <Button
                        type="button"
                        className="w-full mt-2"
                        onClick={addSaleItem}
                        disabled={
                          !selectedProduct ||
                          isOutOfStock ||
                          isAllInTransaction ||
                          quantity < 1 ||
                          quantity > remainingStock
                        }
                      >
                        {isOutOfStock ? (
                          'Out of Stock'
                        ) : isAllInTransaction ? (
                          'All Available Units in Sale'
                        ) : (
                          <>
                            <Plus className="mr-2 h-4 w-4" />
                            Add Item to Sale
                          </>
                        )}
                      </Button>
                    </>
                  ) : (
                    <div className="rounded-xl border border-dashed border-border p-6 text-sm text-foreground/60 text-center">
                      No active products are available for POS sales right now.
                    </div>
                  )}
                </div>
              </section>

              {/* Right Column: Current Transaction & Payment */}
              <section className="rounded-2xl border border-border bg-card p-6 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-6 pb-4 border-b border-border">
                    <div className="flex items-center gap-2">
                      <ReceiptText className="h-5 w-5 text-accent" />
                      <h2 className="font-serif text-2xl text-foreground">Current Transaction</h2>
                      <span className="rounded-full bg-accent/15 px-2.5 py-0.5 text-xs font-semibold text-accent">
                        {saleItems.reduce((sum, item) => sum + item.quantity, 0)} item(s)
                      </span>
                    </div>

                    {saleItems.length > 0 && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={handleClearSale}
                        className="text-muted-foreground hover:text-destructive h-8 px-2 text-xs"
                      >
                        <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                        Clear Sale
                      </Button>
                    )}
                  </div>

                  {/* Cart Items List */}
                  <div className="space-y-3 max-h-[320px] overflow-y-auto pr-1">
                    {saleItems.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-border p-10 text-center text-foreground/60">
                        <ShoppingBag className="mx-auto h-8 w-8 text-foreground/30 mb-2" />
                        <p className="font-medium">No items added yet</p>
                        <p className="text-xs text-foreground/50 mt-1">
                          Select a product from the left and click &ldquo;Add Item to Sale&rdquo;.
                        </p>
                      </div>
                    ) : (
                      saleItems.map((item) => {
                        const product = getProductById(item.productId)
                        const stock = getAvailableStock(item.productId)
                        const totalProductInSale = saleItems
                          .filter((entry) => entry.productId === item.productId)
                          .reduce((sum, entry) => sum + entry.quantity, 0)
                        const canIncrease = totalProductInSale < stock

                        return (
                          <div
                            key={`${item.productId}-${item.size}`}
                            className="rounded-xl border border-border bg-background/70 p-4 transition-all"
                          >
                            <div className="flex items-start justify-between gap-4">
                              <div className="min-w-0 flex-1">
                                <p className="font-medium text-foreground truncate">
                                  {product?.name ?? 'Unknown Product'}
                                </p>
                                <p className="text-xs text-foreground/60 mt-0.5">
                                  {item.size}ml &bull; {formatPHP(item.unitPrice)} each
                                </p>
                              </div>

                              <div className="text-right">
                                <p className="font-medium text-foreground">
                                  {formatPHP(item.unitPrice * item.quantity)}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/40">
                              <div className="flex items-center gap-2">
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  onClick={() =>
                                    updateItemQuantity(item.productId, item.size, item.quantity - 1)
                                  }
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="h-3.5 w-3.5" />
                                </Button>
                                <span className="w-8 text-center text-sm font-semibold text-foreground">
                                  {item.quantity}
                                </span>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="icon"
                                  className="h-7 w-7"
                                  disabled={!canIncrease}
                                  onClick={() =>
                                    updateItemQuantity(item.productId, item.size, item.quantity + 1)
                                  }
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="h-3.5 w-3.5" />
                                </Button>
                                {!canIncrease && (
                                  <span className="text-[10px] text-amber-500 font-medium">Max</span>
                                )}
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
                                className="rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-destructive hover:bg-destructive/10"
                                aria-label="Remove sale item"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Customer Details & Notes */}
                  <div className="mt-6 border-t border-border pt-4 grid gap-3 sm:grid-cols-2">
                    <div className="grid gap-1.5">
                      <label className="text-xs font-medium text-foreground">Customer Name</label>
                      <input
                        type="text"
                        value={customerName}
                        onChange={(event) => setCustomerName(event.target.value)}
                        placeholder="Walk-in Customer"
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>

                    <div className="grid gap-1.5">
                      <label className="text-xs font-medium text-foreground">Cashier Notes</label>
                      <input
                        type="text"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                        placeholder="Receipt memo or order reference"
                        className="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                    </div>
                  </div>

                  {/* Totals Summary */}
                  <div className="mt-6 border-t border-border pt-4 space-y-2.5">
                    <div className="flex justify-between text-sm text-foreground/70">
                      <span>Price (Subtotal)</span>
                      <span>{formatPHP(subtotal)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-foreground/70">
                      <span className="flex items-center gap-1.5">
                        12% VAT
                        <span className="rounded bg-emerald-100 dark:bg-emerald-950/60 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 dark:text-emerald-400">
                          Included
                        </span>
                      </span>
                      <span>{formatPHP(tax)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-semibold text-foreground pt-1 border-t border-border/60">
                      <span>Total (VAT-Inclusive)</span>
                      <span className="text-accent">{formatPHP(total)}</span>
                    </div>
                  </div>

                  {/* PAYMENT METHOD: Positioned after cart items and right before Process Payment */}
                  <div className="mt-6 border-t border-border pt-5">
                    <label className="text-xs font-semibold uppercase tracking-wider text-foreground/70 block mb-2.5">
                      Payment Method
                    </label>

                    <div className="grid grid-cols-3 gap-2">
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Cash')}
                        className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all ${
                          paymentMethod === 'Cash'
                            ? 'border-accent bg-accent/15 text-accent shadow-sm ring-1 ring-accent'
                            : 'border-border bg-background text-foreground/80 hover:bg-muted'
                        }`}
                      >
                        <Banknote className="h-4 w-4" />
                        Cash
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Card')}
                        className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all ${
                          paymentMethod === 'Card'
                            ? 'border-accent bg-accent/15 text-accent shadow-sm ring-1 ring-accent'
                            : 'border-border bg-background text-foreground/80 hover:bg-muted'
                        }`}
                      >
                        <CreditCard className="h-4 w-4" />
                        Card
                      </button>

                      <button
                        type="button"
                        onClick={() => setPaymentMethod('GCash')}
                        className={`flex items-center justify-center gap-2 rounded-xl border p-3 text-sm font-medium transition-all ${
                          paymentMethod === 'GCash'
                            ? 'border-accent bg-accent/15 text-accent shadow-sm ring-1 ring-accent'
                            : 'border-border bg-background text-foreground/80 hover:bg-muted'
                        }`}
                      >
                        <Smartphone className="h-4 w-4" />
                        GCash
                      </button>
                    </div>

                    {/* Cash Tendered & Change Calculator */}
                    {paymentMethod === 'Cash' && saleItems.length > 0 && (
                      <div className="mt-4 rounded-xl border border-border/80 bg-background/50 p-3.5 space-y-3">
                        <div className="flex items-center justify-between gap-3">
                          <label className="text-xs font-medium text-foreground">Cash Received (₱)</label>
                          <input
                            type="number"
                            min={0}
                            step="any"
                            placeholder="0.00"
                            value={cashTendered}
                            onChange={(e) => setCashTendered(e.target.value)}
                            className="w-32 rounded-lg border border-border bg-background px-3 py-1.5 text-right font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        </div>

                        {/* Quick Tendered Buttons */}
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            onClick={() => setCashTendered(total.toString())}
                            className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground/80 hover:bg-muted"
                          >
                            Exact ({formatPHP(total)})
                          </button>
                          {[500, 1000, 2000].map((preset) => {
                            if (preset >= total) {
                              return (
                                <button
                                  key={preset}
                                  type="button"
                                  onClick={() => setCashTendered(preset.toString())}
                                  className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground/80 hover:bg-muted"
                                >
                                  ₱{preset.toLocaleString()}
                                </button>
                              )
                            }
                            return null
                          })}
                        </div>

                        {cashTendered && !isNaN(numericTendered) && (
                          <div className="flex items-center justify-between pt-2 border-t border-border/60 text-xs">
                            <span className="font-medium text-foreground/70">
                              {shortageAmount > 0 ? 'Remaining Due:' : 'Change:'}
                            </span>
                            <span
                              className={`text-sm font-bold ${
                                shortageAmount > 0
                                  ? 'text-destructive'
                                  : 'text-emerald-600 dark:text-emerald-400'
                              }`}
                            >
                              {shortageAmount > 0
                                ? formatPHP(shortageAmount)
                                : formatPHP(changeAmount)}
                            </span>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Process Payment Button */}
                <div className="mt-6 pt-4 border-t border-border">
                  <Button
                    className="w-full bg-accent hover:bg-accent/90 text-accent-foreground py-6 text-base font-semibold shadow-md transition-all disabled:opacity-50"
                    onClick={handleSubmit}
                    disabled={saleItems.length === 0 || isProcessing}
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        Process Payment &bull; {formatPHP(total)}
                      </>
                    )}
                  </Button>
                </div>

                {/* Recent POS Activity */}
                <div className="mt-8 border-t border-border pt-6">
                  <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-foreground/50 mb-3">
                    Recent POS Activity
                  </h3>
                  <div className="space-y-2.5">
                    {posTransactions.length === 0 ? (
                      <p className="text-xs text-foreground/50 italic">No recent transactions.</p>
                    ) : (
                      posTransactions.slice(0, 3).map((transaction) => (
                        <div
                          key={transaction.id}
                          className="rounded-xl border border-border/80 bg-background/50 p-3 flex items-center justify-between text-xs"
                        >
                          <div>
                            <p className="font-medium text-foreground">{transaction.id}</p>
                            <p className="text-foreground/50 mt-0.5">
                              {transaction.itemsCount} item(s) &bull; {transaction.paymentMethod}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-foreground">
                              {formatPHP(transaction.total)}
                            </p>
                            <p className="text-foreground/40 text-[10px] mt-0.5">
                              {new Date(transaction.createdAt).toLocaleTimeString([], {
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      ))
                    )}
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
