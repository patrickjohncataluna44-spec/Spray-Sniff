'use client'

import Link from 'next/link'
import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { ArrowLeft, Edit, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { ProtectedRoute } from '@/components/protected-route'
import {
  deleteStoredPromotion,
  formatPromotionUsage,
  formatStoredPromotionDiscount,
  listPromotions,
  subscribeToPromotions,
  type StoredPromotion,
} from '@/lib/admin-promotions'

function getStatusClasses(status: StoredPromotion['status']) {
  switch (status) {
    case 'Active':
      return 'bg-green-100 text-green-700'
    case 'Scheduled':
      return 'bg-amber-100 text-amber-700'
    case 'Paused':
      return 'bg-slate-200 text-slate-700'
    case 'Expired':
      return 'bg-rose-100 text-rose-700'
    default:
      return 'bg-sky-100 text-sky-700'
  }
}

export default function AdminPromotionsPage() {
  const [promotions, setPromotions] = useState<StoredPromotion[]>([])

  const loadPromotions = useEffectEvent(async () => {
    try {
      setPromotions(await listPromotions())
    } catch (error) {
      toast({
        title: 'Unable to load promotions',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    }
  })

  useEffect(() => {
    void loadPromotions()

    return subscribeToPromotions(() => {
      void loadPromotions()
    })
  }, [])

  const sortedPromotions = useMemo(
    () =>
      [...promotions].sort((left, right) =>
        left.code.localeCompare(right.code, undefined, { sensitivity: 'base' }),
      ),
    [promotions],
  )

  const handleDelete = async (promotion: StoredPromotion) => {
    const shouldDelete = window.confirm(
      `Remove promotion "${promotion.code}" from the discount list?`,
    )

    if (!shouldDelete) {
      return
    }

    try {
      await deleteStoredPromotion(promotion.id)
      setPromotions((current) => current.filter((item) => item.id !== promotion.id))
    } catch (error) {
      toast({
        title: 'Unable to remove promotion',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
      return
    }
    toast({
      title: 'Promotion removed',
      description: `${promotion.code} was deleted from your discounts list.`,
    })
  }

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card">
          <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
            <div className="mb-4 flex items-center gap-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/dashboard" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </Link>
              </Button>
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <h1 className="font-serif text-3xl text-foreground">
                  Promotions & Discounts
                </h1>
                <p className="mt-2 max-w-3xl text-sm text-foreground/60">
                  Create and refine discount campaigns with clear usage limits,
                  timing windows, and status controls.
                </p>
              </div>

              <Button asChild>
                <Link href="/admin/promotions/new">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Promotion
                </Link>
              </Button>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-6 py-4 text-left font-medium text-foreground/60">
                      Code
                    </th>
                    <th className="px-6 py-4 text-left font-medium text-foreground/60">
                      Type
                    </th>
                    <th className="px-6 py-4 text-left font-medium text-foreground/60">
                      Discount
                    </th>
                    <th className="px-6 py-4 text-left font-medium text-foreground/60">
                      Usage
                    </th>
                    <th className="px-6 py-4 text-left font-medium text-foreground/60">
                      Status
                    </th>
                    <th className="px-6 py-4 text-left font-medium text-foreground/60">
                      Expires
                    </th>
                    <th className="px-6 py-4 text-right font-medium text-foreground/60">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {sortedPromotions.length > 0 ? (
                    sortedPromotions.map((promotion) => (
                      <tr
                        key={promotion.id}
                        className="border-b border-border last:border-0 hover:bg-muted/50"
                      >
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground">
                            {promotion.code}
                          </p>
                          {promotion.description ? (
                            <p className="mt-1 text-xs text-foreground/55">
                              {promotion.description}
                            </p>
                          ) : null}
                        </td>
                        <td className="px-6 py-4 text-foreground">
                          {promotion.type}
                        </td>
                        <td className="px-6 py-4 font-medium text-foreground">
                          {formatStoredPromotionDiscount(promotion)}
                        </td>
                        <td className="px-6 py-4 text-foreground/60">
                          {formatPromotionUsage(promotion)}
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${getStatusClasses(
                              promotion.status,
                            )}`}
                          >
                            {promotion.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-foreground/60">
                          {promotion.expiresAt}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              asChild
                              className="text-foreground/60 hover:text-foreground"
                            >
                              <Link
                                href={`/admin/promotions/${promotion.id}`}
                                aria-label={`Edit ${promotion.code}`}
                                title={`Edit ${promotion.code}`}
                              >
                                <Edit className="h-4 w-4" />
                              </Link>
                            </Button>

                            <button
                              type="button"
                              onClick={() => handleDelete(promotion)}
                              className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                              aria-label={`Delete ${promotion.code}`}
                              title={`Delete ${promotion.code}`}
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-6 py-12 text-center text-foreground/60"
                      >
                        No promotions yet. Create your first discount campaign.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
