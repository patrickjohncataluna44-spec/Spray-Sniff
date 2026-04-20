'use client'

import { useRouter } from 'next/navigation'
import { AdminPromotionEditor } from '@/components/admin-promotion-editor'
import { ProtectedRoute } from '@/components/protected-route'
import { toast } from '@/hooks/use-toast'
import {
  createStoredPromotion,
  createPromotionFromForm,
  initialPromotionFormValues,
  listPromotions,
  type PromotionFormValues,
} from '@/lib/admin-promotions'

export default function NewPromotionPage() {
  const router = useRouter()

  const handleSubmit = async (values: PromotionFormValues) => {
    try {
      const nextPromotion = createPromotionFromForm(values)
      const currentPromotions = await listPromotions()
      const duplicateCode = currentPromotions.some(
        (promotion) =>
          promotion.code.toLowerCase() === nextPromotion.code.toLowerCase(),
      )

      if (duplicateCode) {
        toast({
          title: 'Promotion code already exists',
          description: 'Choose a different code before saving this promotion.',
          variant: 'destructive',
        })
        return
      }

      await createStoredPromotion(nextPromotion)
      toast({
        title: 'Promotion created',
        description: `${nextPromotion.code} is now available in your promotions list.`,
      })
      router.push('/admin/promotions')
    } catch (error) {
      toast({
        title: 'Unable to create promotion',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    }
  }

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <AdminPromotionEditor
        title="Create Promotion"
        description="Build a discount campaign with clear timing, usage controls, and a code your team can manage easily."
        submitLabel="Save Promotion"
        backHref="/admin/promotions"
        backLabel="Back to Promotions"
        cancelHref="/admin/promotions"
        initialValues={initialPromotionFormValues}
        onSubmit={handleSubmit}
      />
    </ProtectedRoute>
  )
}
