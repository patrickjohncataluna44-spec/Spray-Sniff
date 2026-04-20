'use client'

import React, { createContext, useContext, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react'
import { useAuth } from '@/lib/auth-context'
import type { Product } from '@/lib/products'
import {
  subscribeToBackofficeStoreData,
  subscribeToPublicStoreSnapshot,
  subscribeToUserCart,
  subscribeToUserWishlist,
} from '@/lib/supabase-realtime'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import {
  createSampleState,
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
  OnlinePaymentMethod,
  OrderRecord,
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

async function getAuthHeaders() {
  const supabase = getSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const headers: Record<string, string> = {}

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const { user, isLoading: authLoading } = useAuth()
  const [state, setState] = useState<StoreState>(() => createSampleState())
  const [wishlistIds, setWishlistIds] = useState<string[]>([])
  const [isStoreLoading, setIsStoreLoading] = useState(true)
  const [isRealtimeRefreshing, setIsRealtimeRefreshing] = useState(false)
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null)
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const refreshInFlightRef = useRef(false)
  const pendingRealtimeRefreshRef = useRef(false)

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
        headers: await getAuthHeaders(),
        cache: 'no-store',
      })

      const payload = await response.json().catch(() => ({}))

      if (!response.ok || !payload.state) {
        throw new Error(payload.error ?? 'Unable to load the store from Supabase.')
      }

      setState(payload.state as StoreState)
      setWishlistIds(Array.isArray(payload.wishlistIds) ? payload.wishlistIds : [])
      setLastSyncedAt(new Date().toISOString())
    } catch {
      if (!background) {
        setState(createSampleState())
        setWishlistIds([])
      }
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

  const refreshStore = async () => {
    await performRefresh(false)
  }

  const handleRealtimeSync = useEffectEvent(() => {
    if (refreshTimerRef.current) {
      clearTimeout(refreshTimerRef.current)
    }

    refreshTimerRef.current = setTimeout(() => {
      void performRefresh(true)
    }, 150)
  })

  useEffect(() => {
    if (authLoading) {
      return
    }

    void refreshStore()
  }, [authLoading, user?.id])

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
    }

    return () => {
      if (refreshTimerRef.current) {
        clearTimeout(refreshTimerRef.current)
      }
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [authLoading, user?.id, user?.role])

  const callStoreAction = async <T,>(action: StoreAction) => {
    const response = await fetch('/api/store/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({ action }),
    })

    const payload = await response.json().catch(() => ({}))

    if (!response.ok) {
      return {
        ok: false,
        message: payload.message ?? payload.error ?? 'Unable to complete this action.',
      } as StoreActionResult<T>
    }

    if (payload.state) {
      setState(payload.state as StoreState)
      setLastSyncedAt(new Date().toISOString())
    }

    return {
      ok: true,
      message: payload.message ?? 'Action completed successfully.',
      data: payload.data as T | undefined,
    } as StoreActionResult<T>
  }

  const toggleWishlist = async (productId: string) => {
    const response = await fetch('/api/wishlist', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getAuthHeaders()),
      },
      body: JSON.stringify({ productId }),
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

  const getProductById = (productId: string) => getProductByIdFromState(state, productId)
  const getInventoryRecord = (productId: string) => getInventoryRecordFromState(state, productId)
  const getAvailableStock = (productId: string) => getAvailableStockFromState(state, productId)
  const getAvailabilityStatus = (productId: string) => getAvailabilityStatusFromState(state, productId)
  const isWishlisted = (productId: string) => wishlistIds.includes(productId)

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
    [state, cartCount, wishlistIds, isStoreLoading, isRealtimeRefreshing, lastSyncedAt],
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
