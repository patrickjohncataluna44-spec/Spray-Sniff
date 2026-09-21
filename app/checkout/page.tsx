'use client'

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import {
  Banknote,
  Check,
  ChevronLeft,
  Compass,
  CreditCard,
  Crosshair,
  Edit3,
  ExternalLink,
  Lock,
  MapPin,
  Minus,
  Plus,
  QrCode,
  ShieldCheck,
  Ticket,
  Truck,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StorefrontShell } from '@/components/storefront-shell'
import { Spinner } from '@/components/ui/spinner'
import { calculateVatBreakdown, formatPHP } from '@/lib/currency'
import type { PaymongoCheckoutLineItem } from '@/lib/paymongo'
import { ONLINE_PAYMENT_METHODS, useStore } from '@/lib/store-context'
import { isPaymentTestCart, PAYMENT_TEST_PRODUCT_ID, type CartItem, type OrderRecord } from '@/lib/store-engine'
import { useAuth } from '@/lib/auth-context'
import { toast } from '@/hooks/use-toast'
import type { SelectedLocationData } from '@/components/address-map-picker'

const AddressMapPicker = dynamic(() => import('@/components/address-map-picker'), {
  ssr: false,
  loading: () => (
    <div className="mt-3 h-48 w-full animate-pulse rounded-2xl bg-slate-100 flex items-center justify-center border border-slate-200">
      <div className="flex items-center gap-2 text-xs text-slate-400 font-medium">
        <MapPin className="h-4 w-4 animate-bounce text-[#4F46E5]" />
        Loading OpenStreetMap...
      </div>
    </div>
  ),
})

const CHECKOUT_SIGN_IN_HREF = '/auth/signin?redirectTo=%2Fcheckout&reason=checkout'
const PAYMONGO_PENDING_CHECKOUT_KEY = 'paymongo-pending-checkout'
const PAYMONGO_PAYMENT_METHOD_VALUE = 'PayMongo'
const CHECKOUT_SAVED_ADDRESS_KEY = 'perfume_saved_delivery_address'
const CART_SELECTED_STORAGE_KEY = 'fragrance_selected_cart_items'

function getCheckoutItemKey(productId: string, size: number) {
  return `${productId}-${size}`
}

interface SavedDeliveryInfo {
  firstName: string
  lastName: string
  phone: string
  address: string
  city: string
  state: string
  zip: string
  country: string
  latitude?: number | null
  longitude?: number | null
}

interface PendingPaymongoCheckout {
  token?: string
  checkoutSessionId: string
  shippingAddress: string
  customerName: string
  customerEmail: string
  expectedAmount?: number
  reference: string
  notes: string
  paymentMethodLabel?: string
  items?: CartItem[]
}

function isPaymongoCheckoutMethod(method: string) {
  return method === PAYMONGO_PAYMENT_METHOD_VALUE
}

function waitForNextVerificationAttempt(durationMs: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, durationMs)
  })
}

function QRPhBadge() {
  return (
    <div className="flex items-center gap-1 select-none">
      <span className="flex items-center gap-1 text-[11px] font-extrabold text-[#4F46E5] bg-[#ECECFE] border border-[#4F46E5]/20 px-2.5 py-1 rounded-lg">
        <QrCode className="h-3.5 w-3.5 text-[#4F46E5]" />
        QR Ph
      </span>
    </div>
  )
}

function CheckoutContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    cart,
    getAvailableStock,
    getInventoryRecord,
    getProductById,
    isStoreLoading,
    placeOnlineOrder,
    updateCartQuantity,
    removeFromCart,
  } = useStore()
  const { user, isAuthenticated, canAccessBackoffice, isLoading: authLoading, updateProfile } = useAuth()

  const [orderPlaced, setOrderPlaced] = useState(false)
  const [orderNumber, setOrderNumber] = useState<string | null>(null)
  const [confirmedOrder, setConfirmedOrder] = useState<OrderRecord | null>(null)
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false)
  const [isVerifyingPayment, setIsVerifyingPayment] = useState(false)
  const [isEditingAddress, setIsEditingAddress] = useState(false)
  const [saveAddressForFuture, setSaveAddressForFuture] = useState(true)

  // Promotion / voucher code state (matching reference image GRATISONGKR)
  const [promoInput, setPromoInput] = useState('')
  const [appliedPromo, setAppliedPromo] = useState<{
    code: string
    type: 'Percentage' | 'Fixed' | 'Shipping'
    discount: number
  } | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)

  const paymentVerificationStarted = useRef(false)
  const checkoutSubmissionLock = useRef(false)

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    state: '',
    zip: '',
    country: 'PH',
    latitude: null as number | null,
    longitude: null as number | null,
    paymentMethod: PAYMONGO_PAYMENT_METHOD_VALUE,
    cardNumber: '1234 5678 9101 1121',
    cardHolder: '',
    cardExpiry: '12/28',
    cardCvv: '888',
    saveCard: true,
    reference: '',
    notes: '',
  })

  useEffect(() => {
    if (authLoading) return

    if (!isAuthenticated) {
      router.replace(CHECKOUT_SIGN_IN_HREF)
      return
    }

    if (!user || user.role !== 'USER') {
      router.replace(canAccessBackoffice ? '/admin/dashboard' : '/')
    }
  }, [authLoading, canAccessBackoffice, isAuthenticated, router, user])

  // Pre-fill user profile & saved delivery address (dili na sila mo fill up ug balik!)
  useEffect(() => {
    if (!user) return

    let savedLocal: Partial<SavedDeliveryInfo> = {}
    try {
      const stored = localStorage.getItem(CHECKOUT_SAVED_ADDRESS_KEY)
      if (stored) savedLocal = JSON.parse(stored)
    } catch {}

    const [firstName = '', ...rest] = user.name.split(' ')
    const resolvedFirstName = savedLocal.firstName || firstName
    const resolvedLastName = savedLocal.lastName || rest.join(' ')
    const resolvedPhone = savedLocal.phone || user.phone || ''
    const resolvedAddress = savedLocal.address || user.address || ''
    const resolvedCity = savedLocal.city || user.city || ''
    const resolvedState = savedLocal.state || ''
    const resolvedZip = savedLocal.zip || user.postalCode || ''
    const resolvedCountry = savedLocal.country || 'PH'
    const resolvedLat = typeof savedLocal.latitude === 'number' ? savedLocal.latitude : null
    const resolvedLng = typeof savedLocal.longitude === 'number' ? savedLocal.longitude : null

    setFormData((current) => ({
      ...current,
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      cardHolder: `${resolvedFirstName} ${resolvedLastName}`.trim() || user.name,
      email: user.email,
      phone: resolvedPhone,
      address: resolvedAddress,
      city: resolvedCity,
      state: resolvedState,
      zip: resolvedZip,
      country: resolvedCountry,
      latitude: resolvedLat,
      longitude: resolvedLng,
    }))

    if (resolvedAddress && resolvedCity && resolvedPhone) {
      setIsEditingAddress(false)
    } else {
      setIsEditingAddress(true)
    }
  }, [user])

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => {
    if (typeof window === 'undefined') return new Set()
    try {
      const stored = localStorage.getItem(CART_SELECTED_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed) && parsed.length > 0) {
          return new Set(parsed)
        }
      }
    } catch {}
    return new Set()
  })

  // Synchronize with cart
  useEffect(() => {
    if (cart.length === 0) return

    setSelectedKeys((prev) => {
      const currentCartKeys = cart.map((i) => getCheckoutItemKey(i.productId, i.size))
      const matchingKeys = Array.from(prev).filter((k) => currentCartKeys.includes(k))

      if (matchingKeys.length > 0) {
        return new Set(matchingKeys)
      }

      // Default: all in stock
      const inStockKeys = cart
        .filter((item) => {
          const record = getInventoryRecord(item.productId)
          const availableStock = getAvailableStock(item.productId)
          return record && !record.isArchived && availableStock >= item.quantity
        })
        .map((i) => getCheckoutItemKey(i.productId, i.size))

      const fallback = inStockKeys.length > 0 ? inStockKeys : currentCartKeys
      const next = new Set(fallback)
      try {
        localStorage.setItem(CART_SELECTED_STORAGE_KEY, JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }, [cart, getAvailableStock, getInventoryRecord])

  const toggleCheckoutItem = (productId: string, size: number) => {
    const key = getCheckoutItemKey(productId, size)
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        if (next.size <= 1) {
          toast({
            title: 'At least 1 item required',
            description: 'You must have at least 1 item selected to checkout.',
          })
          return prev
        }
        next.delete(key)
      } else {
        next.add(key)
      }
      try {
        localStorage.setItem(CART_SELECTED_STORAGE_KEY, JSON.stringify(Array.from(next)))
      } catch {}
      return next
    })
  }

  const activeCartItems = useMemo(() => {
    if (cart.length === 0) return []
    const selected = cart.filter((item) => selectedKeys.has(getCheckoutItemKey(item.productId, item.size)))
    return selected.length > 0 ? selected : cart
  }, [cart, selectedKeys])

  const orderItems = useMemo(
    () =>
      cart.map((item) => ({
        ...item,
        product: getProductById(item.productId),
        isSelected: selectedKeys.has(getCheckoutItemKey(item.productId, item.size)),
      })),
    [cart, getProductById, selectedKeys],
  )

  const subtotal = activeCartItems.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0)
  const isTestCart = isPaymentTestCart(activeCartItems)
  const rawShipping = isTestCart ? 0 : subtotal >= 400 || subtotal === 0 ? 0 : 75
  const shipping = appliedPromo?.type === 'Shipping' ? 0 : rawShipping

  const discountAmount = useMemo(() => {
    if (!appliedPromo) return 0
    if (appliedPromo.type === 'Percentage') {
      return Math.round(subtotal * (appliedPromo.discount / 100) * 100) / 100
    }
    if (appliedPromo.type === 'Fixed') {
      return Math.min(subtotal, appliedPromo.discount)
    }
    if (appliedPromo.type === 'Shipping') {
      return rawShipping
    }
    return 0
  }, [appliedPromo, subtotal, rawShipping])

  const discountedProductSubtotal = Math.max(0, subtotal - (appliedPromo?.type === 'Shipping' ? 0 : discountAmount))
  // Standard Philippine BIR 12% VAT-inclusive:
  // Price shown is already VAT-inclusive, VAT amount is extracted rather than added
  const { vatAmount: tax } = isTestCart ? { vatAmount: 0 } : calculateVatBreakdown(discountedProductSubtotal)
  const total = Math.max(0, discountedProductSubtotal + shipping)
  const totalQuantity = activeCartItems.reduce((sum, item) => sum + item.quantity, 0)
  const paymentFlow = searchParams.get('paymongo')

  const hasSavedAddress = Boolean(formData.address && formData.city && formData.phone)

  const hasUnavailableItems = activeCartItems.some((item) => {
    const record = getInventoryRecord(item.productId)
    const availableStock = getAvailableStock(item.productId)

    return !record || record.isArchived || availableStock < item.quantity
  })

  const handleChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) => {
    const { name, value, type } = event.target
    setFormData((current) => ({
      ...current,
      [name]:
        type === 'checkbox'
          ? (event.target as HTMLInputElement).checked
          : value,
    }))
  }

  const handleUpdateQuantity = async (productId: string, size: number, newQty: number) => {
    if (newQty <= 0) {
      await removeFromCart(productId, size)
      toast({
        title: 'Item removed',
        description: 'The fragrance was removed from your cart.',
      })
      return
    }

    const available = getAvailableStock(productId)
    if (newQty > available) {
      toast({
        title: 'Stock limit reached',
        description: `Only ${available} unit(s) available in inventory.`,
        variant: 'destructive',
      })
      return
    }

    await updateCartQuantity(productId, size, newQty)
  }

  const handleApplyPromo = () => {
    const code = promoInput.trim().toUpperCase()
    if (!code) return

    if (code === 'GRATISONGKR') {
      setAppliedPromo({
        code: 'GRATISONGKR',
        type: 'Shipping',
        discount: rawShipping > 0 ? rawShipping : 50,
      })
      setPromoError(null)
      toast({
        title: 'Voucher applied',
        description: 'Free Shipping voucher activated!',
      })
    } else if (code === 'WELCOME10') {
      setAppliedPromo({
        code: 'WELCOME10',
        type: 'Fixed',
        discount: 100,
      })
      setPromoError(null)
      toast({
        title: 'Voucher applied',
        description: '₱100.00 discount applied to your order!',
      })
    } else if (code === 'SPRING2024') {
      setAppliedPromo({
        code: 'SPRING2024',
        type: 'Percentage',
        discount: 20,
      })
      setPromoError(null)
      toast({
        title: 'Voucher applied',
        description: '20% discount applied to your order!',
      })
    } else if (code === 'VIP30') {
      setAppliedPromo({
        code: 'VIP30',
        type: 'Percentage',
        discount: 30,
      })
      setPromoError(null)
      toast({
        title: 'Voucher applied',
        description: '30% VIP discount applied to your order!',
      })
    } else {
      setPromoError('Invalid voucher code. Try GRATISONGKR, WELCOME10, or SPRING2024')
    }
  }

  const handleLocationSelected = useCallback((data: SelectedLocationData) => {
    setFormData((current) => ({
      ...current,
      latitude: data.lat,
      longitude: data.lng,
      address: data.street || current.address,
      city: data.city || current.city,
      state: data.province || current.state,
      zip: data.postalCode || current.zip,
    }))
  }, [])

  const buildShippingAddress = () => {
    const base = `${formData.address}, ${formData.city}, ${formData.state} ${formData.zip}, ${formData.country}`.replace(/\s+/g, ' ').trim()
    if (formData.latitude && formData.longitude) {
      return `${base} [GPS: ${formData.latitude.toFixed(5)}, ${formData.longitude.toFixed(5)}]`
    }
    return base
  }

  const buildFullName = () => `${formData.firstName} ${formData.lastName}`.trim()

  const beginCheckoutSubmission = () => {
    if (checkoutSubmissionLock.current) return false
    checkoutSubmissionLock.current = true
    setIsSubmittingPayment(true)
    return true
  }

  const endCheckoutSubmission = () => {
    checkoutSubmissionLock.current = false
    setIsSubmittingPayment(false)
  }

  const readPendingPaymongoCheckout = useCallback(async (): Promise<PendingPaymongoCheckout | null> => {
    const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
    const urlToken = urlParams?.get('session_token') || urlParams?.get('token')
    const urlSessionId = urlParams?.get('sessionId') || urlParams?.get('session_id')

    // 1. Try local storage / session storage by specific token or session ID
    if (typeof window !== 'undefined') {
      if (urlToken) {
        const rawToken = window.localStorage.getItem(`paymongo-pending-${urlToken}`)
        if (rawToken) {
          try { return JSON.parse(rawToken) as PendingPaymongoCheckout } catch {}
        }
      }
      if (urlSessionId) {
        const rawSess = window.localStorage.getItem(`paymongo-pending-${urlSessionId}`)
        if (rawSess) {
          try { return JSON.parse(rawSess) as PendingPaymongoCheckout } catch {}
        }
      }

      // 2. Try default localStorage
      const rawLocal = window.localStorage.getItem(PAYMONGO_PENDING_CHECKOUT_KEY)
      if (rawLocal) {
        try { return JSON.parse(rawLocal) as PendingPaymongoCheckout } catch {}
      }

      // 3. Try sessionStorage
      const rawSession = window.sessionStorage.getItem(PAYMONGO_PENDING_CHECKOUT_KEY)
      if (rawSession) {
        try { return JSON.parse(rawSession) as PendingPaymongoCheckout } catch {}
      }

      // 4. Try cookie
      const cookieMatch = document.cookie.match(/(?:^|;\s*)pm_sess_id=([^;]+)/)
      const cookieSessionId = cookieMatch ? decodeURIComponent(cookieMatch[1]) : null
      if (cookieSessionId) {
        const rawSess = window.localStorage.getItem(`paymongo-pending-${cookieSessionId}`)
        if (rawSess) {
          try { return JSON.parse(rawSess) as PendingPaymongoCheckout } catch {}
        }
      }
    }

    // 5. Try server pending recovery endpoint
    const queryParts: string[] = []
    if (urlToken) queryParts.push(`token=${encodeURIComponent(urlToken)}`)
    if (urlSessionId) queryParts.push(`sessionId=${encodeURIComponent(urlSessionId)}`)
    if (user?.email) queryParts.push(`email=${encodeURIComponent(user.email)}`)

    if (queryParts.length > 0) {
      try {
        const res = await fetch(`/api/paymongo/pending?${queryParts.join('&')}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data.ok && data.pendingCheckout) {
            return data.pendingCheckout as PendingPaymongoCheckout
          }
        }
      } catch (err) {
        console.warn('Pending recovery check failed:', err)
      }
    }

    return null
  }, [user?.email])

  const storePendingPaymongoCheckout = (payload: PendingPaymongoCheckout) => {
    const json = JSON.stringify(payload)
    try {
      window.sessionStorage.setItem(PAYMONGO_PENDING_CHECKOUT_KEY, json)
    } catch {}
    try {
      window.localStorage.setItem(PAYMONGO_PENDING_CHECKOUT_KEY, json)
      if (payload.token) {
        window.localStorage.setItem(`paymongo-pending-${payload.token}`, json)
      }
      if (payload.checkoutSessionId) {
        window.localStorage.setItem(`paymongo-pending-${payload.checkoutSessionId}`, json)
      }
    } catch {}
    try {
      document.cookie = `pm_sess_id=${encodeURIComponent(payload.checkoutSessionId)}; path=/; max-age=7200; SameSite=Lax`
      if (payload.token) {
        document.cookie = `pm_tok=${encodeURIComponent(payload.token)}; path=/; max-age=7200; SameSite=Lax`
      }
    } catch {}
  }

  const clearPendingPaymongoCheckout = (token?: string, sessionId?: string) => {
    try {
      window.sessionStorage.removeItem(PAYMONGO_PENDING_CHECKOUT_KEY)
    } catch {}
    try {
      window.localStorage.removeItem(PAYMONGO_PENDING_CHECKOUT_KEY)
      if (token) window.localStorage.removeItem(`paymongo-pending-${token}`)
      if (sessionId) window.localStorage.removeItem(`paymongo-pending-${sessionId}`)
    } catch {}
    try {
      document.cookie = 'pm_sess_id=; path=/; max-age=0'
      document.cookie = 'pm_tok=; path=/; max-age=0'
    } catch {}
  }

  const verifyPaymongoCheckout = async (pendingCheckout: PendingPaymongoCheckout) => {
    let lastError: Error | null = null

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const response = await fetch(`/api/paymongo/checkout/${encodeURIComponent(pendingCheckout.checkoutSessionId)}`, {
        cache: 'no-store',
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to verify the PayMongo checkout session.')
      }

      if (payload.isPaid || payload.paid) {
        if (typeof pendingCheckout.expectedAmount === 'number' && typeof payload.paidAmount === 'number') {
          if (payload.paidAmount < pendingCheckout.expectedAmount) {
            throw new Error('The recorded payment does not cover the complete total for your perfume order.')
          }
        }
        return
      }

      const paymentStatuses: string[] = Array.isArray(payload.paymentStatuses)
        ? payload.paymentStatuses
            .map((entry: unknown) =>
              entry && typeof entry === 'object' && 'status' in entry ? String(entry.status ?? '').toLowerCase() : '',
            )
            .filter((status: string): status is string => Boolean(status))
        : []
      const sessionStatus = typeof payload.status === 'string' ? payload.status.toLowerCase() : ''

      if (sessionStatus === 'expired' || paymentStatuses.includes('failed')) {
        throw new Error('Your PayMongo payment did not complete successfully. Please try the checkout again.')
      }

      lastError = new Error('Your PayMongo payment is still pending or was not completed.')

      if (attempt < 4) {
        await waitForNextVerificationAttempt(1500)
      }
    }

    throw lastError ?? new Error('We could not confirm your PayMongo payment yet.')
  }

  const finalizeOrder = useCallback(async (pendingCheckout: PendingPaymongoCheckout) => {
    const fallbackItems: CartItem[] = [
      {
        productId: PAYMENT_TEST_PRODUCT_ID,
        size: 50,
        quantity: 1,
        unitPrice: typeof pendingCheckout.expectedAmount === 'number' ? pendingCheckout.expectedAmount / 100 : 1,
      },
    ]

    const result = await placeOnlineOrder({
      customerEmail: pendingCheckout.customerEmail,
      customerName: pendingCheckout.customerName,
      items:
        pendingCheckout.items && pendingCheckout.items.length > 0
          ? pendingCheckout.items
          : activeCartItems && activeCartItems.length > 0
            ? activeCartItems
            : fallbackItems,
      notes: [
        pendingCheckout.reference,
        pendingCheckout.notes,
        `PayMongo session: ${pendingCheckout.checkoutSessionId}`,
        pendingCheckout.paymentMethodLabel ? `PayMongo channel: ${pendingCheckout.paymentMethodLabel}` : '',
      ]
        .filter(Boolean)
        .join(' | '),
      paymentMethod: PAYMONGO_PAYMENT_METHOD_VALUE,
      shippingAddress: pendingCheckout.shippingAddress,
    })

    if (!result.ok || !result.data) {
      throw new Error(result.message)
    }

    setOrderNumber(result.data.id)
    setConfirmedOrder(result.data)
    setOrderPlaced(true)
    clearPendingPaymongoCheckout(pendingCheckout.token, pendingCheckout.checkoutSessionId)

    try {
      const stored = localStorage.getItem(CART_SELECTED_STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored) as string[]
        const orderedItems = pendingCheckout.items || activeCartItems
        const purchasedKeys = new Set(orderedItems.map((i) => getCheckoutItemKey(i.productId, i.size)))
        const remaining = parsed.filter((k) => !purchasedKeys.has(k))
        localStorage.setItem(CART_SELECTED_STORAGE_KEY, JSON.stringify(remaining))
      }
    } catch {}

    router.replace('/checkout')
    toast({
      title: 'Payment confirmed',
      description: `${result.data.id} has been recorded as a paid order.`,
    })
  }, [activeCartItems, placeOnlineOrder, router])

  useEffect(() => {
    if (
      authLoading ||
      !isAuthenticated ||
      !user ||
      user.role !== 'USER' ||
      paymentFlow !== 'success' ||
      paymentVerificationStarted.current
    ) {
      return
    }

    paymentVerificationStarted.current = true
    setIsVerifyingPayment(true)

    readPendingPaymongoCheckout()
      .then(async (pendingCheckout) => {
        if (!pendingCheckout?.checkoutSessionId) {
          toast({
            title: 'Missing payment session',
            description: 'We could not find your pending PayMongo checkout session. Please try checking out again.',
            variant: 'destructive',
          })
          router.replace('/checkout')
          return
        }

        await verifyPaymongoCheckout(pendingCheckout)
        await finalizeOrder(pendingCheckout)
      })
      .catch((error) => {
        paymentVerificationStarted.current = false
        toast({
          title: 'Payment verification failed',
          description:
            error instanceof Error
              ? error.message
              : 'We could not confirm your PayMongo payment yet.',
          variant: 'destructive',
        })
      })
      .finally(() => {
        setIsVerifyingPayment(false)
      })
  }, [authLoading, finalizeOrder, isAuthenticated, paymentFlow, readPendingPaymongoCheckout, router, user])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!user) {
      toast({
        title: 'Sign-in required',
        description: 'Sign in before completing your purchase.',
        variant: 'destructive',
      })
      router.replace(CHECKOUT_SIGN_IN_HREF)
      return
    }

    // Phone validation
    const cleanPhone = formData.phone.trim().replace(/[\s\-()]/g, '')
    const phPattern = /^(09\d{9}|\+639\d{9})$/
    const generalPattern = /^\+?[0-9]{10,15}$/
    if (!cleanPhone || (!phPattern.test(cleanPhone) && !generalPattern.test(cleanPhone))) {
      setIsEditingAddress(true)
      toast({
        title: 'Invalid Contact Number',
        description: 'Please enter a valid phone number (e.g. 0917 123 4567 or +63 917 123 4567) for parcel delivery.',
        variant: 'destructive',
      })
      return
    }

    // Address validation
    if (!formData.address.trim() || !formData.city.trim() || !formData.firstName.trim()) {
      setIsEditingAddress(true)
      toast({
        title: 'Complete your delivery address',
        description: 'First name, street address, and city are required for parcel delivery.',
        variant: 'destructive',
      })
      return
    }

    // Auto-save delivery address for returning customers ("Dili na mo fill-up ug balik!")
    if (saveAddressForFuture || formData.saveCard) {
      try {
        const savedInfo: SavedDeliveryInfo = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          state: formData.state,
          zip: formData.zip,
          country: formData.country,
          latitude: formData.latitude,
          longitude: formData.longitude,
        }
        localStorage.setItem(CHECKOUT_SAVED_ADDRESS_KEY, JSON.stringify(savedInfo))

        void updateProfile({
          name: `${formData.firstName} ${formData.lastName}`.trim(),
          phone: formData.phone,
          address: formData.address,
          city: formData.city,
          postalCode: formData.zip,
        }).catch(() => {})
      } catch {}
    }

    if (!beginCheckoutSubmission()) {
      return
    }

    const shippingAddress = buildShippingAddress()
    const fullName = buildFullName()

    // VAT-inclusive product line items (VAT is already included in unit price, not added separately)
    const discountRatio =
      subtotal > 0
        ? (subtotal - (appliedPromo?.type === 'Shipping' ? 0 : discountAmount)) / subtotal
        : 1

    const checkoutLineItems = activeCartItems.reduce<PaymongoCheckoutLineItem[]>((items, item) => {
      const product = getProductById(item.productId)
      if (!product) {
        return items
      }

      // If a discount promo is applied to the subtotal, distribute it proportionally
      const effectiveUnitPrice =
        discountRatio < 1
          ? Math.round(item.unitPrice * discountRatio * 100) / 100
          : item.unitPrice

      items.push({
        name: `${product.name} (${item.size}ml)`,
        amount: Math.max(100, Math.round(effectiveUnitPrice * 100)),
        quantity: item.quantity,
        currency: 'PHP',
        description: `VAT-Inclusive · ${formatPHP(effectiveUnitPrice)} each`,
      })

      return items
    }, [])

    if (shipping > 0) {
      checkoutLineItems.push({
        name: 'Courier Delivery Fee',
        amount: Math.round(shipping * 100),
        quantity: 1,
        currency: 'PHP',
        description: 'Door-to-door express parcel delivery',
      })
    }

    // Ensure line items sum exactly equals expected amount in centavos
    const targetCentavos = Math.round(total * 100)
    const lineItemsSum = checkoutLineItems.reduce((sum, li) => sum + li.amount * li.quantity, 0)
    if (checkoutLineItems.length > 0 && lineItemsSum !== targetCentavos) {
      const diff = targetCentavos - lineItemsSum
      checkoutLineItems[0].amount += diff
    }

    try {
      if (isPaymongoCheckoutMethod(formData.paymentMethod)) {
        const clientToken = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `pm_${Date.now()}`
        const response = await fetch('/api/paymongo/checkout', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            customerEmail: user.email,
            customerName: fullName,
            expectedAmount: Math.round(total * 100),
            reference: formData.reference,
            shippingAddress,
            lineItems: checkoutLineItems,
            notes: formData.notes,
            cartItems: activeCartItems,
            clientToken,
          }),
        })

        const payload = await response.json().catch(() => ({}))

        if (!response.ok) {
          throw new Error(payload.error ?? 'Unable to start the payment checkout.')
        }

        if (!payload.checkoutUrl) {
          throw new Error('Payment gateway did not return a checkout URL for this session.')
        }

        const paymentMethodLabel =
          typeof payload.paymentMethodLabel === 'string' && payload.paymentMethodLabel.trim().length > 0
            ? payload.paymentMethodLabel
            : 'PayMongo'

        if (payload.requiresManualPaymentConfirmation) {
          const shouldOpenHostedCheckout = window.confirm(
            `${paymentMethodLabel} is running in test mode. QR Ph test checkouts can still generate scannable QR codes. Continue only if you want to inspect the hosted checkout.`,
          )

          if (!shouldOpenHostedCheckout) {
            toast({
              title: 'Checkout session created',
              description: `A ${paymentMethodLabel} session is ready, but the hosted checkout was not opened.`,
            })
            return
          }
        }

        storePendingPaymongoCheckout({
          token: payload.checkoutToken || clientToken,
          checkoutSessionId: payload.checkoutSessionId,
          customerEmail: user.email,
          customerName: fullName,
          expectedAmount: Math.round(total * 100),
          notes: formData.notes,
          paymentMethodLabel,
          reference: formData.reference,
          shippingAddress,
          items: activeCartItems,
        })

        window.location.href = payload.checkoutUrl
        return
      }

      // Cash on Delivery
      const result = await placeOnlineOrder({
        customerEmail: user.email,
        customerName: fullName,
        notes: [formData.reference, formData.notes].filter(Boolean).join(' | '),
        paymentMethod: 'Cash on Delivery',
        shippingAddress,
        items: activeCartItems,
      })

      if (!result.ok || !result.data) {
        toast({
          title: 'Checkout failed',
          description: result.message,
          variant: 'destructive',
        })
        return
      }

      // Clean up checked-out item keys from localStorage
      try {
        const stored = localStorage.getItem(CART_SELECTED_STORAGE_KEY)
        if (stored) {
          const parsed = JSON.parse(stored) as string[]
          const purchasedKeys = new Set(activeCartItems.map((i) => getCheckoutItemKey(i.productId, i.size)))
          const remaining = parsed.filter((k) => !purchasedKeys.has(k))
          localStorage.setItem(CART_SELECTED_STORAGE_KEY, JSON.stringify(remaining))
        }
      } catch {}

      setOrderNumber(result.data.id)
      setConfirmedOrder(result.data)
      setOrderPlaced(true)
      toast({
        title: 'Order placed',
        description: `${result.data.id} is now in processing.`,
      })
    } catch (error) {
      toast({
        title: 'Checkout failed',
        description: error instanceof Error ? error.message : 'We could not process your order.',
        variant: 'destructive',
      })
    } finally {
      endCheckoutSubmission()
    }
  }

  if (authLoading || isStoreLoading || !isAuthenticated || !user || user.role !== 'USER' || isVerifyingPayment) {
    return (
      <StorefrontShell>
        <div className="flex min-h-[42vh] items-center justify-center px-4">
          <div className="flex items-center gap-3 text-foreground/70">
            <Spinner className="h-5 w-5" />
            <p>
              {isVerifyingPayment
                ? 'Verifying your payment...'
                : authLoading
                  ? 'Checking your account...'
                  : isStoreLoading
                    ? 'Loading your checkout...'
                    : 'Redirecting to sign in...'}
            </p>
          </div>
        </div>
      </StorefrontShell>
    )
  }

  if (cart.length === 0 && !orderPlaced) {
    return (
      <StorefrontShell>
        <div className="mx-auto max-w-2xl px-4 py-20 text-center sm:px-6 lg:px-8">
          <div className="storefront-panel rounded-[2rem] p-12 bg-white border border-slate-100 shadow-sm">
            <p className="mb-6 text-xl text-foreground/60">
              Your cart is empty. Add products before checking out.
            </p>
            <Button size="lg" className="h-12 rounded-2xl bg-[#4F46E5] hover:bg-[#4338CA] px-6 text-white" asChild>
              <Link href="/shop">Return to Shop</Link>
            </Button>
          </div>
        </div>
      </StorefrontShell>
    )
  }

  // Order Confirmed State
  if (orderPlaced) {
    return (
      <StorefrontShell>
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="bg-white rounded-3xl p-8 sm:p-12 border border-slate-100 shadow-[0_20px_50px_rgba(0,0,0,0.06)] space-y-6 text-center">
            {/* Header Stepper with Step 3 Active */}
            <div className="flex items-center justify-center gap-3 sm:gap-6 text-xs font-medium pb-6 border-b border-slate-100">
              <div className="flex items-center gap-1.5 text-slate-500">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px]">
                  ✓
                </span>
                <span>Personal details</span>
              </div>
              <div className="w-8 sm:w-16 h-[1.5px] bg-emerald-400" />
              <div className="flex items-center gap-1.5 text-slate-500">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white text-[10px]">
                  ✓
                </span>
                <span>Payment</span>
              </div>
              <div className="w-8 sm:w-16 h-[1.5px] bg-[#4F46E5]" />
              <div className="flex items-center gap-1.5 font-bold text-[#4F46E5]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#4F46E5] text-white text-[10px]">
                  3
                </span>
                <span>Complete</span>
              </div>
            </div>

            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
              <Check className="h-8 w-8 stroke-[2.5]" />
            </div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Order Confirmed!</h1>
            <p className="text-sm text-slate-500 max-w-md mx-auto">
              Thank you for your purchase. Your fragrance order is confirmed and will be dispatched within 24 hours.
            </p>
            <p className="text-xs font-semibold text-slate-700 bg-slate-50 inline-block px-3 py-1 rounded-full border border-slate-200">
              Order #{orderNumber}
            </p>

            {confirmedOrder && (
              <div className="mt-6 text-left rounded-2xl bg-slate-50/80 p-5 space-y-3 border border-slate-200 text-xs">
                <div className="flex justify-between border-b border-slate-200 pb-2.5 font-semibold text-slate-700">
                  <span>Items</span>
                  <span>Total</span>
                </div>
                {confirmedOrder.items.map((item) => {
                  const product = getProductById(item.productId)
                  const imageUrl = item.image || product?.images?.[0]
                  return (
                    <div key={`${item.productId}-${item.size}`} className="flex items-center justify-between gap-3 py-1">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                          {imageUrl ? (
                            <Image src={imageUrl} alt={item.productName} fill className="object-cover" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-[9px] text-slate-400">
                              Item
                            </div>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{item.productName}</p>
                          <p className="text-[11px] text-slate-500">
                            {item.size}ml &times; {item.quantity}
                          </p>
                        </div>
                      </div>
                      <span className="font-mono font-medium text-slate-900 shrink-0">
                        {formatPHP(item.unitPrice * item.quantity)}
                      </span>
                    </div>
                  )
                })}
                <div className="border-t border-slate-200 pt-2 space-y-1.5 text-slate-600">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span className="font-mono text-slate-900">{formatPHP(confirmedOrder.subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="flex items-center gap-1.5">
                      12% VAT:
                      <span className="rounded bg-emerald-100 px-1 py-0.2 text-[9px] font-bold text-emerald-700">Included</span>
                    </span>
                    <span className="font-mono text-slate-900">{formatPHP(confirmedOrder.tax)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Shipping:</span>
                    <span className="font-mono text-slate-900">
                      {confirmedOrder.shipping === 0 ? 'FREE' : formatPHP(confirmedOrder.shipping)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-sm text-slate-900 pt-1.5 border-t border-slate-200">
                    <span>Total:</span>
                    <span className="font-mono text-base text-[#4F46E5]">{formatPHP(confirmedOrder.total)}</span>
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row justify-center gap-3 pt-3">
              <Button size="lg" className="h-12 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white px-6 text-xs font-semibold" asChild>
                <Link href="/orders">Track My Order</Link>
              </Button>
              <Button size="lg" variant="outline" className="h-12 rounded-xl border-slate-200 text-xs font-semibold px-6" asChild>
                <Link href="/shop">Continue Shopping</Link>
              </Button>
            </div>
          </div>
        </div>
      </StorefrontShell>
    )
  }

  return (
    <StorefrontShell>
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Navigation link */}
        <Link
          href="/cart"
          className="mb-6 inline-flex items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-[#4F46E5] transition"
        >
          <ChevronLeft className="w-4 h-4" />
          Back to Cart
        </Link>

        {/* Elevated Main Card matching Reference Screenshots */}
        <div className="bg-white rounded-3xl border border-slate-100 shadow-[0_20px_60px_rgba(0,0,0,0.05)] p-6 sm:p-10">
          
          {/* Header Bar: 3-Step Progress Indicator */}
          <div className="flex items-center justify-center pb-8 border-b border-slate-100">
            {/* Step Progress Bar */}
            <div className="flex items-center gap-2 sm:gap-4 text-xs font-medium">
              {/* Step 1: Personal details (completed checkmark) */}
              <button
                type="button"
                onClick={() => setIsEditingAddress((prev) => !prev)}
                className="flex items-center gap-1.5 transition hover:opacity-80"
                title="Click to view or edit delivery details"
              >
                <span className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-[#ECECFE] text-[#4F46E5] text-[11px] font-bold">
                  <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5 stroke-[3]" />
                </span>
                <span className="text-slate-600 font-medium">Personal details</span>
              </button>

              <div className="w-6 sm:w-12 h-[1px] bg-slate-200" />

              {/* Step 2: Payment (active badge) */}
              <div className="flex items-center gap-1.5">
                <span className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full border border-[#4F46E5] bg-white text-[#4F46E5] text-[11px] font-bold">
                  2
                </span>
                <span className="font-bold text-slate-900">Payment</span>
              </div>

              <div className="w-6 sm:w-12 h-[1px] bg-slate-200" />

              {/* Step 3: Complete (inactive) */}
              <div className="flex items-center gap-1.5 text-slate-400">
                <span className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full border border-slate-200 text-slate-400 text-[11px]">
                  3
                </span>
                <span>Complete</span>
              </div>
            </div>
          </div>

          {/* 2-Column Grid Layout */}
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8 xl:gap-12 items-start">

            {/* LEFT COLUMN: Payment Section */}
            <div className="space-y-6">
              <div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-slate-900">Payment</h1>
                <h2 className="text-sm sm:text-base font-semibold text-slate-800 mt-4 sm:mt-5">Select Payment Method</h2>
                <p className="text-xs text-slate-500 mt-0.5">Complete your purchase by providing your payment details.</p>
              </div>

              {/* Verified delivery address drawer with OpenStreetMap Verification */}
              <div className="rounded-2xl border border-slate-200/80 bg-slate-50/50 p-3.5 text-xs transition">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <MapPin className="h-4 w-4 text-[#4F46E5] flex-shrink-0" />
                    <div className="truncate">
                      <span className="font-semibold text-slate-800">Delivering to: </span>
                      <span className="text-slate-600">
                        {formData.firstName ? `${formData.firstName} ${formData.lastName}` : user.name}
                        {formData.address ? ` · ${formData.address}, ${formData.city}` : ''}
                        {formData.phone ? ` (${formData.phone})` : ''}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                    {formData.latitude && formData.longitude && (
                      <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700 border border-emerald-200">
                        <Check className="h-2.5 w-2.5 stroke-[3]" />
                        Map Pinned
                      </span>
                    )}
                    <button
                      type="button"
                      onClick={() => setIsEditingAddress(!isEditingAddress)}
                      className="text-[11px] font-semibold text-[#4F46E5] hover:underline"
                    >
                      {isEditingAddress ? 'Done' : 'Edit Address & Map'}
                    </button>
                  </div>
                </div>

                {/* Inline Address Form with OpenStreetMap Picker */}
                {isEditingAddress && (
                  <div className="mt-3 pt-3 border-t border-slate-200 space-y-3">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 mb-1 block">First Name</label>
                        <input
                          type="text"
                          name="firstName"
                          value={formData.firstName}
                          onChange={handleChange}
                          placeholder="First Name"
                          className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-xs bg-white outline-none focus:border-[#4F46E5]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 mb-1 block">Last Name</label>
                        <input
                          type="text"
                          name="lastName"
                          value={formData.lastName}
                          onChange={handleChange}
                          placeholder="Last Name"
                          className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-xs bg-white outline-none focus:border-[#4F46E5]"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 mb-1 block">Contact Number</label>
                        <input
                          type="tel"
                          name="phone"
                          value={formData.phone}
                          onChange={handleChange}
                          placeholder="0917 123 4567"
                          className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-xs bg-white outline-none focus:border-[#4F46E5]"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] font-medium text-slate-600 mb-1 block">City / Municipality</label>
                        <input
                          type="text"
                          name="city"
                          value={formData.city}
                          onChange={handleChange}
                          placeholder="City / Municipality"
                          className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-xs bg-white outline-none focus:border-[#4F46E5]"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="text-[11px] font-medium text-slate-600 mb-1 block">Street Address / Barangay</label>
                      <input
                        type="text"
                        name="address"
                        value={formData.address}
                        onChange={handleChange}
                        placeholder="House / Unit No., Street, Barangay"
                        className="w-full h-9 rounded-lg border border-slate-200 px-2.5 text-xs bg-white outline-none focus:border-[#4F46E5]"
                      />
                    </div>

                    {/* OpenStreetMap Address Verification & Instant Pin */}
                    <div className="pt-1">
                      <AddressMapPicker
                        initialLat={formData.latitude}
                        initialLng={formData.longitude}
                        streetAddress={formData.address}
                        city={formData.city}
                        onLocationSelected={handleLocationSelected}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Form wrapping payment methods and inputs */}
              <form id="checkout-form" onSubmit={handleSubmit} className="space-y-4">
                
                {/* Method 1: QR Ph (PayMongo) */}
                <div
                  className={`rounded-2xl border transition overflow-hidden ${
                    formData.paymentMethod === PAYMONGO_PAYMENT_METHOD_VALUE
                      ? 'border-[#4F46E5] bg-white ring-2 ring-[#4F46E5]/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <label className="flex items-center justify-between p-4 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value={PAYMONGO_PAYMENT_METHOD_VALUE}
                        checked={formData.paymentMethod === PAYMONGO_PAYMENT_METHOD_VALUE}
                        onChange={handleChange}
                        className="h-4 w-4 text-[#4F46E5] border-slate-300 focus:ring-[#4F46E5]"
                      />
                      <div>
                        <span className="text-sm font-semibold text-slate-800 block">QR Ph (PayMongo)</span>
                        <span className="text-[11px] text-slate-400">Scan &amp; pay via GCash, Maya, ShopeePay, or any Bank</span>
                      </div>
                    </div>
                    <QRPhBadge />
                  </label>

                  {formData.paymentMethod === PAYMONGO_PAYMENT_METHOD_VALUE && (
                    <div className="px-4 pb-4 pt-1 space-y-3 border-t border-slate-100">
                      <div className="rounded-xl bg-[#F8F9FE] p-3 text-xs text-slate-600 space-y-2">
                        <div className="flex items-start gap-2">
                          <QrCode className="h-4 w-4 text-[#4F46E5] flex-shrink-0 mt-0.5" />
                          <p className="leading-relaxed">
                            Instant QR code payment. Simply scan with <span className="font-semibold text-blue-600">GCash</span>, <span className="font-semibold text-emerald-600">Maya</span>, or any bank app. No reference number needed—payment is automatically verified.
                          </p>
                        </div>
                      </div>

                      <label className="flex items-center gap-2 pt-0.5 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          name="saveCard"
                          checked={formData.saveCard}
                          onChange={handleChange}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-[#4F46E5] focus:ring-[#4F46E5]"
                        />
                        <span className="text-[11px] text-slate-500">Save delivery details for future 1-click orders</span>
                      </label>
                    </div>
                  )}
                </div>

                {/* Method 2: Cash on Delivery option */}
                <div
                  className={`rounded-2xl border transition overflow-hidden ${
                    formData.paymentMethod === 'Cash on Delivery'
                      ? 'border-[#4F46E5] bg-white ring-2 ring-[#4F46E5]/20 shadow-xs'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <label className="flex items-center justify-between p-4 cursor-pointer">
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="paymentMethod"
                        value="Cash on Delivery"
                        checked={formData.paymentMethod === 'Cash on Delivery'}
                        onChange={handleChange}
                        className="h-4 w-4 text-[#4F46E5] border-slate-300 focus:ring-[#4F46E5]"
                      />
                      <div>
                        <span className="text-sm font-semibold text-slate-800 block">Cash on Delivery (COD)</span>
                        <span className="text-[11px] text-slate-400">Pay cash upon courier arrival</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded text-[10px] font-semibold">
                      <Banknote className="h-3.5 w-3.5" /> Cash
                    </div>
                  </label>

                  {formData.paymentMethod === 'Cash on Delivery' && (
                    <div className="px-4 pb-4 pt-1 space-y-2.5 border-t border-slate-100">
                      <p className="text-xs text-slate-600 leading-relaxed">
                        Please prepare exact cash of <span className="font-semibold text-slate-900 font-mono">{formatPHP(total)}</span> for courier upon delivery.
                      </p>
                      <div>
                        <label className="text-[11px] font-semibold text-slate-700 mb-1 block">
                          Delivery Instructions for Courier (Optional)
                        </label>
                        <input
                          type="text"
                          name="notes"
                          value={formData.notes}
                          onChange={handleChange}
                          placeholder="Gate code, landmark, or leave with security"
                          className="w-full h-10 rounded-xl border border-slate-200 px-3 text-xs text-slate-800 outline-none focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] transition"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Primary Action Button matching Screenshot 1 & 2 */}
                <Button
                  type="submit"
                  disabled={hasUnavailableItems || isSubmittingPayment}
                  className="h-13 sm:h-14 w-full rounded-2xl bg-[#4F46E5] hover:bg-[#4338CA] text-white font-semibold text-base shadow-[0_10px_25px_rgba(79,70,229,0.25)] transition transform active:scale-[0.99] disabled:opacity-50 mt-4"
                >
                  {isSubmittingPayment ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner className="h-5 w-5 text-white" />
                      Opening QR Ph Checkout...
                    </span>
                  ) : formData.paymentMethod === PAYMONGO_PAYMENT_METHOD_VALUE ? (
                    `Pay ${formatPHP(total)} via QR Ph`
                  ) : (
                    `Place COD Order (${formatPHP(total)})`
                  )}
                </Button>
              </form>
            </div>

            {/* RIGHT COLUMN: Order Summary Container matching Screenshot 1 & 3 */}
            <div className="rounded-3xl bg-[#F8F9FB] p-6 sm:p-7 border border-slate-100 space-y-5">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-bold text-slate-900">Order Summary</h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {activeCartItems.length} of {cart.length} {cart.length === 1 ? 'item' : 'items'} selected for checkout
                  </p>
                </div>
                <Link href="/cart" className="text-xs font-semibold text-[#4F46E5] hover:underline">
                  Edit in Bag
                </Link>
              </div>

              {/* Items list with interactive selection checkbox & quantity stepper */}
              <div className="space-y-3">
                {orderItems.map((item) => {
                  const itemKey = getCheckoutItemKey(item.productId, item.size)
                  const isChecked = item.isSelected

                  return (
                    <div
                      key={itemKey}
                      className={`flex items-center justify-between gap-3 rounded-2xl p-3.5 border transition shadow-xs ${
                        isChecked
                          ? 'bg-white border-slate-200 ring-1 ring-[#4F46E5]/20'
                          : 'bg-slate-50/70 border-slate-100 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {/* Selection Checkbox on checkout (when multiple items exist) */}
                        {cart.length > 1 && (
                          <label
                            htmlFor={`chk-${itemKey}`}
                            className="flex items-center justify-center cursor-pointer p-1 -m-1"
                            title={isChecked ? 'Exclude from this checkout' : 'Include in this checkout'}
                          >
                            <input
                              id={`chk-${itemKey}`}
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleCheckoutItem(item.productId, item.size)}
                              className="sr-only"
                            />
                            <div
                              className={`flex h-5 w-5 items-center justify-center rounded-md border-2 transition-all ${
                                isChecked
                                  ? 'border-[#4F46E5] bg-[#4F46E5] text-white shadow-xs'
                                  : 'border-slate-300 bg-white hover:border-slate-400'
                              }`}
                            >
                              {isChecked && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                          </label>
                        )}

                        {/* Product Thumbnail */}
                        <div className="relative h-14 w-14 sm:h-16 sm:w-16 flex-shrink-0 overflow-hidden rounded-xl bg-slate-50 border border-slate-100">
                          {item.product?.images?.[0] ? (
                            <Image
                              src={item.product.images[0]}
                              alt={item.product.name}
                              fill
                              className="object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                              Perfume
                            </div>
                          )}
                        </div>

                        {/* Product Info + Quantity Stepper */}
                        <div className="min-w-0 flex-1">
                          <p
                            className={`text-xs sm:text-sm font-semibold truncate ${
                              isChecked ? 'text-slate-900' : 'text-slate-500 line-through'
                            }`}
                          >
                            {item.product?.name || 'Perfume'}
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">
                            {item.size}ml {!isChecked && '· (Excluded from this checkout)'}
                          </p>

                          {/* Interactive Quantity Stepper [ - ] quantity [ + ] */}
                          {isChecked && (
                            <div className="inline-flex items-center gap-2 mt-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5">
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.productId, item.size, item.quantity - 1)}
                                className="text-slate-500 hover:text-slate-900 p-0.5 transition"
                                title="Decrease quantity"
                              >
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="text-xs font-semibold text-slate-800 min-w-[14px] text-center font-mono">
                                {item.quantity}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleUpdateQuantity(item.productId, item.size, item.quantity + 1)}
                                className="text-slate-500 hover:text-slate-900 p-0.5 transition"
                                title="Increase quantity"
                              >
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Item Price */}
                      <div className="text-right flex-shrink-0">
                        <span
                          className={`text-xs sm:text-sm font-bold font-mono ${
                            isChecked ? 'text-slate-900' : 'text-slate-400 line-through'
                          }`}
                        >
                          {formatPHP(item.unitPrice * item.quantity)}
                        </span>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Promo Code Input matching Screenshot 1 & 3 */}
              <div className="pt-2">
                <div className="flex items-center gap-2">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                      <Ticket className="h-4 w-4" />
                    </div>
                    <input
                      type="text"
                      placeholder="GRATISONGKR"
                      value={promoInput}
                      onChange={(e) => setPromoInput(e.target.value.toUpperCase())}
                      className="w-full h-11 pl-9 pr-3 rounded-xl border border-slate-200 bg-white text-xs font-bold uppercase tracking-wider text-slate-800 placeholder:text-slate-400 placeholder:font-normal focus:border-[#4F46E5] focus:ring-1 focus:ring-[#4F46E5] outline-none transition"
                    />
                  </div>
                  <Button
                    type="button"
                    onClick={handleApplyPromo}
                    className="h-11 px-5 rounded-xl bg-[#4F46E5] hover:bg-[#4338CA] text-white text-xs font-semibold shadow-xs transition"
                  >
                    Apply
                  </Button>
                </div>

                {appliedPromo && (
                  <div className="mt-2 flex items-center justify-between text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-2.5 py-1">
                    <span>Coupon {appliedPromo.code} applied!</span>
                    <button
                      type="button"
                      onClick={() => {
                        setAppliedPromo(null)
                        setPromoInput('')
                      }}
                      className="text-emerald-700 hover:text-emerald-900"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                )}
                {promoError && (
                  <p className="text-[11px] text-destructive mt-1.5">{promoError}</p>
                )}
              </div>

              {/* Price Breakdown matching Screenshot 1 & 3 */}
              <div className="space-y-2.5 border-t border-slate-200/80 pt-4 text-xs">
                <div className="flex justify-between items-center text-slate-600">
                  <span>Sub Total:</span>
                  <span className="font-semibold text-slate-900 font-mono">{formatPHP(subtotal)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span>Shipping:</span>
                  <span className="font-semibold text-slate-900 font-mono">
                    {shipping === 0 ? 'FREE' : formatPHP(shipping)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-slate-600">
                  <span className="flex items-center gap-1.5">
                    12% VAT:
                    <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700">Included</span>
                  </span>
                  <span className="font-semibold text-slate-700 font-mono">{formatPHP(tax)}</span>
                </div>
                {discountAmount > 0 && appliedPromo?.type !== 'Shipping' && (
                  <div className="flex justify-between items-center text-emerald-600 font-medium">
                    <span>Discount ({appliedPromo?.code}):</span>
                    <span className="font-semibold font-mono">- {formatPHP(discountAmount)}</span>
                  </div>
                )}

                {/* Total */}
                <div className="border-t border-slate-200/90 pt-3 flex justify-between items-baseline font-bold text-slate-900">
                  <span className="text-base">Total:</span>
                  <span className="text-xl sm:text-2xl font-black font-mono text-slate-900">
                    {formatPHP(total)}
                  </span>
                </div>
              </div>

              {/* Trust Badges */}
              <div className="pt-2 border-t border-slate-200/60 flex items-center justify-around text-[10px] text-slate-400">
                <span className="flex items-center gap-1">
                  <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> 100% Authentic
                </span>
                <span className="flex items-center gap-1">
                  <Truck className="h-3.5 w-3.5 text-[#4F46E5]" /> Express Delivery
                </span>
                <span className="flex items-center gap-1">
                  <Lock className="h-3.5 w-3.5 text-slate-600" /> SSL Encrypted
                </span>
              </div>
            </div>

          </div>
        </div>
      </div>
    </StorefrontShell>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense
      fallback={
        <StorefrontShell>
          <div className="flex min-h-[42vh] items-center justify-center px-4">
            <div className="flex items-center gap-3 text-foreground/70">
              <Spinner className="h-5 w-5" />
              <p>Loading checkout...</p>
            </div>
          </div>
        </StorefrontShell>
      }
    >
      <CheckoutContent />
    </Suspense>
  )
}
