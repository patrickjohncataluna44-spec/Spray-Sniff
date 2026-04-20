'use client'

import type { RealtimeChannel } from '@supabase/supabase-js'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

function createChannelName(prefix: string) {
  return `${prefix}-${Date.now()}`
}

function removeChannel(channel: RealtimeChannel) {
  const supabase = getSupabaseBrowserClient()
  void supabase.removeChannel(channel)
}

function subscribeToTableChanges(
  channelName: string,
  table: string,
  onChange: () => void,
  filter?: string,
) {
  const supabase = getSupabaseBrowserClient()
  const channel = supabase.channel(createChannelName(channelName))

  if (filter) {
    channel.on(
      'postgres_changes',
      { event: '*', schema: 'public', table, filter },
      onChange,
    )
  } else {
    channel.on('postgres_changes', { event: '*', schema: 'public', table }, onChange)
  }

  void channel.subscribe()

  return () => removeChannel(channel)
}

export function subscribeToUserProfile(userId: string, onChange: () => void) {
  return subscribeToTableChanges('profile-sync', 'profiles', onChange, `id=eq.${userId}`)
}

export function subscribeToProfiles(onChange: () => void) {
  return subscribeToTableChanges('profiles-sync', 'profiles', onChange)
}

export function subscribeToStoreSnapshot(onChange: () => void) {
  return subscribeToTableChanges('store-sync', 'app_store_snapshots', onChange, 'id=eq.default')
}

export function subscribeToPublicStoreSnapshot(onChange: () => void) {
  return subscribeToTableChanges('public-store-sync', 'public_store_snapshots', onChange, 'id=eq.default')
}

export function subscribeToUserCart(userId: string, onChange: () => void) {
  return subscribeToTableChanges('cart-sync', 'user_carts', onChange, `user_id=eq.${userId}`)
}

export function subscribeToUserWishlist(userId: string, onChange: () => void) {
  return subscribeToTableChanges('wishlist-sync', 'user_wishlists', onChange, `user_id=eq.${userId}`)
}

export function subscribeToPromotions(onChange: () => void) {
  return subscribeToTableChanges('promotions-sync', 'promotions', onChange)
}

export function subscribeToStoreOrders(onChange: () => void) {
  return subscribeToTableChanges('store-orders-sync', 'store_orders', onChange)
}

export function subscribeToCatalogProducts(onChange: () => void) {
  return subscribeToTableChanges('catalog-products-sync', 'catalog_products', onChange)
}

export function subscribeToInventoryItems(onChange: () => void) {
  return subscribeToTableChanges('inventory-items-sync', 'inventory_items', onChange)
}

export function subscribeToOrderTimelineEntries(onChange: () => void) {
  return subscribeToTableChanges('order-timeline-sync', 'order_timeline_entries', onChange)
}

export function subscribeToPosTransactions(onChange: () => void) {
  return subscribeToTableChanges('pos-transactions-sync', 'pos_transactions', onChange)
}

export function subscribeToPaymentRecords(onChange: () => void) {
  return subscribeToTableChanges('payment-records-sync', 'payment_records', onChange)
}

export function subscribeToStockMovements(onChange: () => void) {
  return subscribeToTableChanges('stock-movements-sync', 'stock_movements', onChange)
}

export function subscribeToBackofficeStoreData(onChange: () => void) {
  const cleanups = [
    subscribeToStoreSnapshot(onChange),
    subscribeToCatalogProducts(onChange),
    subscribeToInventoryItems(onChange),
    subscribeToStoreOrders(onChange),
    subscribeToOrderTimelineEntries(onChange),
    subscribeToPosTransactions(onChange),
    subscribeToPaymentRecords(onChange),
    subscribeToStockMovements(onChange),
  ]

  return () => {
    cleanups.forEach((cleanup) => cleanup())
  }
}
