'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Edit, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProtectedRoute } from '@/components/protected-route'
import { useAuth } from '@/lib/auth-context'
import { formatPHP } from '@/lib/currency'
import { PRODUCT_CATEGORIES } from '@/lib/admin-products'
import type { Product } from '@/lib/products'
import { useStore } from '@/lib/store-context'
import { toast } from '@/hooks/use-toast'

const ALL_CATEGORIES = 'All Categories'

export default function AdminProductsPage() {
  const { isAdmin, user } = useAuth()
  const { catalog, getAvailableStock, getAvailabilityStatus, removeCatalogProduct } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState(ALL_CATEGORIES)

  const categoryOptions = useMemo(() => {
    const uniqueCategories = new Set([
      ...PRODUCT_CATEGORIES,
      ...catalog.map((product) => product.category),
    ])

    return [ALL_CATEGORIES, ...Array.from(uniqueCategories)]
  }, [catalog])

  const filteredProducts = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    return catalog.filter((product) => {
      const matchesSearch =
        normalizedQuery.length === 0 ||
        product.name.toLowerCase().includes(normalizedQuery) ||
        product.brand.toLowerCase().includes(normalizedQuery) ||
        product.category.toLowerCase().includes(normalizedQuery)

      const matchesCategory =
        selectedCategory === ALL_CATEGORIES ||
        product.category === selectedCategory

      return matchesSearch && matchesCategory
    })
  }, [catalog, searchQuery, selectedCategory])

  const handleDelete = async (product: Product) => {
    const shouldDelete = window.confirm(
      `Remove "${product.name}" from the catalog?`,
    )

    if (!shouldDelete) {
      return
    }

    const result = await removeCatalogProduct(product.id)

    toast({
      title: result.ok ? 'Product removed' : 'Unable to remove product',
      description: result.message,
      variant: result.ok ? 'default' : 'destructive',
    })
  }

  return (
    <ProtectedRoute requiredRole={['ADMIN', 'STAFF']}>
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
                  Products
                </h1>
                <p className="mt-2 text-sm text-foreground/60">
                  {isAdmin
                    ? 'Manage the catalog your storefront, inventory workspace, and POS terminal all share.'
                    : 'Review the live catalog and stock status used by storefront, inventory, and POS.'}
                </p>
                <p className="mt-2 text-xs uppercase tracking-[0.2em] text-foreground/45">
                  Signed in as {user?.role === 'STAFF' ? 'staff' : 'admin'}
                </p>
                {!isAdmin && (
                  <p className="mt-2 text-xs text-foreground/55">
                    Staff can monitor product availability here. Catalog creation and removal are admin-only.
                  </p>
                )}
              </div>

              {isAdmin ? (
                <Button asChild>
                  <Link href="/admin/products/new">
                    <Plus className="mr-2 h-4 w-4" />
                    Add Product
                  </Link>
                </Button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-6 flex flex-col gap-4 sm:flex-row">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search products by name, brand, or category..."
              className="flex-1 rounded-lg border border-border bg-background px-4 py-2 text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent"
            />

            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="rounded-lg border border-border bg-background px-4 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {categoryOptions.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>

          <div className="overflow-hidden rounded-lg border border-border bg-card">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-6 py-4 text-left font-medium text-foreground/60">
                      Product
                    </th>
                    <th className="px-6 py-4 text-left font-medium text-foreground/60">
                      Category
                    </th>
                    <th className="px-6 py-4 text-left font-medium text-foreground/60">
                      Price
                    </th>
                    <th className="px-6 py-4 text-left font-medium text-foreground/60">
                      Stock
                    </th>
                    <th className="px-6 py-4 text-left font-medium text-foreground/60">
                      Status
                    </th>
                    <th className="px-6 py-4 text-right font-medium text-foreground/60">
                      Actions
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {filteredProducts.length > 0 ? (
                    filteredProducts.map((product) => (
                      <tr
                        key={product.id}
                        className="border-b border-border last:border-0 hover:bg-muted/50"
                      >
                        <td className="px-6 py-4">
                          <p className="font-medium text-foreground">
                            {product.name}
                          </p>
                          <p className="text-xs text-foreground/60">
                            {product.brand}
                          </p>
                        </td>
                        <td className="px-6 py-4 text-foreground">
                          {product.category}
                        </td>
                        <td className="px-6 py-4 font-medium text-foreground">
                          {formatPHP(product.price)}
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-sm font-medium text-foreground">
                            {getAvailableStock(product.id)} on hand
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              getAvailabilityStatus(product.id) === 'In Stock'
                                ? 'bg-green-100 text-green-700'
                                : getAvailabilityStatus(product.id) === 'Low Stock'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'
                            }`}
                          >
                            {getAvailabilityStatus(product.id)}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                            {isAdmin ? (
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                asChild
                                className="text-foreground/60 hover:text-foreground"
                              >
                                <Link
                                  href={`/admin/products/${product.id}`}
                                  aria-label={`Edit ${product.name}`}
                                  title={`Edit ${product.name}`}
                                >
                                  <Edit className="h-4 w-4" />
                                </Link>
                              </Button>
                            ) : (
                              <button
                                type="button"
                                disabled
                                className="rounded-lg p-2 text-foreground/40"
                                title="Only admins can edit products."
                                aria-label={`Edit ${product.name}`}
                              >
                                <Edit className="h-4 w-4" />
                              </button>
                            )}
                            {isAdmin ? (
                              <button
                                type="button"
                                onClick={() => handleDelete(product)}
                                className="rounded-lg p-2 text-destructive transition-colors hover:bg-destructive/10"
                                aria-label={`Delete ${product.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-6 py-12 text-center text-foreground/60"
                      >
                        No products match your current filters.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 flex items-center justify-between text-sm">
            <p className="text-foreground/60">
              Showing {filteredProducts.length} of {catalog.length} products
            </p>

            <div className="flex gap-2">
              <button className="rounded border border-border px-3 py-2 text-foreground transition-colors hover:bg-muted">
                Previous
              </button>
              <button className="rounded bg-accent px-3 py-2 text-accent-foreground">
                1
              </button>
              <button className="rounded border border-border px-3 py-2 text-foreground transition-colors hover:bg-muted">
                Next
              </button>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
