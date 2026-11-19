'use client'

import React, { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { StorefrontShell } from '@/components/storefront-shell'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { TrackingTimeline } from '@/components/tracking-timeline'
import { fetchTrackingInfo, pollTrackingRequest } from '@/lib/tracking-service'
import type { TrackingResult } from '@/lib/tracking-types'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Search,
  Package,
  ShieldCheck,
  HelpCircle,
  RefreshCw,
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

  // Auto-poll active asynchronous Parcels v5 request while processing
  useEffect(() => {
    const reqId = trackingData?.requestId
    if (!trackingData?.isProcessing || !reqId) return

    let cancelled = false
    let attempts = 0
    const maxAttempts = 6

    const timer = setInterval(async () => {
      attempts += 1
      if (cancelled || attempts > maxAttempts) {
        clearInterval(timer)
        return
      }

      try {
        const updated = await pollTrackingRequest(reqId)
        if (!cancelled) {
          setTrackingData(updated)
          if (!updated.isProcessing) {
            clearInterval(timer)
          }
        }
      } catch {
        clearInterval(timer)
      }
    }, 2500)

    return () => {
      cancelled = true
      clearInterval(timer)
    }
  }, [trackingData?.isProcessing, trackingData?.requestId])

  return (
    <div className="container max-w-4xl mx-auto px-4 py-8 md:py-12">
      {/* Search Bar Box */}
      <div className="bg-card border border-border/80 rounded-2xl p-6 mb-8" data-ui="tracking-search-box">
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
              placeholder="Enter your Order ID (e.g. WEB-12345678-ABCD) or Courier Waybill #"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              className="pl-10 h-12 text-sm bg-background"
            />
          </div>
          <Button type="submit" disabled={isLoading} className="h-12 px-6 gap-2">
            <Search className="w-4 h-4" />
            {isLoading ? 'Searching...' : 'Track Package'}
          </Button>

          {trackingData && (
            <Button
              type="button"
              variant="outline"
              disabled={isLoading}
              onClick={() => handleSearch(trackingNumber)}
              className="h-12 px-4 gap-1.5"
              title="Refresh live status"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline text-xs">Refresh</span>
            </Button>
          )}
        </form>
        <p className="mt-4 text-xs text-muted-foreground">
          Track packages across 1,540+ global couriers (LBC, J&amp;T Express, Ninja Van, 2GO, Flash Express, DHL, FedEx, UPS) or by your store Order ID.
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
        <div className="bg-card border rounded-2xl p-12 text-center text-muted-foreground">
          <Package className="w-8 h-8 mx-auto mb-2 text-muted-foreground/50 animate-spin" />
          <p className="text-sm">Fetching real-time delivery telemetry...</p>
        </div>
      ) : trackingData ? (
        <TrackingTimeline tracking={trackingData} />
      ) : null}

      {/* Trust & Support Footer */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-4 text-xs text-muted-foreground">
        <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/40">
          <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">Verified Delivery Tracking</p>
            <p className="mt-0.5">Real-time carrier scans verified through ParcelsApp logistics network.</p>
          </div>
        </div>
        <div className="flex items-start gap-3 p-4 rounded-xl bg-muted/30 border border-border/40">
          <HelpCircle className="w-5 h-5 text-primary shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-foreground">Need help with your shipment?</p>
            <p className="mt-0.5">Contact our support desk anytime if your tracking status has not updated after 48 hours.</p>
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
        title="Track Your Delivery"
        description="Monitor real-time delivery progress and courier waybill updates for your order."
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
