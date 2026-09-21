'use client'

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { useEffectEvent } from '@/hooks/use-effect-event'
import { useAuth } from '@/lib/auth-context'
import type { Product } from '@/lib/products'
import {
  subscribeToBackofficeStoreData,
  subscribeToPublicStoreSnapshot,
  subscribeToUserCart,
  subscribeToUserWishlist,
  subscribeToCustomerOrders,
} from '@/lib/supabase-realtime'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import {
  createEmptyStoreState,
  getAvailabilityStatusFromState,
  getAvailableStockFromState,
  getInventoryRecordFromState,
  getProductByIdFromState,
  type AddCatalogProductOptions,
  type AdjustInventoryInput,
  type ArchiveInventoryItemInput,
  type CartItem,
  type CreatePosSaleInput,
  type InventoryAvailability,
  type InventoryRecord,
  type OrderRecord,
  type OrderStatus,
  type PlaceOnlineOrderInput,
  type RestoreInventoryItemInput,
  type StoreAction,
  type StoreActionResult,
  type StoreState,
  type UpdateCatalogProductOptions,
  type UpdateInventoryInput,
} from '@/lib/store-engine'

export {
  ONLINE_PAYMENT_METHODS,
  POS_PAYMENT_METHODS,
  ONLINE_ORDER_STATUSES,
  DELIVERY_ORDER_STATUSES,
  getInventoryAvailability,
} from '@/lib/store-engine'
export type {
  AddCatalogProductOptions,
  AdjustInventoryInput,
  ArchiveInventoryItemInput,
  CartItem,
  CreatePosSaleInput,
  InventoryAvailability,
  InventoryRecord,
  OrderActionAvailability,
  OnlinePaymentMethod,
  OrderRecord,
  OrderPaymentSummary,
  OrderSource,
  OrderStatus,
  PaymentMethod,
  PaymentStatus,
  PlaceOnlineOrderInput,
  PosPaymentMethod,
  PosTransaction,
  RestoreInventoryItemInput,
  StockMovement,
  StockMovementReason,
  UpdateCatalogProductOptions,
  UpdateInventoryInput,
} from '@/lib/store-engine'

interface StoreContextType extends StoreState {
  cartCount: number
  wishlistIds: string[]
  isStoreLoading: boolean
  isRealtimeRefreshing: boolean
  lastSyncedAt: string | null
  refreshStore: () => Promise<void>
  addCatalogProduct: (
    product: Product,
    options?: AddCatalogProductOptions,
  ) => Promise<StoreActionResult<Product>>
  updateCatalogProduct: (
    productId: string,
    product: Product,
    options: UpdateCatalogProductOptions,
  ) => Promise<StoreActionResult<Product>>
  removeCatalogProduct: (productId: string) => Promise<StoreActionResult>
  updateInventory: (input: UpdateInventoryInput) => Promise<StoreActionResult<InventoryRecord>>
  adjustInventory: (input: AdjustInventoryInput) => Promise<StoreActionResult<InventoryRecord>>
  archiveInventoryItem: (
    input: ArchiveInventoryItemInput,
  ) => Promise<StoreActionResult<InventoryRecord>>
  restoreInventoryItem: (
    input: RestoreInventoryItemInput,
  ) => Promise<StoreActionResult<InventoryRecord>>
  addToCart: (item: CartItem) => Promise<StoreActionResult<CartItem>>
  updateCartQuantity: (
    productId: string,
    size: number,
    quantity: number,
  ) => Promise<StoreActionResult>
  removeFromCart: (productId: string, size: number) => Promise<StoreActionResult>
  clearCart: () => Promise<StoreActionResult>
  placeOnlineOrder: (input: PlaceOnlineOrderInput) => Promise<StoreActionResult<OrderRecord>>
  createPosSale: (input: CreatePosSaleInput) => Promise<StoreActionResult<OrderRecord>>
  cancelOwnOrder: (orderId: string) => Promise<StoreActionResult<OrderRecord>>
  updateOrderDelivery: (
    orderId: string,
    input: {
      status: OrderStatus
      courier?: string
      trackingNumber?: string
      deliveryNotes?: string
      note?: string
    },
  ) => Promise<StoreActionResult<OrderRecord>>
  updateOrderStatus: (
    orderId: string,
    status: OrderStatus,
    actor?: string,
    note?: string,
  ) => Promise<StoreActionResult<OrderRecord>>
  markOrderPaymentPaid: (
    orderId: string,
    actor?: string,
    note?: string,
  ) => Promise<StoreActionResult<OrderRecord>>
  getProductById: (productId: string) => Product | undefined
  getInventoryRecord: (productId: string) => InventoryRecord | undefined
  getAvailableStock: (productId: string) => number
  getAvailabilityStatus: (productId: string) => InventoryAvailability
  isWishlisted: (productId: string) => boolean
  toggleWishlist: (productId: string) => Promise<StoreActionResult<{ isWishlisted: boolean }>>
}

const StoreContext = createContext<StoreContextType | undefined>(undefined)

function getPayloadSyncedAt(payload: unknown) {
  if (
    payload &&
    typeof payload === 'object' &&
    'syncedAt' in payload &&
    typeof payload.syncedAt === 'string' &&
    payload.syncedAt.trim()
  ) {
    return payload.syncedAt
  }

  return new Date().toISOString()
}

async function getAuthHeaders(user?: { id?: string | null; email?: string | null } | null) {
  const headers: Record<string, string> = {}

  try {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  } catch {
    // Ignore session retrieval error
  }

  if (user?.id) {
    headers['x-customer-id'] = user.id
  }
  if (user?.email) {
    headers['x-customer-email'] = user.email
  }

  if (!headers['x-customer-id'] && typeof window !== 'undefined') {
    try {
      const cached = localStorage.getItem('auth-user')
      if (cached) {
        const parsed = JSON.parse(cached)
        if (parsed?.id) {
          headers['x-customer-id'] = parsed.id
          if (parsed.email) {
            headers['x-customer-email'] = parsed.email
          }
        }
      }
    } catch {
      // Ignore cache parse error
    }
  }

  return headers
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth()
  const [state, setState] = useState<StoreState>(() => createEmptyStoreState())
  const [wishlistIds, setWishlistIds] = useState<string[]>([])
  const [isStoreLoading, setIsStoreLoading] = useState(true)
  const [isRealtimeRefreshing, setIsRealtimeRefreshing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshInFlightRef = useRef(false)
  const pendingRealtimeRefreshRef = useRef(false)
  const lastLocalActionAtRef = useRef(0)

  const performRefresh = useEffectEvent(async (background = false) => {
    if (refreshInFlightRef.current) {
      if (background) {
        pendingRealtimeRefreshRef.current = true
      }
      return
    }

    refreshInFlightRef.current = true

    if (background) {
      setIsRealtimeRefreshing(true)
    } else {
      setIsStoreLoading(true)
    }

    try {
      const response = await fetch('/api/store/bootstrap', {
        method: 'GET',
        headers: await getAuthHeaders(user),
        cache: 'no-store',
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload.state) {
        throw new Error(payload.error ?? 'Unable to load the store from Supabase.')
      }

      setState(payload.state as StoreState)
      setWishlistIds(Array.isArray(payload.wishlistIds) ? payload.wishlistIds : [])
      setLastSyncedAt(getPayloadSyncedAt(payload))
    } catch {
      // Keep the last known store state instead of wiping the cart on a transient bootstrap failure.
    } finally {
      refreshInFlightRef.current = false

      if (background) {
        setIsRealtimeRefreshing(false)
      } else {
        setIsStoreLoading(false)
      }

      if (pendingRealtimeRefreshRef.current) {
        pendingRealtimeRefreshRef.current = false
        void performRefresh(true)
      }
    }
  })

  const refreshStore = useCallback(async () => {
    await performRefresh(false)
  }, [performRefresh])

  const handleRealtimeSync = useEffectEvent(() => {
    // If a store action was executed locally within 2.5 seconds, we already have
    // the authoritative state in memory; ignore the echo realtime broadcast.
    if (Date.now() - lastLocalActionAtRef.current < 2500) {
      return
    }

    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }

    refreshTimerRef.current = setTimeout(() => {
      void performRefresh(true)
    }, 250)
  })

  useEffect(() => {
    if (authLoading) {
      return
    }

    void refreshStore()
  }, [authLoading, user?.id, refreshStore])

  useEffect(() => {
    if (authLoading) {
      return
    }

    const cleanups: Array<() => void> = []
    const canAccessBackoffice = user?.role === 'ADMIN' || user?.role === 'STAFF'

    cleanups.push(
      canAccessBackoffice
        ? subscribeToBackofficeStoreData(handleRealtimeSync)
        : subscribeToPublicStoreSnapshot(handleRealtimeSync),
    )

    if (user?.id) {
      cleanups.push(subscribeToUserCart(user.id, handleRealtimeSync))
      cleanups.push(subscribeToUserWishlist(user.id, handleRealtimeSync))
      cleanups.push(subscribeToCustomerOrders(user.id, handleRealtimeSync))
    }

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [authLoading, handleRealtimeSync, user?.id, user?.role])

  const callStoreAction = async <T,>(action: StoreAction) => {
    lastLocalActionAtRef.current = Date.now()
    const authHeaders = await getAuthHeaders(user)

    const response = await fetch('/api/store/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        action,
        customerId: user?.id || authHeaders['x-customer-id'],
        customerEmail: user?.email || authHeaders['x-customer-email'],
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      return {
        ok: false,
        message: payload.message ?? payload.error ?? 'Unable to complete this action.',
      } as StoreActionResult<T>
    }

    lastLocalActionAtRef.current = Date.now()

    if (payload.state) {
      setState(payload.state as StoreState)
      setLastSyncedAt(getPayloadSyncedAt(payload))
    }

    return {
      ok: true,
      message: payload.message ?? 'Action completed successfully.',
      data: payload.data as T | undefined,
    } as StoreActionResult<T>
  }

  const toggleWishlist = async (productId: string) => {
    const authHeaders = await getAuthHeaders(user)
    const response = await fetch('/api/wishlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
      },
      body: JSON.stringify({
        productId,
        customerId: user?.id || authHeaders['x-customer-id'],
        customerEmail: user?.email || authHeaders['x-customer-email'],
      }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      return {
        ok: false,
        message: payload.error ?? 'Unable to update your wishlist.',
      } satisfies StoreActionResult<{ isWishlisted: boolean }>
    }

    const nextWishlistIds = Array.isArray(payload.wishlistIds) ? payload.wishlistIds : []
    setWishlistIds(nextWishlistIds)

    return {
      ok: true,
      message: payload.isWishlisted ? 'Added to wishlist.' : 'Removed from wishlist.',
      data: { isWishlisted: Boolean(payload.isWishlisted) },
    } satisfies StoreActionResult<{ isWishlisted: boolean }>
  }

  const getProductById = useCallback((productId: string) => getProductByIdFromState(state, productId), [state])
  const getInventoryRecord = useCallback(
    (productId: string) => getInventoryRecordFromState(state, productId),
    [state],
  )
  const getAvailableStock = useCallback(
    (productId: string) => getAvailableStockFromState(state, productId),
    [state],
  )
  const getAvailabilityStatus = useCallback(
    (productId: string) => getAvailabilityStatusFromState(state, productId),
    [state],
  )
  const isWishlisted = useCallback((productId: string) => wishlistIds.includes(productId), [wishlistIds])

  const cartCount = useMemo(
    () => state.cart.reduce((sum, item) => sum + item.quantity, 0),
    [state.cart],
  )

  const value = useMemo<StoreContextType>(
    () => ({
      ...state,
      cartCount,
      wishlistIds,
      isStoreLoading,
      isRealtimeRefreshing,
      lastSyncedAt,
      refreshStore,
      addCatalogProduct: (product, options) =>
        callStoreAction<Product>({ type: 'addCatalogProduct', product, options }),
      updateCatalogProduct: (productId, product, options) =>
        callStoreAction<Product>({ type: 'updateCatalogProduct', productId, product, options }),
      removeCatalogProduct: (productId) =>
        callStoreAction({ type: 'removeCatalogProduct', productId }),
      updateInventory: (input) => callStoreAction<InventoryRecord>({ type: 'updateInventory', input }),
      adjustInventory: (input) => callStoreAction<InventoryRecord>({ type: 'adjustInventory', input }),
      archiveInventoryItem: (input) =>
        callStoreAction<InventoryRecord>({ type: 'archiveInventoryItem', input }),
      restoreInventoryItem: (input) =>
        callStoreAction<InventoryRecord>({ type: 'restoreInventoryItem', input }),
      addToCart: (item) => callStoreAction<CartItem>({ type: 'addToCart', item }),
      updateCartQuantity: (productId, size, quantity) =>
        callStoreAction({ type: 'updateCartQuantity', productId, size, quantity }),
      removeFromCart: (productId, size) => callStoreAction({ type: 'removeFromCart', productId, size }),
      clearCart: () => callStoreAction({ type: 'clearCart' }),
      placeOnlineOrder: (input) => callStoreAction<OrderRecord>({ type: 'placeOnlineOrder', input }),
      createPosSale: (input) => callStoreAction<OrderRecord>({ type: 'createPosSale', input }),
      cancelOwnOrder: (orderId) => callStoreAction<OrderRecord>({ type: 'cancelOwnOrder', orderId }),
      updateOrderDelivery: (orderId, input) =>
        callStoreAction<OrderRecord>({ type: 'updateOrderDelivery', orderId, ...input }),
      markOrderPaymentPaid: (orderId, actor, note) =>
        callStoreAction<OrderRecord>({ type: 'markOrderPaymentPaid', orderId, actor, note }),
      updateOrderStatus: (orderId, status, actor, note) =>
        callStoreAction<OrderRecord>({ type: 'updateOrderStatus', orderId, status, actor, note }),
      getProductById,
      getInventoryRecord,
      getAvailableStock,
      getAvailabilityStatus,
      isWishlisted,
      toggleWishlist,
    }),
    [
      state,
      cartCount,
      wishlistIds,
      isStoreLoading,
      isRealtimeRefreshing,
      lastSyncedAt,
      refreshStore,
      getProductById,
      getInventoryRecord,
      getAvailableStock,
      getAvailabilityStatus,
      isWishlisted,
    ],
  )

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const context = useContext(StoreContext)

  if (!context) {
    throw new Error('useStore must be used within a StoreProvider')
  }

  return context
}
