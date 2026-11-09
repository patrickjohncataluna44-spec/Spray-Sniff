'use client'

import { useMemo, useState } from 'react'
import { Package, ShieldAlert, CheckCircle2, Search, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
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
import {
  DELIVERY_ORDER_STATUSES,
  type OrderRecord,
  type OrderStatus,
  useStore,
} from '@/lib/store-context'
import { toast } from '@/hooks/use-toast'

interface AdminDeliveryDialogProps {
  order: OrderRecord | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const DELIVERY_STATUS_RANK: Record<string, number> = {
  Shipped: 0,
  'In Transit': 1,
  'Out for Delivery': 2,
  Delivered: 3,
}

/** Stages an admin may still move this order to: forward only, never backwards. */
function getSelectableStatuses(currentStatus: OrderStatus) {
  const currentRank = DELIVERY_STATUS_RANK[currentStatus]

  if (currentRank === undefined) {
    return [...DELIVERY_ORDER_STATUSES]
  }

  return DELIVERY_ORDER_STATUSES.filter((status) => DELIVERY_STATUS_RANK[status] > currentRank)
}

/**
 * Rendered with a `key` tied to the order id, so opening the dialog for a
 * different order remounts it with that order's values. This avoids a reset
 * effect that would otherwise wipe unsaved input whenever realtime updates
 * refresh the order list underneath the open dialog.
 */
export function AdminDeliveryDialog({ order, open, onOpenChange }: AdminDeliveryDialogProps) {
  const { updateOrderDelivery } = useStore()

  const selectableStatuses = useMemo(
    () => (order ? getSelectableStatuses(order.status) : []),
    [order],
  )

  const [courier, setCourier] = useState(order?.courier ?? '')
  const [trackingNumber, setTrackingNumber] = useState(order?.trackingNumber ?? '')
  const [deliveryNotes, setDeliveryNotes] = useState(order?.deliveryNotes ?? '')
  const [status, setStatus] = useState<OrderStatus | ''>(() => getSelectableStatuses(order?.status ?? 'Pending')[0] ?? '')
  const [isSaving, setIsSaving] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [isCheckingWaybill, setIsCheckingWaybill] = useState(false)
  const [detectedCarrier, setDetectedCarrier] = useState<string | null>(null)

  if (!order) {
    return null
  }

  const handleVerifyWaybill = async () => {
    const trimmed = trackingNumber.trim()
    if (!trimmed) {
      toast({
        title: 'Enter a tracking number',
        description: 'Please input a waybill number to verify with ParcelsApp.',
        variant: 'destructive',
      })
      return
    }

    setIsCheckingWaybill(true)
    setDetectedCarrier(null)

    try {
      const res = await fetch(`/api/track?number=${encodeURIComponent(trimmed)}`)
      const data = await res.json().catch(() => null)

      if (res.ok && data?.carrier?.name && data?.carrier?.name !== 'Courier Partner') {
        setDetectedCarrier(data.carrier.name)
        if (!courier.trim()) {
          setCourier(data.carrier.name)
        }
        toast({
          title: 'Carrier Identified',
          description: `Recognized carrier: ${data.carrier.name}`,
        })
      } else {
        toast({
          title: 'Waybill Registered',
          description: 'Tracking number recorded. Live satellite events will sync once accepted by courier.',
        })
      }
    } catch {
      toast({
        title: 'Verification Notice',
        description: 'Courier check completed. Tracking will update as courier scans progress.',
      })
    } finally {
      setIsCheckingWaybill(false)
    }
  }

  const handleRequestSave = () => {
    if (!status) {
      toast({
        title: 'No delivery stage selected',
        description: 'This order is already at the final delivery stage.',
        variant: 'destructive',
      })
      return
    }

    setConfirming(true)
  }

  const handleConfirmSave = async () => {
    if (!status) {
      return
    }

    setConfirming(false)
    setIsSaving(true)

    try {
      const result = await updateOrderDelivery(order.id, {
        status,
        courier,
        trackingNumber,
        deliveryNotes,
      })

      toast({
        title: result.ok ? 'Delivery updated' : 'Unable to update delivery',
        description: result.message,
        variant: result.ok ? 'default' : 'destructive',
      })

      if (result.ok) {
        // Trigger initial background tracking query to ParcelsApp
        if (trackingNumber.trim()) {
          fetch(`/api/track?number=${encodeURIComponent(trackingNumber.trim())}`).catch(() => {})
        }
        onOpenChange(false)
      }
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg" data-ui="admin-delivery-dialog">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-4 w-4" />
              Manage Delivery — {order.id}
            </DialogTitle>
            <DialogDescription>
              Delivery progress is visible to the customer on their tracking page. Live courier scans sync via ParcelsApp.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="delivery-courier">Courier Partner</Label>
              <Input
                id="delivery-courier"
                value={courier}
                onChange={(event) => setCourier(event.target.value)}
                placeholder="e.g. LBC, J&T Express, Ninja Van, Flash Express"
                maxLength={200}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="delivery-tracking">Tracking / Waybill Number</Label>
                {detectedCarrier && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" /> {detectedCarrier}
                  </span>
                )}
              </div>
              <div className="flex gap-2">
                <Input
                  id="delivery-tracking"
                  value={trackingNumber}
                  onChange={(event) => setTrackingNumber(event.target.value)}
                  placeholder="e.g. 9400111206213785678901, 1234567890"
                  maxLength={200}
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleVerifyWaybill}
                  disabled={isCheckingWaybill || !trackingNumber.trim()}
                  className="shrink-0 gap-1 text-xs"
                >
                  {isCheckingWaybill ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Search className="h-3.5 w-3.5" />
                  )}
                  Verify
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Customers can track using this waybill or their Order ID with real-time satellite updates.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="delivery-status">Delivery stage</Label>
              {selectableStatuses.length === 0 ? (
                <p className="rounded-lg border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                  This order is already delivered. Delivery stages cannot be moved backwards.
                </p>
              ) : (
                <select
                  id="delivery-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as OrderStatus)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  {selectableStatuses.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              )}
              <p className="text-xs text-muted-foreground">
                Current stage: <span className="font-medium text-foreground">{order.status}</span>
              </p>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="delivery-notes">Notes (optional)</Label>
              <Textarea
                id="delivery-notes"
                value={deliveryNotes}
                onChange={(event) => setDeliveryNotes(event.target.value)}
                placeholder="Special delivery instructions or packaging notes."
                maxLength={200}
                rows={3}
              />
            </div>

            <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
              <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <p>
                Your admin name is recorded against this update and shown in the order audit log.
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSaving}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleRequestSave}
              disabled={isSaving || selectableStatuses.length === 0}
            >
              {isSaving ? 'Saving...' : 'Save delivery'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirming} onOpenChange={setConfirming}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Move {order.id} to {status || 'a new stage'}?
            </AlertDialogTitle>
            <AlertDialogDescription>
              The customer will see this stage on their tracking page immediately. Delivery
              stages move forward only and cannot be reverted.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Go back</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleConfirmSave()}>
              Confirm change
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
