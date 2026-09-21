'use client'

import Link from 'next/link'
import Image from 'next/image'
import { Suspense, useEffect, useDeferredValue, useMemo, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  Star,
  RefreshCw,
  Search,
  Link2,
  Package,
  Sparkles,
  ShoppingBag,
  CreditCard,
  Box,
  Truck,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Store,
  ChevronRight,
  ArrowRight,
  ShieldCheck,
  Check,
} from 'lucide-react'
import { ProtectedRoute } from '@/components/protected-route'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/lib/auth-context'
import { formatPHP } from '@/lib/currency'
import { type OrderRecord, useStore } from '@/lib/store-context'
import { toast } from '@/hooks/use-toast'

// ── Shopee / Lazada Category Types ──────────────────────────────────

type OrderTabCategory =
  | 'all'
  | 'to-pay'
  | 'to-ship'
  | 'to-receive'
  | 'completed'
  | 'cancelled'
  | 'return-refund'

interface OrderTabDef {
  key: OrderTabCategory
  label: string
  icon: React.ElementType
}

const ORDER_TABS: OrderTabDef[] = [
  { key: 'all', label: 'All', icon: ShoppingBag },
  { key: 'to-pay', label: 'To Pay', icon: CreditCard },
  { key: 'to-ship', label: 'To Ship', icon: Box },
  { key: 'to-receive', label: 'To Receive', icon: Truck },
  { key: 'completed', label: 'Completed', icon: CheckCircle2 },
  { key: 'cancelled', label: 'Cancelled', icon: XCircle },
  { key: 'return-refund', label: 'Return Refund', icon: RotateCcw },
]

const statusTone: Record<string, string> = {
  Pending: 'bg-[#ffe5de] text-[#b85b48]',
  Processing: 'bg-[#fff0be] text-[#8f6b26]',
  Shipped: 'bg-[#ffe8d9] text-[#9c624d]',
  'In Transit': 'bg-[#ffe0c2] text-[#8a5a24]',
  'Out for Delivery': 'bg-[#ffd6a6] text-[#7d5a1f]',
  Delivered: 'bg-[#e6f4ea] text-[#2f7a4e]',
  Cancelled: 'bg-slate-200 text-slate-700',
}

type PendingOrderAction =
  | {
      type: 'cancel'
      order: OrderRecord
    }
  | null

function getPaymentMethodLabel(order: OrderRecord) {
  if (order.paymentMethod === 'Cash on Delivery') {
    return 'Cash on Delivery'
  }
  return order.paymentMethod
}

function getPaymentStateTone(paymentStatus: OrderRecord['paymentStatus']) {
  return paymentStatus === 'Paid'
    ? 'bg-emerald-100 text-emerald-700'
    : 'bg-amber-100 text-amber-700'
}

function getOrderSearchValue(order: OrderRecord) {
  return [
    order.id,
    order.paymentSummary?.reference ?? '',
    order.paymentSummary?.checkoutSessionId ?? '',
    order.courier ?? '',
    order.trackingNumber ?? '',
    ...order.items.map((i) => i.productName),
  ]
    .join(' ')
    .trim()
    .toLowerCase()
}

function getLastTimelineEntry(order: OrderRecord) {
  return order.timeline[order.timeline.length - 1]
}

// ── Match Order to Category ─────────────────────────────────────────

function matchesCategory(order: OrderRecord, category: OrderTabCategory): boolean {
  switch (category) {
    case 'all':
      return true
    case 'to-pay':
      return order.status === 'Pending' && order.paymentStatus === 'Pending'
    case 'to-ship':
      return (
        order.status === 'Processing' ||
        (order.status === 'Pending' && order.paymentStatus === 'Paid')
      )
    case 'to-receive':
      return ['Shipped', 'In Transit', 'Out for Delivery'].includes(order.status)
    case 'completed':
      return order.status === 'Delivered' || order.status === 'Completed'
    case 'cancelled':
      return order.status === 'Cancelled'
    case 'return-refund':
      return (
        Boolean(order.notes?.toLowerCase().includes('refund')) ||
        Boolean(order.notes?.toLowerCase().includes('return')) ||
        order.timeline.some(
          (t) =>
            t.note.toLowerCase().includes('refund') ||
            t.note.toLowerCase().includes('return'),
        )
      )
  }
}

function getOrderCategoryBadge(order: OrderRecord) {
  if (matchesCategory(order, 'to-pay')) {
    return {
      label: 'To Pay',
      icon: CreditCard,
      tone: 'bg-amber-100 text-amber-800 border-amber-300',
    }
  }
  if (matchesCategory(order, 'to-ship')) {
    return {
      label: 'To Ship • Preparing',
      icon: Box,
      tone: 'bg-[#fff0be] text-[#8f6b26] border-[#ffd980]',
    }
  }
  if (matchesCategory(order, 'to-receive')) {
    return {
      label: `To Receive • ${order.status}`,
      icon: Truck,
      tone: 'bg-[#ffe8d9] text-[#9c624d] border-[#ffcaa8]',
    }
  }
  if (matchesCategory(order, 'completed')) {
    return {
      label: 'Completed',
      icon: CheckCircle2,
      tone: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    }
  }
  if (matchesCategory(order, 'cancelled')) {
    return {
      label: 'Cancelled',
      icon: XCircle,
      tone: 'bg-slate-200 text-slate-700 border-slate-300',
    }
  }
  return {
    label: order.status,
    icon: Package,
    tone: 'bg-muted text-foreground border-border',
  }
}

// ── Main Orders Content ──────────────────────────────────────────────

function OrdersContent() {
  const searchParams = useSearchParams()
  const initialTab = (searchParams.get('tab') as OrderTabCategory) || 'all'

  const { user } = useAuth()
  const {
    cancelOwnOrder,
    getAvailableStock,
    getProductById,
    addToCart,
    orders,
    isStoreLoading,
    refreshStore,
  } = useStore()

  const [activeTab, setActiveTab] = useState<OrderTabCategory>(initialTab)
  const [searchQuery, setSearchQuery] = useState('')
  const [pendingAction, setPendingAction] = useState<PendingOrderAction>(null)
  const [submittingOrderId, setSubmittingOrderId] = useState<string | null>(null)
  const [isSyncing, setIsSyncing] = useState(false)
  const [claimOrderId, setClaimOrderId] = useState('')
  const [isClaiming, setIsClaiming] = useState(false)
  const [showClaimForm, setShowClaimForm] = useState(false)
  const deferredSearchQuery = useDeferredValue(searchQuery.trim().toLowerCase())

  // Automatically check for any unlinked/paid PayMongo transactions in background
  useEffect(() => {
    fetch('/api/paymongo/sync-orders', { method: 'POST' })
      .then((res) => res.json())
      .then((data) => {
        if (data.recoveredOrders && data.recoveredOrders.length > 0) {
          refreshStore()
        }
      })
      .catch(() => {})
  }, [refreshStore])

  // Sync tab from URL if it changes
  useEffect(() => {
    const tabParam = searchParams.get('tab') as OrderTabCategory
    if (tabParam && ORDER_TABS.some((t) => t.key === tabParam)) {
      setActiveTab(tabParam)
    }
  }, [searchParams])

  const userOrders = useMemo(() => {
    return orders.filter((order) => {
      if (order.source !== 'ONLINE') return false
      if (user?.role === 'USER') return true
      const userEmail = user?.email?.toLowerCase().trim()
      return (
        order.customerId === user?.id ||
        (userEmail && order.customerEmail.toLowerCase().trim() === userEmail)
      )
    })
  }, [orders, user])

  // Compute live badge counts for all Shopee tabs
  const tabCounts = useMemo(() => {
    const counts: Record<OrderTabCategory, number> = {
      all: userOrders.length,
      'to-pay': 0,
      'to-ship': 0,
      'to-receive': 0,
      completed: 0,
      cancelled: 0,
      'return-refund': 0,
    }

    for (const order of userOrders) {
      if (matchesCategory(order, 'to-pay')) counts['to-pay']++
      if (matchesCategory(order, 'to-ship')) counts['to-ship']++
      if (matchesCategory(order, 'to-receive')) counts['to-receive']++
      if (matchesCategory(order, 'completed')) counts['completed']++
      if (matchesCategory(order, 'cancelled')) counts['cancelled']++
      if (matchesCategory(order, 'return-refund')) counts['return-refund']++
    }

    return counts
  }, [userOrders])

  const filteredOrders = useMemo(() => {
    return userOrders.filter((order) => {
      const matchesSearch =
        deferredSearchQuery.length === 0 || getOrderSearchValue(order).includes(deferredSearchQuery)
      const matchesTab = matchesCategory(order, activeTab)

      return matchesSearch && matchesTab
    })
  }, [deferredSearchQuery, activeTab, userOrders])

  const handleSyncOrders = async () => {
    setIsSyncing(true)
    try {
      const res = await fetch('/api/paymongo/sync-orders', { method: 'POST' })
      const data = await res.json().catch(() => ({}))
      await refreshStore()
      toast({
        title: 'Orders Synchronized',
        description: data.recoveredOrders?.length
          ? `Synced ${data.recoveredOrders.length} order(s) from PayMongo!`
          : 'Your orders list is up to date with PayMongo & database.',
      })
    } catch {
      toast({
        title: 'Sync failed',
        description: 'Unable to connect to PayMongo sync. Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSyncing(false)
    }
  }

  const handleClaimOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!claimOrderId.trim()) return

    setIsClaiming(true)
    try {
      const res = await fetch('/api/paymongo/claim-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderIdOrRef: claimOrderId.trim() }),
      })
      const data = await res.json()

      if (res.ok && data.success) {
        toast({
          title: 'Order Linked Successfully!',
          description: `Order ${data.orderId} is now connected to your account.`,
        })
        setClaimOrderId('')
        setShowClaimForm(false)
        await refreshStore()
      } else {
        toast({
          title: 'Linking failed',
          description: data.error || 'Could not find an order matching that ID or reference.',
          variant: 'destructive',
        })
      }
    } catch {
      toast({
        title: 'Network error',
        description: 'Failed to link order. Please check your internet connection.',
        variant: 'destructive',
      })
    } finally {
      setIsClaiming(false)
    }
  }

  const handleConfirmedAction = async () => {
    if (!pendingAction) return

    const action = pendingAction
    setPendingAction(null)
    setSubmittingOrderId(action.order.id)

    try {
      const result = await cancelOwnOrder(action.order.id)
      toast({
        title: result.ok ? 'Order cancelled' : 'Unable to cancel order',
        description: result.message,
        variant: result.ok ? 'default' : 'destructive',
      })
    } finally {
      setSubmittingOrderId(null)
    }
  }

  return (
    <ProtectedRoute>
      <StorefrontShell>
        {/* Desktop Editorial Hero */}
        <div className="hidden md:block">
          <StorefrontPageHero
            eyebrow="My Purchases & Tracking"
            title="My Orders"
            description="Track your luxury perfume orders from preparation to door-to-door delivery. View live courier waybills, re-order favorites, or link guest purchases."
          />
        </div>

        {/* Mobile Native Hybrid App Bar */}
        <div className="block md:hidden px-3.5 pt-3 pb-1">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">Order Tracking</p>
              <h1 className="font-serif text-2xl font-bold text-foreground">My Purchases</h1>
            </div>
            <Link
              href="/track"
              className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-white/90 px-2.5 py-1.5 text-xs font-semibold text-foreground shadow-2xs hover:bg-white"
            >
              <Truck className="h-3.5 w-3.5 text-primary" />
              <span>Waybill Track</span>
            </Link>
          </div>
        </div>

        <section className="px-3 pb-36 pt-2 sm:px-6 sm:pt-4 lg:px-8">
          <div className="mx-auto max-w-6xl">

            {/* ── 1st: Account Info & Quick Actions Bar (Compact Hybrid Style) ── */}
            <div className="mb-3 flex items-center justify-between gap-2 rounded-2xl bg-card border border-border/70 p-2.5 sm:p-3.5 shadow-xs">
              <div className="flex items-center gap-2 min-w-0">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary text-xs font-bold">
                  {user?.name?.charAt(0) || user?.email?.charAt(0).toUpperCase() || 'U'}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-foreground max-w-[130px] sm:max-w-none">
                    {user?.email}
                  </p>
                  <p className="text-[10px] text-foreground/50">
                    {userOrders.length} online orders
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleSyncOrders}
                  disabled={isSyncing}
                  className="rounded-xl border-border/80 h-7.5 sm:h-8 text-[11px] sm:text-xs px-2.5 gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${isSyncing ? 'animate-spin text-primary' : ''}`} />
                  <span>Sync</span>
                </Button>
                <Button
                  variant={showClaimForm ? 'secondary' : 'outline'}
                  size="sm"
                  onClick={() => setShowClaimForm(!showClaimForm)}
                  className="rounded-xl border-border/80 h-7.5 sm:h-8 text-[11px] sm:text-xs px-2.5 gap-1"
                >
                  <Link2 className="h-3 w-3 text-primary" />
                  <span>Link</span>
                </Button>
              </div>
            </div>

            {/* Claim Missing Order Form */}
            {showClaimForm && (
              <div className="mb-3 rounded-2xl border border-primary/30 bg-primary/5 p-4 sm:p-5 transition-all">
                <div className="max-w-xl">
                  <h3 className="text-sm sm:text-base font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Find & Link Missing Order
                  </h3>
                  <p className="mt-1 text-xs text-foreground/70 leading-relaxed">
                    Did you pay using GCash, Maya, or another email during checkout? Enter your Order ID (e.g.{' '}
                    <code className="rounded bg-background px-1 py-0.5 text-primary font-mono font-bold">
                      WEB-XXXXXXXX-XXXX
                    </code>
                    ) or PayMongo reference to immediately attach it to this account.
                  </p>
                  <form onSubmit={handleClaimOrder} className="mt-3 flex flex-col sm:flex-row gap-2">
                    <Input
                      type="text"
                      placeholder="e.g. WEB-12345678-ABCD"
                      value={claimOrderId}
                      onChange={(e) => setClaimOrderId(e.target.value)}
                      className="h-9 sm:h-10 text-xs sm:text-sm bg-background"
                      required
                    />
                    <Button type="submit" disabled={isClaiming} className="h-9 sm:h-10 px-4 text-xs font-semibold">
                      {isClaiming ? 'Linking...' : 'Link to Account'}
                    </Button>
                  </form>
                </div>
              </div>
            )}

            {/* ── 2nd: Shopee / Lazada Style Category Navigation Tabs (Edge-to-Edge) ── */}
            <div className="-mx-3 sm:mx-0 mb-3 border-y sm:border sm:rounded-2xl border-border/70 bg-white/95 backdrop-blur-md sticky top-13 sm:top-16 z-20 shadow-xs">
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar scroll-smooth px-2.5 sm:px-4">
                {ORDER_TABS.map((tab) => {
                  const Icon = tab.icon
                  const count = tabCounts[tab.key]
                  const isActive = activeTab === tab.key

                  return (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setActiveTab(tab.key)}
                      className={`group relative flex shrink-0 items-center gap-1.5 sm:gap-2 px-3 sm:px-5 py-3 sm:py-3.5 text-xs font-semibold sm:text-sm transition-all cursor-pointer ${
                        isActive
                          ? 'text-primary font-bold'
                          : 'text-foreground/60 hover:text-foreground hover:bg-stone-50/70'
                      }`}
                    >
                      <Icon
                        className={`h-4 w-4 transition-transform ${
                          isActive
                            ? 'text-primary scale-110'
                            : 'text-foreground/45 group-hover:text-foreground/70'
                        }`}
                      />
                      <span>{tab.label}</span>
                      {count > 0 && (
                        <span
                          className={`rounded-full px-1.5 py-0.2 text-[10px] font-bold transition-colors ${
                            isActive
                              ? 'bg-primary text-primary-foreground'
                              : tab.key === 'to-receive' || tab.key === 'to-pay'
                                ? 'bg-primary/15 text-primary'
                                : 'bg-muted text-foreground/70'
                          }`}
                        >
                          {count}
                        </span>
                      )}
                      {/* Shopee Active Bottom Orange/Coral Indicator Line */}
                      {isActive && (
                        <span
                          className="absolute bottom-0 left-0 right-0 h-[2.5px] rounded-t-full bg-primary shadow-xs transition-all duration-300"
                          style={{ boxShadow: '0 -2px 8px rgba(255,117,140,0.4)' }}
                        />
                      )}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* ── 3rd: Search Bar for Orders (Compact & Flexible) ─────── */}
            <div className="mb-4 relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/40" />
              <input
                type="text"
                value={searchQuery}
                onChange={(event) => setSearchQuery(event.target.value)}
                aria-label="Search orders"
                placeholder="Search by Order ID, perfume name, courier tracking #..."
                className="w-full h-10 rounded-xl border border-border/80 bg-white/90 pl-9 pr-3 text-xs sm:text-sm text-foreground placeholder:text-foreground/45 shadow-2xs transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary"
              />
            </div>

            {/* ── Order List States ────────────────────────────── */}
            {isStoreLoading ? (
              <div className="storefront-panel rounded-[2rem] p-12 text-center flex flex-col items-center justify-center gap-4">
                <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
                <p className="text-base text-foreground/70">Loading your orders...</p>
              </div>
            ) : userOrders.length === 0 ? (
              <div className="storefront-panel rounded-[2rem] p-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 text-foreground/40 mb-4">
                  <ShoppingBag className="h-8 w-8" />
                </div>
                <p className="text-2xl font-serif text-foreground">No online purchases yet.</p>
                <p className="mt-2 text-sm text-foreground/60 max-w-md mx-auto leading-relaxed">
                  Start your luxury fragrance journey today or link an existing order placed as guest.
                </p>
                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  <Button asChild className="h-11 rounded-2xl bg-primary px-6 text-primary-foreground hover:bg-[#ff8a73]">
                    <Link href="/shop">Explore Fragrance Catalog</Link>
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setShowClaimForm(true)}
                    className="h-11 rounded-2xl border-border px-6"
                  >
                    <Link2 className="mr-2 h-4 w-4" />
                    Link Guest Order
                  </Button>
                </div>
              </div>
            ) : filteredOrders.length === 0 ? (
              /* ── Empty State per Shopee Category ── */
              <div className="storefront-panel rounded-[2rem] p-12 text-center">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 text-primary mb-4">
                  {activeTab === 'to-pay' && <CreditCard className="h-8 w-8" />}
                  {activeTab === 'to-ship' && <Box className="h-8 w-8" />}
                  {activeTab === 'to-receive' && <Truck className="h-8 w-8" />}
                  {activeTab === 'completed' && <CheckCircle2 className="h-8 w-8" />}
                  {activeTab === 'cancelled' && <XCircle className="h-8 w-8" />}
                  {activeTab === 'return-refund' && <RotateCcw className="h-8 w-8" />}
                  {activeTab === 'all' && <Search className="h-8 w-8" />}
                </div>

                <p className="text-2xl font-serif text-foreground">
                  {activeTab === 'to-pay' && 'No Pending Payments'}
                  {activeTab === 'to-ship' && 'No Orders Awaiting Shipment'}
                  {activeTab === 'to-receive' && 'No Parcels in Transit'}
                  {activeTab === 'completed' && 'No Completed Orders Yet'}
                  {activeTab === 'cancelled' && 'No Cancelled Orders'}
                  {activeTab === 'return-refund' && 'No Returns or Refunds'}
                  {activeTab === 'all' && 'No Matching Orders Found'}
                </p>

                <p className="mt-2 text-sm text-foreground/60 max-w-md mx-auto leading-relaxed">
                  {activeTab === 'to-pay' && 'All your orders are fully settled and confirmed.'}
                  {activeTab === 'to-ship' && 'Once you checkout, our fragrance team prepares and packs your bottles here.'}
                  {activeTab === 'to-receive' && 'When your parcel is dispatched to the courier, real-time tracking will appear here.'}
                  {activeTab === 'completed' && 'Delivered orders will be recorded here so you can easily rate or re-order.'}
                  {activeTab === 'cancelled' && 'Great! You have no cancelled fragrance orders.'}
                  {activeTab === 'return-refund' && 'If you need help or replacement for any delivered perfume, our live support is ready to assist.'}
                  {activeTab === 'all' && 'Try clearing your search query to see all your records.'}
                </p>

                <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                  {activeTab !== 'all' ? (
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab('all')}
                      className="rounded-xl border-border/80"
                    >
                      View All Orders ({userOrders.length})
                    </Button>
                  ) : null}
                  <Button asChild className="rounded-xl bg-primary text-primary-foreground hover:bg-[#ff8a73]">
                    <Link href="/shop">Browse Fragrances</Link>
                  </Button>
                </div>
              </div>
            ) : (
              /* ── Orders List ──────────────────────────────────── */
              <div className="space-y-5">
                {filteredOrders.map((order) => {
                  const lastTimelineEntry = getLastTimelineEntry(order)
                  const actionAvailability = order.actionAvailability
                  const badge = getOrderCategoryBadge(order)
                  const CategoryIcon = badge.icon
                  const isDelivering = ['Shipped', 'In Transit', 'Out for Delivery'].includes(order.status)

                  return (
                    <article
                      key={order.id}
                      className="overflow-hidden rounded-2xl border border-border/80 bg-white shadow-sm transition hover:shadow-md"
                    >
                      {/* 1. Shopee Style Order Card Header */}
                      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 bg-stone-50/60 px-4 py-3 sm:px-6">
                        <div className="flex items-center gap-2">
                          <Store className="h-4 w-4 text-primary" />
                          <span className="text-xs sm:text-sm font-bold tracking-tight text-foreground">
                            SPRAY & SNIFF Flagship
                          </span>
                          <span className="hidden sm:inline text-foreground/30">•</span>
                          <span className="hidden sm:inline text-xs text-foreground/55 font-mono">
                            {order.id}
                          </span>
                        </div>

                        {/* Status Pill Badge with Icon */}
                        <div className="flex items-center gap-2">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold ${badge.tone}`}
                          >
                            <CategoryIcon className="h-3 w-3" />
                            <span>{badge.label}</span>
                          </span>
                        </div>
                      </div>

                      {/* 2. Order Metadata Subtitle */}
                      <div className="px-4 pt-3 sm:px-6 flex flex-wrap items-center justify-between gap-2 text-xs text-foreground/50">
                        <span>Placed on {new Date(order.createdAt).toLocaleString()}</span>
                        <span className="sm:hidden font-mono font-medium text-foreground/70">{order.id}</span>
                      </div>

                      {/* 3. Items Listing */}
                      <div className="divide-y divide-border/40 px-4 sm:px-6">
                        {order.items.map((item, index) => {
                          const product = getProductById(item.productId)
                          const imageUrl = item.image || product?.images?.[0]
                          const availableStock = getAvailableStock(item.productId)

                          return (
                            <div
                              key={`${order.id}-item-${index}-${item.productId}-${item.size}`}
                              className="py-3.5 sm:py-4"
                            >
                              <div className="flex items-start gap-3 sm:gap-4">
                                {/* Thumbnail */}
                                <Link
                                  href={`/products/${item.productId}`}
                                  className="relative h-16 w-16 sm:h-20 sm:w-20 shrink-0 overflow-hidden rounded-xl border border-border/70 bg-muted/30 transition hover:opacity-90"
                                >
                                  {imageUrl ? (
                                    <Image
                                      src={imageUrl}
                                      alt={item.productName}
                                      fill
                                      className="object-cover"
                                    />
                                  ) : (
                                    <div className="flex h-full w-full flex-col items-center justify-center p-1 text-center text-[10px] text-foreground/45">
                                      <Package className="h-4 w-4 mb-0.5 text-foreground/40" />
                                      <span>Perfume</span>
                                    </div>
                                  )}
                                </Link>

                                {/* Info */}
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-1">
                                    <div>
                                      <Link
                                        href={`/products/${item.productId}`}
                                        className="font-serif text-sm sm:text-base font-semibold text-foreground hover:text-primary transition-colors block line-clamp-1"
                                      >
                                        {item.productName}
                                      </Link>
                                      {product?.brand && (
                                        <p className="text-xs text-foreground/50">
                                          {product.brand} {product.category ? `• ${product.category}` : ''}
                                        </p>
                                      )}
                                      <div className="mt-1 flex items-center gap-2 text-xs text-foreground/65">
                                        <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-[11px]">
                                          {item.size}ml
                                        </span>
                                        <span>&times; {item.quantity}</span>
                                      </div>
                                    </div>

                                    {/* Item Price */}
                                    <div className="sm:text-right">
                                      <p className="font-serif text-sm sm:text-base font-bold text-foreground">
                                        {formatPHP(item.unitPrice * item.quantity)}
                                      </p>
                                      <p className="text-[11px] text-foreground/45">
                                        {formatPHP(item.unitPrice)} each
                                      </p>
                                    </div>
                                  </div>

                                  {/* Item Quick Actions */}
                                  <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      onClick={async () => {
                                        await addToCart({
                                          productId: item.productId,
                                          size: item.size,
                                          quantity: 1,
                                          unitPrice: item.unitPrice,
                                        })
                                        toast({
                                          title: 'Added to cart',
                                          description: `Added 1x ${item.productName} (${item.size}ml) to your cart.`,
                                        })
                                      }}
                                      className="h-7 rounded-lg px-2.5 text-xs text-foreground/75 hover:text-foreground hover:bg-muted"
                                    >
                                      <ShoppingBag className="mr-1 h-3 w-3 text-primary" />
                                      Buy Again
                                    </Button>

                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      asChild
                                      className="h-7 rounded-lg px-2 text-xs text-foreground/60 hover:text-foreground"
                                    >
                                      <Link href={`/products/${item.productId}`}>
                                        View Details
                                      </Link>
                                    </Button>

                                    {order.status === 'Delivered' && (
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        asChild
                                        className="h-7 rounded-lg border-primary/30 bg-primary/5 px-2.5 text-xs font-semibold text-primary hover:bg-primary/15"
                                      >
                                        <Link href={`/products/${item.productId}`}>
                                          <Star className="mr-1 h-3 w-3 fill-primary text-primary" />
                                          Rate
                                        </Link>
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          )
                        })}
                      </div>

                      {/* 4. Live Courier & Delivery Waybill Banner */}
                      {(isDelivering || order.courier || order.trackingNumber || lastTimelineEntry) && (
                        <div className="border-t border-border/50 bg-[#fffaf5] px-4 py-3 sm:px-6">
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                            <div className="flex items-start sm:items-center gap-2.5">
                              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#ffe5de] text-primary">
                                <Truck className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-xs font-semibold text-foreground">
                                  {order.courier ? `${order.courier} • ` : 'Courier Tracking • '}
                                  <span className="font-mono text-primary select-all font-bold">
                                    {order.trackingNumber || order.id}
                                  </span>
                                </p>
                                {lastTimelineEntry && (
                                  <p className="text-xs text-foreground/65 line-clamp-1">
                                    {lastTimelineEntry.status}: {lastTimelineEntry.note}
                                  </p>
                                )}
                              </div>
                            </div>

                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="h-8 rounded-xl border-border/80 bg-white text-xs font-semibold hover:border-primary/50 shrink-0"
                            >
                              <Link href={`/track?num=${encodeURIComponent(order.trackingNumber || order.id)}`}>
                                Track Parcel 🚚
                              </Link>
                            </Button>
                          </div>
                        </div>
                      )}

                      {/* 5. Shopee Style Total & Action Buttons Footer */}
                      <div className="border-t border-border/60 bg-white px-4 py-4 sm:px-6">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                          {/* Total Breakdown */}
                          <div className="text-xs text-foreground/65">
                            <span>
                              {order.items.length} item{order.items.length === 1 ? '' : 's'} &bull; Payment:{' '}
                              <span className="font-semibold text-foreground">{order.paymentMethod}</span> (
                              <span className={order.paymentStatus === 'Paid' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                                {order.paymentStatus}
                              </span>
                              )
                            </span>
                            <div className="mt-0.5 flex items-baseline gap-1.5">
                              <span className="text-xs uppercase tracking-wider text-foreground/50">Order Total:</span>
                              <span className="font-serif text-lg sm:text-xl font-bold text-primary">
                                {formatPHP(order.total)}
                              </span>
                              <span className="rounded bg-emerald-500/10 px-1.5 py-0.2 text-[10px] font-bold text-emerald-700">
                                12% VAT Included
                              </span>
                            </div>
                          </div>

                          {/* Action Buttons tailored to category */}
                          <div className="flex flex-wrap items-center gap-2">
                            {/* Cancellation Button */}
                            {actionAvailability?.canCancel && (
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-9 rounded-xl border-rose-200 bg-white text-xs font-semibold text-rose-700 hover:bg-rose-50"
                                disabled={submittingOrderId === order.id}
                                onClick={() => setPendingAction({ type: 'cancel', order })}
                              >
                                {submittingOrderId === order.id ? 'Cancelling...' : 'Cancel Order'}
                              </Button>
                            )}

                            {/* Pay Now Button (If To Pay) */}
                            {matchesCategory(order, 'to-pay') && (
                              <Button
                                size="sm"
                                asChild
                                className="h-9 rounded-xl bg-primary px-4 text-xs font-semibold text-primary-foreground shadow-xs hover:bg-[#ff8a73]"
                              >
                                <Link href="/checkout">
                                  Pay Now
                                </Link>
                              </Button>
                            )}

                            {/* Track Delivery Button */}
                            <Button
                              variant="outline"
                              size="sm"
                              asChild
                              className="h-9 rounded-xl border-border/80 bg-white text-xs font-semibold text-foreground hover:bg-muted"
                            >
                              <Link href={`/track?num=${encodeURIComponent(order.trackingNumber || order.id)}`}>
                                Track Delivery
                              </Link>
                            </Button>

                            {/* Buy Again (All Items in Order) */}
                            <Button
                              size="sm"
                              onClick={async () => {
                                for (const itm of order.items) {
                                  await addToCart({
                                    productId: itm.productId,
                                    size: itm.size,
                                    quantity: itm.quantity,
                                    unitPrice: itm.unitPrice,
                                  })
                                }
                                toast({
                                  title: 'Order Re-added to Cart',
                                  description: `Re-added ${order.items.length} item(s) to your shopping bag.`,
                                })
                              }}
                              className="h-9 rounded-xl bg-primary text-xs font-semibold text-primary-foreground shadow-xs hover:bg-[#ff8a73]"
                            >
                              <ShoppingBag className="mr-1.5 h-3.5 w-3.5" />
                              Buy Again
                            </Button>
                          </div>
                        </div>
                      </div>

                    </article>
                  )
                })}
              </div>
            )}

          </div>
        </section>

        {/* Cancel Order Alert Dialog */}
        <AlertDialog
          open={pendingAction !== null}
          onOpenChange={(open) => {
            if (!open) setPendingAction(null)
          }}
        >
          <AlertDialogContent className="rounded-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Cancel this order?</AlertDialogTitle>
              <AlertDialogDescription>
                {pendingAction?.order.paymentStatus === 'Paid'
                  ? 'This will cancel the order immediately. Because payment was already recorded, our staff will contact you to facilitate the refund.'
                  : 'This will cancel the order immediately and release the reserved perfume inventory.'}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="rounded-xl">Keep Order</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => void handleConfirmedAction()}
                className="rounded-xl bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Cancel Order
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </StorefrontShell>
    </ProtectedRoute>
  )
}

export default function OrdersPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        </div>
      }
    >
      <OrdersContent />
    </Suspense>
  )
}
