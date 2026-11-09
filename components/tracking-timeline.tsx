'use client'

import React from 'react'
import {
  CheckCircle2,
  Clock,
  Package,
  PackageCheck,
  Truck,
  Building2,
  ExternalLink,
  MapPin,
  Calendar,
  Info,
  AlertCircle,
  Radio,
  ArrowRight,
} from 'lucide-react'
import {
  DELIVERY_STAGES,
  getDeliveryStageIndex,
  type TrackingResult,
} from '@/lib/tracking-types'

interface TrackingTimelineProps {
  tracking: TrackingResult
}

const STAGE_ICONS: Record<string, React.ElementType> = {
  order_placed: Clock,
  preparing_to_ship: Package,
  picked_up: PackageCheck,
  in_transit: Truck,
  out_for_delivery: Building2,
  delivered: CheckCircle2,
}

export function TrackingTimeline({ tracking }: TrackingTimelineProps) {
  const isException = tracking.status === 'exception'
  const currentIndex = getDeliveryStageIndex(tracking.status)
  const stageLabel =
    DELIVERY_STAGES.find((entry) => entry.stage === tracking.status)?.label ?? 'In Transit'

  return (
    <div className="space-y-6">
      {/* Header Info Card */}
      <div className="rounded-2xl border border-border/80 bg-card p-5 md:p-6" data-ui="tracking-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-muted-foreground">
                Courier Partner
              </span>
              {tracking.carrier.externalTrackingUrl ? (
                <a
                  href={tracking.carrier.externalTrackingUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs text-primary hover:underline gap-1"
                >
                  Track on {tracking.carrier.name} <ExternalLink className="h-3 w-3" />
                </a>
              ) : tracking.carrier.website ? (
                <a
                  href={tracking.carrier.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-xs text-primary hover:underline gap-1"
                >
                  Courier website <ExternalLink className="h-3 w-3" />
                </a>
              ) : null}
            </div>

            <div className="flex items-baseline gap-2.5 mt-1">
              <h3 className="text-xl font-bold text-foreground">
                {tracking.carrier.name}
              </h3>
              {tracking.isLiveCourier && (
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
                  <Radio className="h-3 w-3 text-emerald-600 animate-pulse" />
                  Live Satellite Scan
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-sm text-muted-foreground">
              <p className="font-mono select-all">
                Waybill: <span className="font-semibold text-foreground">{tracking.trackingNumber}</span>
              </p>
              {tracking.orderId && (
                <p className="font-mono select-all">
                  Order: <span className="font-semibold text-foreground">{tracking.orderId}</span>
                </p>
              )}
            </div>

            {(tracking.origin || tracking.destination) && (
              <div className="flex items-center gap-1.5 mt-2 text-xs font-medium text-foreground/80">
                <span>{tracking.origin || 'Origin Hub'}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span>{tracking.destination || 'Destination'}</span>
              </div>
            )}
          </div>

          <div className="sm:text-right">
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold ${
                isException
                  ? 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-300 dark:border-rose-800'
                  : tracking.status === 'delivered'
                    ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800'
                    : 'bg-primary/10 text-primary border border-primary/20'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-current" />
              {tracking.statusText}
            </span>
            <p className="text-xs text-muted-foreground mt-1.5">
              Status: <span className="font-medium text-foreground">{tracking.estimatedDelivery}</span>
            </p>
          </div>
        </div>

        {/* Progress Stepper */}
        <div className="pt-6 pb-2">
          <div className="relative">
            {/* Background Line */}
            <div className="absolute top-4 left-4 right-4 h-1 bg-muted rounded-full" />
            {/* Active Progress Line */}
            {!isException && (
              <div
                className="absolute top-4 left-4 h-1 bg-primary rounded-full transition-all duration-500 ease-out"
                style={{
                  width: `${(currentIndex / (DELIVERY_STAGES.length - 1)) * 100}%`,
                }}
              />
            )}

            {/* Stepper Dots */}
            <div className="relative z-10 flex justify-between">
              {DELIVERY_STAGES.map((entry, idx) => {
                const Icon = STAGE_ICONS[entry.stage] ?? Clock
                const isPassed = !isException && idx <= currentIndex
                const isCurrent = !isException && idx === currentIndex

                return (
                  <div key={entry.stage} className="flex flex-col items-center group">
                    <div
                      className={`w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 border-2 ${
                        isPassed
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-card text-muted-foreground border-muted-foreground/30'
                      } ${isCurrent ? 'ring-4 ring-primary/20 scale-110' : ''}`}
                    >
                      <Icon className="w-4 h-4" />
                    </div>
                    <span
                      className={`text-[11px] sm:text-xs mt-2 text-center max-w-[64px] sm:max-w-none font-medium ${
                        isCurrent
                          ? 'text-foreground font-semibold'
                          : isPassed
                            ? 'text-muted-foreground'
                            : 'text-muted-foreground/50'
                      }`}
                    >
                      {entry.label}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>
        </div>

        {isException && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              This shipment encountered an exception or cancellation. Contact our support desk if you need assistance.
            </p>
          </div>
        )}

        <div className="mt-6 flex items-start gap-3 rounded-xl border border-border/60 bg-muted/30 p-4 text-xs text-muted-foreground">
          <Info className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {tracking.isLiveCourier ? (
              <>
                Live carrier telemetry synchronized via ParcelsApp. Current verified stage:{' '}
                <span className="font-semibold text-foreground">{stageLabel}</span>.
              </>
            ) : (
              <>
                Your order is currently being fulfilled by our boutique team. Current stage:{' '}
                <span className="font-semibold text-foreground">{stageLabel}</span>. Once dispatched to the courier, real-time satellite scans will update here.
              </>
            )}
          </p>
        </div>
      </div>

      {/* Events Timeline Log */}
      {tracking.events.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">
          No delivery checkpoints have been recorded for this package yet.
        </p>
      ) : (
        <div className="space-y-6 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-border/70">
          {tracking.events.map((event, idx) => {
            const isLatest = idx === 0
            const isCourier = event.source === 'courier'

            return (
              <div key={`${event.id}-${idx}`} className="relative flex items-start gap-4">
                {/* Bullet */}
                <div
                  className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center shrink-0 border-2 transition ${
                    isLatest
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card text-muted-foreground border-muted-foreground/30'
                  }`}
                >
                  {isLatest ? (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-muted-foreground/50" />
                  )}
                </div>

                {/* Content */}
                <div className="flex-1 pt-0.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
                    <div className="flex items-center gap-2">
                      <p className={`text-sm font-semibold ${isLatest ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {event.status}
                      </p>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                          isCourier
                            ? 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300'
                            : 'bg-stone-100 text-stone-700 dark:bg-stone-800 dark:text-stone-300'
                        }`}
                      >
                        {isCourier ? 'Courier Scan' : 'Boutique'}
                      </span>
                    </div>

                    <time className="text-xs text-muted-foreground flex items-center gap-1 font-mono">
                      <Calendar className="w-3 h-3" />
                      {new Date(event.datetime).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        hour: 'numeric',
                        minute: '2-digit',
                        hour12: true,
                      })}
                    </time>
                  </div>

                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <MapPin className="w-3 h-3 text-muted-foreground/70 shrink-0" />
                    <span>{event.location}</span>
                  </p>

                  {event.description && event.description !== event.status && (
                    <p className="text-xs text-foreground/80 mt-1 bg-muted/30 p-2 rounded-md border border-border/40">
                      {event.description}
                    </p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
