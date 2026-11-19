'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import QRCode from 'qrcode'
import {
  ArrowLeft,
  Banknote,
  Ban,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Loader2,
  Minus,
  Plus,
  Printer,
  QrCode,
  ReceiptText,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  ShoppingBag,
  Trash2,
  X,
} from 'lucide-react'
import { AdminSidebar } from '@/components/admin-sidebar'
import { PosReceiptModal } from '@/components/pos-receipt-modal'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { QuantityInput } from '@/components/ui/quantity-input'
import { useAuth } from '@/lib/auth-context'
import { formatPHP } from '@/lib/currency'
import { isPaymentTestCart, type OrderRecord } from '@/lib/store-engine'
import { type CartItem, getAuthHeaders, useStore } from '@/lib/store-context'
import { toast } from '@/hooks/use-toast'

function generateClientSaleId() {
  return `pos_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

interface QrModalItemSnapshot {
  name: string
  size: number
  quantity: number
  unitPrice: number
}

interface QrModalState {
  paymentIntentId?: string
  sessionId?: string
  checkoutUrl?: string
  qrImage: string
  environment?: string
  total: number
  subtotal: number
  tax: number
  customerName: string
  items: QrModalItemSnapshot[]
}

export default function PosPage() {
  const { user } = useAuth()
  const {
    adminCancelOrder,
    catalog,
    createPosSale,
    getAvailableStock,
    getInventoryRecord,
    getProductById,
    orders,
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
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'QR Pay'>('Cash')
  const [customerName, setCustomerName] = useState('')
  const [notes, setNotes] = useState('')
  const [cashTendered, setCashTendered] = useState('')

  // Double-submission protection
  const [isProcessing, setIsProcessing] = useState(false)
  const isProcessingRef = useRef(false)
  const clientSaleIdRef = useRef(generateClientSaleId())

  // Pre-commit verification & official receipt modals
  const [isVerifyModalOpen, setIsVerifyModalOpen] = useState(false)
  const [receiptOrder, setReceiptOrder] = useState<OrderRecord | null>(null)
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false)
  const [lastCashTendered, setLastCashTendered] = useState<number | undefined>(undefined)
  const [activitySearch, setActivitySearch] = useState('')
  const [hideVoidedActivity, setHideVoidedActivity] = useState(false)

  const ordersById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  )

  const filteredPosTransactions = useMemo(() => {
    const query = activitySearch.trim().toLowerCase()

    return posTransactions.filter((transaction) => {
      const linkedOrder = ordersById.get(transaction.orderId)
      const isVoided = linkedOrder?.status === 'Cancelled'
      if (hideVoidedActivity && isVoided) {
        return false
      }

      if (!query) return true

      const dateLabel = new Date(transaction.createdAt).toLocaleDateString('en-PH', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })

      return (
        transaction.id.toLowerCase().includes(query) ||
        transaction.orderId.toLowerCase().includes(query) ||
        transaction.cashierName.toLowerCase().includes(query) ||
        transaction.paymentMethod.toLowerCase().includes(query) ||
        (linkedOrder?.customerName ?? 'Walk-in Customer').toLowerCase().includes(query) ||
        dateLabel.toLowerCase().includes(query)
      )
    })
  }, [activitySearch, hideVoidedActivity, ordersById, posTransactions])

  const activeReceiptOrder = useMemo(() => {
    if (!receiptOrder) return null
    return ordersById.get(receiptOrder.id) ?? receiptOrder
  }, [ordersById, receiptOrder])

  const activeReceiptTransaction = useMemo(() => {
    if (!activeReceiptOrder) return null
    return posTransactions.find((tx) => tx.orderId === activeReceiptOrder.id) ?? null
  }, [activeReceiptOrder, posTransactions])

  // QR Pay state
  const [isGeneratingQr, setIsGeneratingQr] = useState(false)
  const [qrModalData, setQrModalData] = useState<QrModalState | null>(null)
  const [isQrModalOpen, setIsQrModalOpen] = useState(false)
  const [qrPaymentStatus, setQrPaymentStatus] = useState<'awaiting' | 'checking' | 'paid' | 'failed'>('awaiting')
  const [isCheckingQrStatus, setIsCheckingQrStatus] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null)

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
    setQuantity((current) => {
      if (remainingStock <= 0) return 0
      if (current < 1 || current > remainingStock) return 1
      return current
    })
  }, [remainingStock, selectedProductId])

  const subtotal = saleItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const isTestCart = isPaymentTestCart(saleItems)
  const tax = isTestCart ? 0 : Math.round(subtotal * 0.12 * 100) / 100
  const total = Math.round((subtotal + tax) * 100) / 100

  // Cash change calculation
  const trimmedTendered = cashTendered.trim()
  const numericTendered = trimmedTendered === '' ? Number.NaN : parseFloat(trimmedTendered)
  const hasInvalidTenderedInput = trimmedTendered !== '' && (isNaN(numericTendered) || numericTendered < 0)
  const hasCashShortage =
    trimmedTendered !== '' && (isNaN(numericTendered) || numericTendered < total)
  const effectiveCashTendered =
    trimmedTendered !== '' && !isNaN(numericTendered) ? numericTendered : total
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

  // Open pre-commit verification modal before saving Cash sale to DB
  const handleOpenVerifyModal = () => {
    if (isProcessingRef.current || isProcessing) return

    if (saleItems.length === 0) {
      toast({
        title: 'Cart is empty',
        description: 'Please add at least one product to process payment.',
        variant: 'destructive',
      })
      return
    }

    setIsVerifyModalOpen(true)
  }

  // Handle Cash Payment Submission (after verification)
  const handleCashSubmit = async () => {
    if (isProcessingRef.current || isProcessing) return

    if (saleItems.length === 0) {
      toast({
        title: 'Cart is empty',
        description: 'Please add at least one product to process payment.',
        variant: 'destructive',
      })
      return
    }

    if (hasCashShortage) {
      toast({
        title: 'Insufficient cash received',
        description: 'Cash received must be at least the transaction total.',
        variant: 'destructive',
      })
      return
    }

    isProcessingRef.current = true
    setIsProcessing(true)

    try {
      const clientSaleId = clientSaleIdRef.current
      const tendered = effectiveCashTendered
      const result = await createPosSale({
        cashierName: user?.name || 'Store Staff',
        customerName: customerName.trim() || 'Walk-in Customer',
        items: saleItems,
        notes,
        paymentMethod: 'Cash',
        clientSaleId,
        tenderedAmount: tendered,
      })

      toast({
        title: result.ok ? 'POS sale completed' : 'Unable to process sale',
        description: result.message,
        variant: result.ok ? 'default' : 'destructive',
      })

      if (result.ok) {
        setIsVerifyModalOpen(false)
        setSaleItems([])
        setCustomerName('')
        setNotes('')
        setQuantity(1)
        setCashTendered('')
        clientSaleIdRef.current = generateClientSaleId()

        if (result.data) {
          setLastCashTendered(tendered)
          setReceiptOrder(result.data)
          setIsReceiptModalOpen(true)
        }
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

  // Handle Voiding / Cancelling a completed POS transaction
  const handleVoidPosSale = async (orderId: string, reason: string) => {
    const result = await adminCancelOrder(orderId, reason)
    toast({
      title: result.ok ? 'POS transaction voided' : 'Unable to void transaction',
      description: result.message,
      variant: result.ok ? 'default' : 'destructive',
    })
    if (result.ok && result.data) {
      setReceiptOrder(result.data)
    }
    return result.ok
  }

  // Handle Generating PayMongo QR Payment
  const handleGenerateQr = async () => {
    if (isGeneratingQr || isProcessing) return

    if (saleItems.length === 0) {
      toast({
        title: 'Cart is empty',
        description: 'Please add at least one product before generating a QR payment.',
        variant: 'destructive',
      })
      return
    }

    setIsGeneratingQr(true)

    try {
      const clientSaleId = clientSaleIdRef.current
      const authHeaders = await getAuthHeaders(user)
      const response = await fetch('/api/admin/pos/paymongo-qr', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders,
        },
        body: JSON.stringify({
          amount: total,
          saleItems,
          customerName: customerName.trim() || 'Walk-in Customer',
          cashierName: user?.name || 'Store Staff',
          clientSaleId,
        }),
      })

      const data = await response.json()

      if (!response.ok || !data.ok) {
        throw new Error(data.error || 'Failed to generate PayMongo QR payment session.')
      }

      // Use native QR Ph base64 image from PayMongo if available, otherwise generate QR code
      let qrDataUrl = data.qrImageUrl || ''
      if (!qrDataUrl && data.checkoutUrl) {
        qrDataUrl = await QRCode.toDataURL(data.checkoutUrl, {
          width: 320,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#ffffff',
          },
          errorCorrectionLevel: 'M',
        })
      }

      const itemSnapshots: QrModalItemSnapshot[] = saleItems.map((item) => ({
        name: getProductById(item.productId)?.name ?? 'Unknown Product',
        size: item.size,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
      }))

      setQrModalData({
        paymentIntentId: data.paymentIntentId,
        sessionId: data.sessionId,
        checkoutUrl: data.checkoutUrl,
        qrImage: qrDataUrl,
        environment: data.environment,
        total,
        subtotal,
        tax,
        customerName: customerName.trim() || 'Walk-in Customer',
        items: itemSnapshots,
      })

      setQrPaymentStatus('awaiting')
      setIsQrModalOpen(true)
    } catch (error) {
      toast({
        title: 'QR Generation Failed',
        description: error instanceof Error ? error.message : 'Unable to connect to PayMongo API.',
        variant: 'destructive',
      })
    } finally {
      setIsGeneratingQr(false)
    }
  }

  // Finalize POS sale when QR payment is confirmed
  const finalizeQrSale = async (referenceId: string, paymentChannel?: string, paymentId?: string) => {
    if (isProcessingRef.current) return
    isProcessingRef.current = true
    setIsProcessing(true)

    try {
      const combinedNotes = [
        notes.trim(),
        `PayMongo QR Ph ref: ${referenceId}`,
        paymentChannel ? `PayMongo channel: ${paymentChannel}` : 'PayMongo channel: QR Ph',
        paymentId ? `Payment ref: ${paymentId}` : '',
      ]
        .filter(Boolean)
        .join(' | ')

      const result = await createPosSale({
        cashierName: user?.name || 'Store Staff',
        customerName: customerName.trim() || 'Walk-in Customer',
        items: saleItems,
        notes: combinedNotes,
        paymentMethod: 'QR Pay',
        clientSaleId: clientSaleIdRef.current,
      })

      if (result.ok) {
        setQrPaymentStatus('paid')
        toast({
          title: 'QR Payment Confirmed!',
          description: `Sale ${result.data?.id ?? ''} processed successfully via PayMongo.`,
          variant: 'default',
        })

        // Auto-close QR modal and show the official receipt modal
        setTimeout(() => {
          setIsQrModalOpen(false)
          setQrModalData(null)
          setSaleItems([])
          setCustomerName('')
          setNotes('')
          setCashTendered('')
          clientSaleIdRef.current = generateClientSaleId()
          if (result.data) {
            setLastCashTendered(undefined)
            setReceiptOrder(result.data)
            setIsReceiptModalOpen(true)
          }
        }, 1200)
      } else {
        toast({
          title: 'Error recording sale',
          description: result.message,
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error recording sale',
        description: error instanceof Error ? error.message : 'Failed to save completed sale.',
        variant: 'destructive',
      })
    } finally {
      isProcessingRef.current = false
      setIsProcessing(false)
    }
  }

  // Check QR Payment Status
  const checkQrStatus = async (isManualCheck = false) => {
    const referenceId = qrModalData?.paymentIntentId || qrModalData?.sessionId
    if (!referenceId || qrPaymentStatus === 'paid') return

    if (isManualCheck) setIsCheckingQrStatus(true)

    try {
      const authHeaders = await getAuthHeaders(user)
      const queryParams = new URLSearchParams({
        ...(qrModalData?.paymentIntentId ? { paymentIntentId: qrModalData.paymentIntentId } : {}),
        ...(qrModalData?.sessionId ? { sessionId: qrModalData.sessionId } : {}),
      })
      const res = await fetch(
        `/api/admin/pos/paymongo-qr/status?${queryParams.toString()}`,
        {
          headers: {
            ...authHeaders,
          },
          cache: 'no-store',
        },
      )
      const data = await res.json()

      if (data.ok && data.isPaid) {
        if (pollIntervalRef.current) {
          clearInterval(pollIntervalRef.current)
          pollIntervalRef.current = null
        }
        await finalizeQrSale(
          data.paymentIntentId || data.sessionId || referenceId,
          data.paymentChannel,
          data.paymentId,
        )
      } else if (isManualCheck) {
        toast({
          title: 'Payment Pending',
          description: 'Payment has not been completed by the customer yet.',
          variant: 'default',
        })
      }
    } catch {
      // Background poll errors silent, manual check shows message
      if (isManualCheck) {
        toast({
          title: 'Status Check Failed',
          description: 'Could not connect to verify payment status.',
          variant: 'destructive',
        })
      }
    } finally {
      if (isManualCheck) setIsCheckingQrStatus(false)
    }
  }

  const checkQrStatusRef = useRef(checkQrStatus)
  checkQrStatusRef.current = checkQrStatus

  // Real-time polling when QR Modal is active
  useEffect(() => {
    const referenceId = qrModalData?.paymentIntentId || qrModalData?.sessionId
    if (!isQrModalOpen || !referenceId || qrPaymentStatus === 'paid') {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
      return
    }

    // Poll every 2.5 seconds
    pollIntervalRef.current = setInterval(() => {
      checkQrStatusRef.current(false)
    }, 2500)

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current)
        pollIntervalRef.current = null
      }
    }
  }, [isQrModalOpen, qrModalData?.paymentIntentId, qrModalData?.sessionId, qrPaymentStatus])

  const copyPaymentLink = async () => {
    if (!qrModalData?.checkoutUrl) return
    try {
      await navigator.clipboard.writeText(qrModalData.checkoutUrl)
      setCopiedLink(true)
      setTimeout(() => setCopiedLink(false), 2000)
      toast({
        title: 'Link Copied',
        description: 'Payment link copied to clipboard.',
      })
    } catch {
      toast({
        title: 'Copy Failed',
        description: qrModalData.checkoutUrl,
      })
    }
  }

  return (
    <ProtectedRoute requiredRole={['ADMIN', 'STAFF']}>
      <div data-ui="pos-terminal" className="flex min-h-screen bg-background">
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
                    Process in-store transactions with dynamic PayMongo QR Pay (GCash, Maya, QR Ph) and Cash.
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
                          <QuantityInput
                            value={remainingStock > 0 ? quantity : 0}
                            max={remainingStock}
                            min={1}
                            onChange={setQuantity}
                            disabled={remainingStock <= 0}
                            ariaLabel="POS Item Quantity"
                          />
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
                  <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
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
                            className="rounded-xl border border-border bg-background/70 p-4 transition-colors"
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
                                <QuantityInput
                                  size="sm"
                                  value={item.quantity}
                                  max={stock}
                                  min={1}
                                  onChange={(nextQty) =>
                                    updateItemQuantity(item.productId, item.size, nextQty)
                                  }
                                  ariaLabel={`${product?.name ?? 'Item'} quantity`}
                                />
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
                      <span>12% VAT</span>
                      <span>+ {formatPHP(tax)}</span>
                    </div>
                    <div className="flex justify-between text-lg font-semibold text-foreground pt-1 border-t border-border/60">
                      <span>Total</span>
                      <span className="text-accent font-bold">{formatPHP(total)}</span>
                    </div>
                  </div>

                  {/* PAYMENT METHOD SELECTION */}
                  <div className="mt-6 border-t border-border pt-5">
                    <label className="text-sm font-semibold text-foreground/80 block mb-2.5">
                      Payment Method
                    </label>

                    <div className="grid grid-cols-2 gap-3">
                      {/* Cash Option */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('Cash')}
                        className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                          paymentMethod === 'Cash'
                            ? 'border-accent bg-accent/15 text-accent ring-1 ring-accent'
                            : 'border-border bg-background text-foreground/80 hover:bg-muted'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${paymentMethod === 'Cash' ? 'bg-accent text-accent-foreground' : 'bg-muted text-foreground/70'}`}>
                          <Banknote className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-semibold text-sm">Cash</div>
                          <div className="text-[11px] opacity-75">Tendered & Change</div>
                        </div>
                      </button>

                      {/* QR Pay (PayMongo) Option */}
                      <button
                        type="button"
                        onClick={() => setPaymentMethod('QR Pay')}
                        className={`flex items-center gap-3 rounded-xl border p-3.5 text-left transition-colors ${
                          paymentMethod === 'QR Pay'
                            ? 'border-accent bg-accent/15 text-accent ring-1 ring-accent'
                            : 'border-border bg-background text-foreground/80 hover:bg-muted'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${paymentMethod === 'QR Pay' ? 'bg-accent text-accent-foreground' : 'bg-muted text-foreground/70'}`}>
                          <QrCode className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="font-semibold text-sm flex items-center gap-1.5">
                            QR Pay
                            <span className="rounded bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] px-1.5 py-0.5 font-semibold">
                              PayMongo
                            </span>
                          </div>
                          <div className="text-[11px] opacity-75 truncate">
                            GCash &bull; Maya &bull; QR Ph &bull; Card
                          </div>
                        </div>
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

                    {/* QR Pay Helper text */}
                    {paymentMethod === 'QR Pay' && saleItems.length > 0 && (
                      <div className="mt-4 rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-foreground/80 flex items-start gap-2.5">
                        <QrCode className="h-4 w-4 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-foreground">
                            Scan with GCash, Maya, or any QR Ph app
                          </p>
                          <p className="text-foreground/60 text-[11px] mt-0.5">
                            Clicking below will generate a dynamic QR code for{' '}
                            <span className="font-semibold text-foreground">{formatPHP(total)}</span>.
                            The customer scans it on their phone to pay the exact amount.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* PROCESS BUTTON */}
                <div className="mt-6 pt-4 border-t border-border">
                  {paymentMethod === 'Cash' ? (
                    <Button
                      className="w-full bg-accent hover:bg-accent/90 text-accent-foreground py-6 text-base font-semibold transition-colors disabled:opacity-50"
                      onClick={handleOpenVerifyModal}
                      disabled={saleItems.length === 0 || isProcessing}
                    >
                      {isProcessing ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Processing Payment...
                        </>
                      ) : (
                        <>
                          <ShieldCheck className="mr-2 h-5 w-5" />
                          Review &amp; Verify Cash Sale &bull; {formatPHP(total)}
                        </>
                      )}
                    </Button>
                  ) : (
                    <Button
                      className="w-full bg-accent hover:bg-accent/90 text-accent-foreground py-6 text-base font-semibold transition-colors disabled:opacity-50"
                      onClick={handleGenerateQr}
                      disabled={saleItems.length === 0 || isGeneratingQr || isProcessing}
                    >
                      {isGeneratingQr ? (
                        <>
                          <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                          Generating PayMongo QR...
                        </>
                      ) : (
                        <>
                          <QrCode className="mr-2 h-5 w-5" />
                          Generate QR Code &bull; {formatPHP(total)}
                        </>
                      )}
                    </Button>
                  )}
                </div>

                {/* Recent POS Activity */}
                <div className="mt-8 border-t border-border pt-6">
                  <div className="flex items-center justify-between gap-2 mb-3">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold text-foreground/75">
                        Recent POS Activity
                      </h3>
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-semibold text-foreground/65">
                        {filteredPosTransactions.length} / {posTransactions.length}
                      </span>
                    </div>
                    <Link
                      href="/admin/orders?channel=pos"
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
                    >
                      Open in Orders
                    </Link>
                  </div>

                  {posTransactions.length > 0 && (
                    <div className="mb-3 flex items-center gap-2">
                      <input
                        type="text"
                        value={activitySearch}
                        onChange={(e) => setActivitySearch(e.target.value)}
                        placeholder="Search TX ID, date (e.g. Oct, Nov 8), customer..."
                        aria-label="Filter POS activity"
                        className="h-8 flex-1 rounded-lg border border-border bg-background px-2.5 text-xs text-foreground placeholder:text-foreground/45 focus:outline-none focus:ring-2 focus:ring-accent"
                      />
                      <button
                        type="button"
                        onClick={() => setHideVoidedActivity((prev) => !prev)}
                        className={`h-8 shrink-0 rounded-lg border px-2.5 text-[11px] font-medium transition-colors ${
                          hideVoidedActivity
                            ? 'border-accent bg-accent/15 text-foreground'
                            : 'border-border bg-background text-foreground/65 hover:bg-muted'
                        }`}
                      >
                        {hideVoidedActivity ? 'Showing active' : 'Hide voided'}
                      </button>
                    </div>
                  )}

                  <div className="max-h-[380px] overflow-y-auto space-y-2.5 pr-1">
                    {posTransactions.length === 0 ? (
                      <p className="text-xs text-foreground/50 italic">No recent transactions.</p>
                    ) : filteredPosTransactions.length === 0 ? (
                      <p className="text-xs text-foreground/50 italic">
                        No POS transactions match your filter.
                      </p>
                    ) : (
                      filteredPosTransactions.map((transaction) => {
                        const linkedOrder = ordersById.get(transaction.orderId)
                        const isVoided = linkedOrder?.status === 'Cancelled'

                        return (
                          <button
                            key={transaction.id}
                            type="button"
                            onClick={() => {
                              if (!linkedOrder) {
                                toast({
                                  title: 'Receipt loading',
                                  description: 'Order details are still syncing. Please try again in a moment.',
                                })
                                return
                              }
                              setLastCashTendered(undefined)
                              setReceiptOrder(linkedOrder)
                              setIsReceiptModalOpen(true)
                            }}
                            className="w-full text-left rounded-xl border border-border/80 bg-background/50 p-3 flex items-center justify-between gap-3 text-xs transition-colors hover:bg-muted/60 hover:border-accent/40"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <p className="font-medium text-foreground">{transaction.id}</p>
                                <span
                                  className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                    transaction.paymentMethod === 'QR Pay'
                                      ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                                      : 'bg-muted text-foreground/70'
                                  }`}
                                >
                                  {transaction.paymentMethod}
                                </span>
                                {isVoided && (
                                  <span className="inline-flex items-center gap-1 rounded bg-rose-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700 dark:text-rose-400">
                                    <Ban className="h-2.5 w-2.5" />
                                    Voided
                                  </span>
                                )}
                              </div>
                              <p className="text-foreground/55 mt-0.5 truncate">
                                {transaction.itemsCount} item(s) &bull; {linkedOrder?.customerName ?? 'Walk-in Customer'} &bull; {transaction.cashierName}
                              </p>
                            </div>
                            <div className="text-right shrink-0">
                              <p
                                className={`font-semibold ${
                                  isVoided ? 'text-foreground/45 line-through' : 'text-foreground'
                                }`}
                              >
                                {formatPHP(transaction.total)}
                              </p>
                              <div className="mt-0.5 flex items-center justify-end gap-1 text-[10px] text-foreground/50">
                                <Printer className="h-2.5 w-2.5" />
                                <span>
                                  {new Date(transaction.createdAt).toLocaleString('en-PH', {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              </div>
                            </div>
                          </button>
                        )
                      })
                    )}
                  </div>
                </div>
              </section>
            </div>
          </div>
        </div>
      </div>

      {/* PRE-COMMIT CASH SALE VERIFICATION MODAL */}
      <Dialog open={isVerifyModalOpen} onOpenChange={setIsVerifyModalOpen}>
        <DialogContent
          data-ui="pos-verify-modal"
          className="max-w-lg max-h-[90svh] overflow-y-auto bg-card text-foreground border-border"
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-serif text-xl">
              <ShieldCheck className="h-5 w-5 text-accent" />
              Verify Sale Before Saving
            </DialogTitle>
            <DialogDescription>
              Check the items, prices, and payment with the customer. Nothing is saved to the database until you confirm.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 text-sm">
            {/* Customer & Cashier Summary */}
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-background/60 p-3 text-xs">
              <div>
                <p className="text-foreground/55">Customer</p>
                <p className="font-medium text-foreground">
                  {customerName.trim() || 'Walk-in Customer'}
                </p>
              </div>
              <div>
                <p className="text-foreground/55">Cashier</p>
                <p className="font-medium text-foreground">
                  {user?.name || 'Store Staff'}
                </p>
              </div>
              {notes.trim() && (
                <div className="col-span-2">
                  <p className="text-foreground/55">Cashier Notes</p>
                  <p className="font-medium text-foreground">{notes.trim()}</p>
                </div>
              )}
            </div>

            {/* Itemized Price Breakdown */}
            <div className="rounded-xl border border-border bg-background/60 p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border text-foreground/60">
                    <th className="py-1.5 text-left font-medium">Item</th>
                    <th className="py-1.5 text-right font-medium">Qty</th>
                    <th className="py-1.5 text-right font-medium">Price</th>
                    <th className="py-1.5 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {saleItems.map((item) => {
                    const product = getProductById(item.productId)
                    return (
                      <tr
                        key={`${item.productId}-${item.size}`}
                        className="border-b border-border/50 last:border-b-0"
                      >
                        <td className="py-2 pr-2">
                          <p className="font-medium text-foreground">
                            {product?.name ?? 'Unknown Product'}
                          </p>
                          <p className="text-[11px] text-foreground/55">{item.size}ml</p>
                        </td>
                        <td className="py-2 text-right text-foreground/80">{item.quantity}</td>
                        <td className="py-2 text-right text-foreground/80">
                          {formatPHP(item.unitPrice)}
                        </td>
                        <td className="py-2 text-right font-medium text-foreground">
                          {formatPHP(item.unitPrice * item.quantity)}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals & Cash Tendered Verification */}
            <div className="rounded-xl border border-border bg-background/60 p-4 space-y-2.5 text-xs">
              <div className="flex justify-between text-foreground/70">
                <span>Subtotal</span>
                <span>{formatPHP(subtotal)}</span>
              </div>
              <div className="flex justify-between text-foreground/70">
                <span>12% VAT</span>
                <span>+ {formatPHP(tax)}</span>
              </div>
              <div className="flex justify-between pt-2 border-t border-border text-base font-semibold text-foreground">
                <span>Total Amount Due</span>
                <span className="text-accent">{formatPHP(total)}</span>
              </div>

              <div className="pt-3 border-t border-border space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="verify-cash-tendered" className="font-medium text-foreground">
                    Cash Received (₱)
                  </label>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCashTendered(total.toString())}
                      className="rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground/80 hover:bg-muted"
                    >
                      Exact
                    </button>
                    <input
                      id="verify-cash-tendered"
                      type="number"
                      min={0}
                      step="any"
                      placeholder={total.toFixed(2)}
                      value={cashTendered}
                      onChange={(e) => setCashTendered(e.target.value)}
                      className="w-28 rounded-lg border border-border bg-background px-2.5 py-1 text-right font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                    />
                  </div>
                </div>

                {hasInvalidTenderedInput || hasCashShortage ? (
                  <p className="text-xs font-medium text-destructive">
                    {hasInvalidTenderedInput
                      ? 'Enter a valid cash amount.'
                      : `Cash received is short by ${formatPHP(shortageAmount)}. Adjust amount or cancel to edit items.`}
                  </p>
                ) : (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-foreground/65">
                      {trimmedTendered === '' ? 'Exact cash assumed:' : 'Change Due:'}
                    </span>
                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                      {trimmedTendered === ''
                        ? formatPHP(total)
                        : formatPHP(changeAmount)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:justify-between">
            <Button
              type="button"
              variant="outline"
              disabled={isProcessing}
              onClick={() => setIsVerifyModalOpen(false)}
            >
              Cancel / Edit Sale
            </Button>
            <Button
              type="button"
              disabled={isProcessing || hasInvalidTenderedInput || hasCashShortage}
              onClick={() => void handleCashSubmit()}
            >
              {isProcessing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving to Database...
                </>
              ) : (
                <>
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  Confirm &amp; Save Sale
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* OFFICIAL RECEIPT & VOID MODAL */}
      <PosReceiptModal
        open={isReceiptModalOpen}
        onOpenChange={setIsReceiptModalOpen}
        order={activeReceiptOrder}
        transaction={activeReceiptTransaction}
        actor={user ? { role: user.role } : null}
        fallbackTendered={lastCashTendered}
        onVoidSale={handleVoidPosSale}
      />

      {/* PAYMONGO DYNAMIC QR PAY MODAL */}
      {isQrModalOpen && qrModalData && (
        <div
          data-ui="pos-qr-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 animate-in fade-in duration-200"
        >
          <div className="relative w-full max-w-md max-h-[92svh] overflow-y-auto rounded-3xl border border-border bg-card p-6 space-y-5 animate-in zoom-in-95 duration-200">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => {
                if (pollIntervalRef.current) {
                  clearInterval(pollIntervalRef.current)
                  pollIntervalRef.current = null
                }
                setIsQrModalOpen(false)
              }}
              className="absolute right-4 top-4 rounded-full p-2 text-foreground/60 hover:bg-muted hover:text-foreground transition-colors"
              aria-label="Close modal"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Modal Header */}
            <div className="text-center pt-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-semibold mb-2">
                <QrCode className="h-3.5 w-3.5" />
                PayMongo QR Pay
              </div>
              <h3 className="font-serif text-2xl text-foreground font-medium">Scan to Pay</h3>
              <p className="text-xs text-foreground/60 mt-1">
                Verify items and total below. Nothing is saved until payment succeeds.
              </p>
            </div>

            {/* Amount Banner & Itemized Verification Summary */}
            <div className="rounded-2xl border border-border bg-background/80 p-4 space-y-3">
              <div className="text-center">
                <p className="text-xs font-medium text-foreground/60">
                  Total Amount Due
                </p>
                <p className="text-3xl font-serif font-bold text-accent mt-1">
                  {formatPHP(qrModalData.total)}
                </p>
                <p className="text-xs text-foreground/60 mt-1">
                  Customer: <span className="font-medium text-foreground">{qrModalData.customerName}</span>
                </p>
              </div>

              {qrModalData.items.length > 0 && (
                <div className="border-t border-border/70 pt-2.5 space-y-1 text-xs">
                  {qrModalData.items.map((item, idx) => (
                    <div key={`${item.name}-${item.size}-${idx}`} className="flex justify-between gap-2 text-foreground/75">
                      <span className="truncate">
                        {item.quantity}x {item.name} ({item.size}ml)
                      </span>
                      <span className="font-medium text-foreground shrink-0">
                        {formatPHP(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  ))}
                  <div className="flex justify-between text-[11px] text-foreground/55 pt-1">
                    <span>Subtotal {formatPHP(qrModalData.subtotal)}</span>
                    <span>VAT {formatPHP(qrModalData.tax)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* QR Code Container */}
            <div className="flex flex-col items-center justify-center">
              <div className="relative rounded-2xl border-2 border-border bg-white p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={qrModalData.qrImage}
                  alt="PayMongo Payment QR Code"
                  className="w-56 h-56 object-contain"
                />

                {/* Paid Overlay */}
                {qrPaymentStatus === 'paid' && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/95 rounded-2xl animate-in zoom-in-90 duration-300">
                    <div className="rounded-full bg-emerald-100 p-3 text-emerald-600 mb-2">
                      <CheckCircle2 className="h-12 w-12" />
                    </div>
                    <p className="font-serif text-lg font-bold text-emerald-700">Payment Received!</p>
                    <p className="text-xs text-emerald-600">Generating receipt...</p>
                  </div>
                )}
              </div>

              {/* Live Status Indicator */}
              <div className="mt-4 flex items-center gap-2 text-xs font-medium">
                {qrPaymentStatus === 'paid' ? (
                  <span className="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
                    <Check className="h-4 w-4" />
                    Payment Confirmed
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-foreground/70">
                    <span className="inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                    Waiting for customer payment...
                  </span>
                )}
              </div>
            </div>

            {/* Cashier Actions */}
            <div className="space-y-2 pt-2 border-t border-border/80">
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => checkQrStatus(true)}
                  disabled={isCheckingQrStatus || qrPaymentStatus === 'paid'}
                  className="text-xs"
                >
                  {isCheckingQrStatus ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Check Status
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={copyPaymentLink}
                  className="text-xs"
                >
                  {copiedLink ? (
                    <Check className="mr-1.5 h-3.5 w-3.5 text-emerald-500" />
                  ) : (
                    <Copy className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  {copiedLink ? 'Copied!' : 'Copy Link'}
                </Button>
              </div>

              {/* Open in New Tab option */}
              <div className="flex items-center justify-between text-xs px-1">
                {qrModalData.checkoutUrl ? (
                  <a
                    href={qrModalData.checkoutUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-accent hover:underline flex items-center gap-1"
                  >
                    Open checkout page <ExternalLink className="h-3 w-3" />
                  </a>
                ) : (
                  <span className="text-foreground/50 text-[11px] flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 inline-block" />
                    Official BSP QR Ph Code
                  </span>
                )}

                <button
                  type="button"
                  onClick={() => {
                    if (pollIntervalRef.current) {
                      clearInterval(pollIntervalRef.current)
                      pollIntervalRef.current = null
                    }
                    setIsQrModalOpen(false)
                  }}
                  className="text-muted-foreground hover:text-foreground"
                >
                  Cancel & Return to POS
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </ProtectedRoute>
  )
}
