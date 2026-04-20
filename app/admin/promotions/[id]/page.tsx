'use client'

import Link from 'next/link'
import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AdminPromotionEditor } from '@/components/admin-promotion-editor'
import { Button } from '@/components/ui/button'
import { ProtectedRoute } from '@/components/protected-route'
import { toast } from '@/hooks/use-toast'
import {
  listPromotions,
  promotionFormValuesFromPromotion,
  subscribeToPromotions,
  updateStoredPromotion,
  updatePromotionFromForm,
  type PromotionFormValues,
  type StoredPromotion,
} from '@/lib/admin-promotions'

export default function EditPromotionPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const [promotions, setPromotions] = useState<StoredPromotion[] | null>(null)
  const promotionId = decodeURIComponent(
    Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '',
  )

  const loadPromotions = useEffectEvent(async () => {
    try {
      setPromotions(await listPromotions())
    } catch (error) {
      toast({
        title: 'Unable to load promotion',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
      setPromotions([])
    }
  })

  useEffect(() => {
    void loadPromotions()

    return subscribeToPromotions(() => {
      void loadPromotions()
    })
  }, [])

  const promotion = useMemo(
    () => promotions?.find((item) => item.id === promotionId),
    [promotionId, promotions],
  )
  const initialValues = useMemo(() => {
    if (!promotion) {
      return null
    }

    return promotionFormValuesFromPromotion(promotion)
  }, [promotion])

  const handleSubmit = async (values: PromotionFormValues) => {
    try {
      if (!promotion || !promotions) {
        toast({
          title: 'Promotion not found',
          description: 'This discount campaign is no longer available to edit.',
          variant: 'destructive',
        })
        return
      }

      const updatedPromotion = updatePromotionFromForm(promotion, values)
      const duplicateCode = promotions.some(
        (item) =>
          item.id !== promotion.id &&
          item.code.toLowerCase() === updatedPromotion.code.toLowerCase(),
      )

      if (duplicateCode) {
        toast({
          title: 'Promotion code already exists',
          description: 'Use a different code before saving your changes.',
          variant: 'destructive',
        })
        return
      }

      await updateStoredPromotion(updatedPromotion)
      const nextPromotions = promotions.map((item) =>
        item.id === promotion.id ? updatedPromotion : item,
      )
      setPromotions(nextPromotions)
      toast({
        title: 'Promotion updated',
        description: `${updatedPromotion.code} was updated successfully.`,
      })
      router.push('/admin/promotions')
    } catch (error) {
      toast({
        title: 'Unable to update promotion',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    }
  }

  if (promotions === null) {
    return null
  }

  if (!promotion || !initialValues) {
    return (
      <ProtectedRoute requiredRole="ADMIN">
        <div className="min-h-screen bg-background">
          <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin/promotions" className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Promotions
              </Link>
            </Button>

            <div className="mt-6 rounded-3xl border border-border bg-card p-8 shadow-sm">
              <h1 className="font-serif text-3xl text-foreground">
                Promotion not found
              </h1>
              <p className="mt-3 max-w-2xl text-sm text-foreground/65">
                The discount you tried to edit could not be loaded. It may already
                have been removed.
              </p>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <AdminPromotionEditor
        title={`Edit ${promotion.code}`}
        description="Refine the discount value, campaign dates, and usage controls without rebuilding the promotion from scratch."
        submitLabel="Save Changes"
        backHref="/admin/promotions"
        backLabel="Back to Promotions"
        cancelHref="/admin/promotions"
        initialValues={initialValues}
        onSubmit={handleSubmit}
      />
    </ProtectedRoute>
  )
}
