'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { StorefrontShell } from '@/components/storefront-shell'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { TrackingTimeline } from '@/components/tracking-timeline'
import { fetchTrackingInfo } from '@/lib/tracking-service'
import type { TrackingResult } from '@/lib/tracking-types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Search,
  Package,
  ShieldCheck,
  HelpCircle,
  CreditCard,
  Box,
  Truck,
  CheckCircle2,
  XCircle,
  RotateCcw,
} from 'lucide-react'

function TrackContent() {
  const searchParams = useSearchParams()
  const initialNumber =
    searchParams.get('num') ||
    searchParams.get('number') ||
    searchParams.get('orderId') ||
    ''

  const [trackingNumber, setTrackingNumber] = useState(initialNumber)
  const [trackingData, setTrackingData] = useState<TrackingResult | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleSearch = async (numToFetch: string) => {
    const trimmed = numToFetch.trim()
    if (!trimmed) return

    setIsLoading(true)
    setErrorMessage(null)

    try {
      const data = await fetchTrackingInfo(trimmed)
      setTrackingData(data)
    } catch (err: any) {
      setTrackingData(null)
      setErrorMessage(err.message || 'Unable to track shipment. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Load if URL query exists on mount
  useEffect(() => {
    if (initialNumber) {
      handleSearch(initialNumber)
    }
  }, [initialNumber])

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 md:py-12">
      {/* Shopee Category Quick Access Bar */}
      <div className="mb-6 rounded-2xl border border-border/80 bg-white/85 p-4 shadow-xs backdrop-blur">
        <div className="flex items-center justify-between gap-2 mb-3">
          <p className="text-xs font-bold uppercase tracking-wider text-foreground/50">
            Track By Purchase Status
          </p>
          <Link href="/orders" className="text-xs font-semibold text-primary hover:underline">
            View All Purchases &rarr;
          </Link>
        </div>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
          {[
            { label: 'To Pay', tab: 'to-pay', icon: CreditCard },
            { label: 'To Ship', tab: 'to-ship', icon: Box },
            { label: 'To Receive', tab: 'to-receive', icon: Truck },
            { label: 'Completed', tab: 'completed', icon: CheckCircle2 },
            { label: 'Cancelled', tab: 'cancelled', icon: XCircle },
            { label: 'Return', tab: 'return-refund', icon: RotateCcw },
          ].map((item) => {
            const Icon = item.icon
            return (
              <Link
                key={item.tab}
                href={`/orders?tab=${item.tab}`}
                className="flex flex-col items-center justify-center gap-1.5 rounded-xl border border-border/60 bg-stone-50/60 p-2.5 text-center text-xs font-medium text-foreground transition hover:border-primary/50 hover:bg-white hover:text-primary active:scale-95"
              >
                <Icon className="h-4 w-4 text-primary" />
                <span className="truncate text-[11px] font-semibold">{item.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Search Bar Box */}
      <div className="bg-card border border-border/80 rounded-2xl p-6 shadow-sm mb-8">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            handleSearch(trackingNumber)
          }}
          className="flex flex-col sm:flex-row gap-3"
        >
          <div className="relative flex-1">
            <Package className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              placeholder="Enter your Order ID (e.g. WEB-12345678-ABCD) or Tracking #"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="pl-10 h-12 text-sm bg-background"
            />
          </div>
          <Button type="submit" disabled={isLoading} className="h-12 px-6 gap-2">
            <Search className="w-4 h-4" />
            {isLoading ? 'Searching...' : 'Track Package'}
          </Button>
        </form>
        <p className="mt-4 text-xs text-muted-foreground">
          Track any package instantly using your Order ID from your receipt, confirmation, or courier waybill.
        </p>
      </div>

      {/* Error Alert */}
      {errorMessage && (
        <div className="p-4 mb-6 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {errorMessage}
        </div>
      )}

      {/* Loading Skeleton or Content */}
      {isLoading && !trackingData ? (
        <div className="bg-card border rounded-2xl p-12 text-center text-muted-foreground animate-pulse">
          <Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50 animate-bounce" />
          <p className="text-sm">Fetching your delivery progress...</p>
        </div>
      ) : trackingData ? (
        <TrackingTimeline tracking={trackingData} />
      ) : null}

      {/* Trust & Support Footer */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/40">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">Insured &amp; Verified Delivery</p>
            <p className="mt-0.5">All shipments are sealed and verified at dispatch before courier handover.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/40">
          <HelpCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">Need help with your shipment?</p>
            <p className="mt-0.5">Contact our support desk if your tracking status has not updated after 48 hours.</p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function TrackPage() {
  return (
    <StorefrontShell>
      <StorefrontPageHero
        eyebrow="Order Fulfillment & Logistics"
        title="Track Your Delivery"
        description="Monitor delivery progress and package updates for your order."
      />
      <Suspense fallback={
        <div className="container max-w-4xl mx-auto px-4 py-12 text-center text-muted-foreground">
          Loading shipment tracker...
        </div>
      }>
        <TrackContent />
      </Suspense>
    </StorefrontShell>
  )
}
