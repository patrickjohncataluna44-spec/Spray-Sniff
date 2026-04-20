'use client'

import Link from 'next/link'
import { useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import { AdminProductEditor } from '@/components/admin-product-editor'
import { AdminSidebar } from '@/components/admin-sidebar'
import { ProtectedRoute } from '@/components/protected-route'
import { Button } from '@/components/ui/button'
import { toast } from '@/hooks/use-toast'
import { useAuth } from '@/lib/auth-context'
import {
  productFormValuesFromProduct,
  updateProductFromForm,
  type ProductFormValues,
} from '@/lib/admin-products'
import { useStore } from '@/lib/store-context'

export default function EditProductPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useAuth()
  const { getInventoryRecord, getProductById, updateCatalogProduct } = useStore()

  const productId = decodeURIComponent(
    Array.isArray(params.id) ? params.id[0] ?? '' : params.id ?? '',
  )
  const product = getProductById(productId)
  const inventoryRecord = getInventoryRecord(productId)
  const initialValues = useMemo(() => {
    if (!product) {
      return null
    }

    return productFormValuesFromProduct(product, inventoryRecord ?? null)
  }, [inventoryRecord, product])

  const handleSubmit = async (values: ProductFormValues) => {
    if (!product) {
      toast({
        title: 'Product not found',
        description: 'This product is no longer available to edit.',
        variant: 'destructive',
      })
      return
    }

    const updatedProduct = updateProductFromForm(product, values)
    const result = await updateCatalogProduct(product.id, updatedProduct, {
      stock: Number(values.stockQuantity),
      reorderPoint: Number(values.reorderPoint),
      location: values.storageLocation.trim(),
      actor: user?.name || 'Store admin',
    })

    toast({
      title: result.ok ? 'Product updated' : 'Unable to update product',
      description: result.message,
      variant: result.ok ? 'default' : 'destructive',
    })

    if (result.ok) {
      router.push('/admin/products')
    }
  }

  if (!product || !initialValues) {
    return (
      <ProtectedRoute requiredRole="ADMIN">
        <div className="flex min-h-screen bg-background">
          <AdminSidebar />

          <div className="flex-1">
            <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/products" className="flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  Back to Products
                </Link>
              </Button>

              <div className="mt-6 rounded-3xl border border-border bg-card p-8 shadow-sm">
                <h1 className="font-serif text-3xl text-foreground">
                  Product not found
                </h1>
                <p className="mt-3 max-w-2xl text-sm text-foreground/65">
                  The item you tried to edit could not be loaded. It may have been
                  removed from the catalog already.
                </p>
              </div>
            </div>
          </div>
        </div>
      </ProtectedRoute>
    )
  }

  return (
    <AdminProductEditor
      backHref="/admin/products"
      backLabel="Back to Products"
      cancelHref="/admin/products"
      description="Update the fragrance details, stock levels, and merchandising settings used across the storefront, inventory workspace, and POS."
      initialValues={initialValues}
      signedInName={user?.name || 'Store admin'}
      signedInRole={user?.role}
      submitLabel="Save Changes"
      title={`Edit ${product.name}`}
      onSubmit={handleSubmit}
    />
  )
}
