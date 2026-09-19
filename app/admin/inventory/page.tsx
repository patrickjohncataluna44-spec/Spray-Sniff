'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Boxes, PackagePlus, RotateCcw, Trash2 } from 'lucide-react'
import { AdminSidebar } from '@/components/admin-sidebar'
import { ProtectedRoute } from '@/components/protected-route'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/lib/auth-context'
import { useStore } from '@/lib/store-context'
import {
  DEFAULT_OVERSTOCK_THRESHOLD,
  getInventoryStockHealth,
  type InventoryStockHealth,
} from '@/lib/store-engine'
import { toast } from '@/hooks/use-toast'

type DraftMap = Record<
  string,
  { stock: string; reorderPoint: string; overStockThreshold: string; location: string }
>
type InventoryView = 'active' | 'trash'
type StockHealthFilter = 'all' | 'low_stock' | 'over_stock' | 'out_of_stock'

type RestockDraft = {
  productId: string
  quantity: string
  note: string
  location: string
}

type InventoryRow = {
  productId: string
  productName: string
  productBrand: string
  productCategory: string
  sku: string
  stock: number
  reorderPoint: number
  overStockThreshold: number
  location: string
  lastUpdated: string
  lastUpdatedBy?: string
  isArchived: boolean
  archivedAt?: string
  archivedBy?: string
}

const EMPTY_RESTOCK_DRAFT: RestockDraft = {
  productId: '',
  quantity: '1',
  note: '',
  location: '',
}

function formatDateTime(value?: string) {
  if (!value) {
    return 'Not recorded'
  }

  return new Date(value).toLocaleString('en-PH', {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}

export default function InventoryPage() {
  const { user } = useAuth()
  const {
    adjustInventory,
    archiveInventoryItem,
    catalog,
    getAvailabilityStatus,
    inventory,
    removeCatalogProduct,
    restoreInventoryItem,
    updateInventory,
  } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<InventoryView>('active')
  const [stockHealthFilter, setStockHealthFilter] = useState<StockHealthFilter>('all')
  const [drafts, setDrafts] = useState<DraftMap>({})
  const [isRestockDialogOpen, setIsRestockDialogOpen] = useState(false)
  const [restockDraft, setRestockDraft] = useState<RestockDraft>(EMPTY_RESTOCK_DRAFT)
  const [archiveTarget, setArchiveTarget] = useState<InventoryRow | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<InventoryRow | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const f = params.get('filter')
      if (f === 'low_stock' || f === 'over_stock' || f === 'out_of_stock') {
        setStockHealthFilter(f)
      }
    }
  }, [])

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        inventory.map((record) => [
          record.productId,
          {
            stock: String(record.stock),
            reorderPoint: String(record.reorderPoint),
            overStockThreshold: String(record.overStockThreshold ?? DEFAULT_OVERSTOCK_THRESHOLD),
            location: record.location,
          },
        ]),
      ),
    )
  }, [inventory])

  const inventoryRows = useMemo<InventoryRow[]>(() => {
    return inventory
      .reduce<InventoryRow[]>((rows, record) => {
        const product = catalog.find((item) => item.id === record.productId)

        if (!product) {
          return rows
        }

        rows.push({
          productId: product.id,
          productName: product.name,
          productBrand: product.brand,
          productCategory: product.category,
          sku: record.sku,
          stock: record.stock,
          reorderPoint: record.reorderPoint,
          overStockThreshold: record.overStockThreshold ?? DEFAULT_OVERSTOCK_THRESHOLD,
          location: record.location,
          lastUpdated: record.lastUpdated,
          lastUpdatedBy: record.lastUpdatedBy,
          isArchived: record.isArchived,
          archivedAt: record.archivedAt,
          archivedBy: record.archivedBy,
        })

        return rows
      }, [])
      .sort((left, right) => left.productName.localeCompare(right.productName))
  }, [catalog, inventory])

  const activeInventory = useMemo(
    () => inventoryRows.filter((row) => !row.isArchived),
    [inventoryRows],
  )
  const trashedInventory = useMemo(
    () => inventoryRows.filter((row) => row.isArchived),
    [inventoryRows],
  )

  const lowStockCount = activeInventory.filter(
    (item) => item.stock > 0 && item.stock <= item.reorderPoint,
  ).length
  const overStockCount = activeInventory.filter(
    (item) => item.stock >= (item.overStockThreshold || DEFAULT_OVERSTOCK_THRESHOLD),
  ).length
  const outOfStockCount = activeInventory.filter((item) => item.stock === 0).length

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    let source = activeTab === 'active' ? activeInventory : trashedInventory

    if (activeTab === 'active' && stockHealthFilter !== 'all') {
      source = source.filter((row) => {
        const health = getInventoryStockHealth(
          row.stock,
          row.reorderPoint,
          row.overStockThreshold,
          row.isArchived,
        )
        return health === stockHealthFilter
      })
    }

    if (!query) {
      return source
    }

    return source.filter((row) =>
      [
        row.productName,
        row.productBrand,
        row.productCategory,
        row.sku,
        row.location,
      ].some((value) => value.toLowerCase().includes(query)),
    )
  }, [activeInventory, activeTab, searchQuery, stockHealthFilter, trashedInventory])

  useEffect(() => {
    if (!isRestockDialogOpen) {
      return
    }

    setRestockDraft((current) => {
      if (
        current.productId &&
        activeInventory.some((item) => item.productId === current.productId)
      ) {
        return current
      }

      return {
        ...current,
        productId: activeInventory[0]?.productId ?? '',
      }
    })
  }, [activeInventory, isRestockDialogOpen])

  const handleDraftChange = (
    productId: string,
    field: keyof DraftMap[string],
    value: string,
  ) => {
    setDrafts((current) => ({
      ...current,
      [productId]: {
        ...(current[productId] ?? {
          stock: '0',
          reorderPoint: '0',
          overStockThreshold: String(DEFAULT_OVERSTOCK_THRESHOLD),
          location: '',
        }),
        [field]: value,
      },
    }))
  }

  const handleSave = async (productId: string) => {
    const draft = drafts[productId]
    if (!draft) {
      return
    }

    const result = await updateInventory({
      productId,
      stock: Number(draft.stock),
      reorderPoint: Number(draft.reorderPoint),
      overStockThreshold: Number(draft.overStockThreshold || DEFAULT_OVERSTOCK_THRESHOLD),
      location: draft.location,
      actor: user?.name || 'Store team',
      note: 'Inventory updated from the inventory workspace.',
    })

    toast({
      title: result.ok ? 'Inventory updated' : 'Unable to update inventory',
      description: result.message,
      variant: result.ok ? 'default' : 'destructive',
    })
  }

  const openRestockDialog = () => {
    setRestockDraft({
      productId: activeInventory[0]?.productId ?? '',
      quantity: '1',
      note: '',
      location: '',
    })
    setIsRestockDialogOpen(true)
  }

  const handleRestockSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const quantity = Number(restockDraft.quantity)

    if (!restockDraft.productId) {
      toast({
        title: 'Select a product',
        description: 'Choose an active inventory item to restock.',
        variant: 'destructive',
      })
      return
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      toast({
        title: 'Invalid quantity',
        description: 'Enter a stock quantity greater than zero.',
        variant: 'destructive',
      })
      return
    }

    const result = await adjustInventory({
      productId: restockDraft.productId,
      delta: quantity,
      actor: user?.name || 'Store team',
      note: restockDraft.note || 'Restocked from the inventory workspace.',
      location: restockDraft.location.trim() || undefined,
    })

    toast({
      title: result.ok ? 'Stock added' : 'Unable to add stock',
      description: result.message,
      variant: result.ok ? 'default' : 'destructive',
    })

    if (result.ok) {
      setIsRestockDialogOpen(false)
      setRestockDraft(EMPTY_RESTOCK_DRAFT)
    }
  }

  const handleArchive = async () => {
    if (!archiveTarget) {
      return
    }

    const result = await archiveInventoryItem({
      productId: archiveTarget.productId,
      actor: user?.name || 'Store team',
      note: 'Removed from active inventory operations.',
    })

    toast({
      title: result.ok ? 'Item archived' : 'Unable to archive item',
      description: result.message,
      variant: result.ok ? 'default' : 'destructive',
    })

    if (result.ok) {
      setArchiveTarget(null)
    }
  }

  const handleRestore = async (productId: string) => {
    const result = await restoreInventoryItem({
      productId,
      actor: user?.name || 'Store team',
    })

    toast({
      title: result.ok ? 'Item restored' : 'Unable to restore item',
      description: result.message,
      variant: result.ok ? 'default' : 'destructive',
    })
  }

  const handlePermanentDelete = async () => {
    if (!deleteTarget) {
      return
    }

    const result = await removeCatalogProduct(deleteTarget.productId)

    toast({
      title: result.ok ? 'Item deleted' : 'Unable to delete item',
      description: result.message,
      variant: result.ok ? 'default' : 'destructive',
    })

    if (result.ok) {
      setDeleteTarget(null)
    }
  }

  return (
    <ProtectedRoute requiredRole={['ADMIN', 'STAFF']}>
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <div className="flex-1">
          <div className="border-b border-border bg-card">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
              <div className="flex items-center gap-4 mb-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin/dashboard" className="flex items-center gap-2">
                    <ArrowLeft className="w-4 h-4" />
                    Back
                  </Link>
                </Button>
              </div>

              <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <h1 className="font-serif text-3xl text-foreground">Inventory</h1>
                  <p className="mt-2 text-sm text-foreground/60">
                    Manage active stock, move products to trash safely, and restore them later when needed.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-700">
                    {lowStockCount} low stock
                  </span>
                  <span className="rounded-full bg-purple-100 px-3 py-1 text-sm text-purple-700">
                    {overStockCount} overstocked
                  </span>
                  <span className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-700">
                    {outOfStockCount} out of stock
                  </span>
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-sm text-slate-700">
                    {trashedInventory.length} in trash
                  </span>
                  <Button
                    onClick={openRestockDialog}
                    disabled={activeInventory.length === 0}
                    className="gap-2"
                  >
                    <PackagePlus className="h-4 w-4" />
                    Add Stock
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5 mb-8">
              <button
                type="button"
                onClick={() => setStockHealthFilter('all')}
                className={`rounded-2xl border p-6 text-left transition-all ${
                  stockHealthFilter === 'all'
                    ? 'border-primary bg-primary/5 ring-2 ring-primary'
                    : 'border-border bg-card hover:border-border/80'
                }`}
              >
                <Boxes className="h-5 w-5 text-accent mb-4" />
                <p className="text-sm font-medium text-foreground/60">Active Products</p>
                <p className="mt-2 font-serif text-3xl text-foreground">{activeInventory.length}</p>
              </button>
              <button
                type="button"
                onClick={() => setStockHealthFilter('low_stock')}
                className={`rounded-2xl border p-6 text-left transition-all ${
                  stockHealthFilter === 'low_stock'
                    ? 'border-amber-500 bg-amber-500/10 ring-2 ring-amber-500'
                    : 'border-border bg-card hover:border-amber-300'
                }`}
              >
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400">⚠️ Low Stock Alerts</p>
                <p className="mt-2 font-serif text-3xl text-amber-700 dark:text-amber-400">{lowStockCount}</p>
                <p className="mt-1 text-[11px] text-foreground/50">Stock ≤ Reorder Point</p>
              </button>
              <button
                type="button"
                onClick={() => setStockHealthFilter('over_stock')}
                className={`rounded-2xl border p-6 text-left transition-all ${
                  stockHealthFilter === 'over_stock'
                    ? 'border-purple-500 bg-purple-500/10 ring-2 ring-purple-500'
                    : 'border-border bg-card hover:border-purple-300'
                }`}
              >
                <p className="text-sm font-medium text-purple-700 dark:text-purple-400">📦 Over Stock Alerts</p>
                <p className="mt-2 font-serif text-3xl text-purple-700 dark:text-purple-400">{overStockCount}</p>
                <p className="mt-1 text-[11px] text-foreground/50">Stock ≥ Max Threshold</p>
              </button>
              <button
                type="button"
                onClick={() => setStockHealthFilter('out_of_stock')}
                className={`rounded-2xl border p-6 text-left transition-all ${
                  stockHealthFilter === 'out_of_stock'
                    ? 'border-rose-500 bg-rose-500/10 ring-2 ring-rose-500'
                    : 'border-border bg-card hover:border-rose-300'
                }`}
              >
                <p className="text-sm font-medium text-rose-700 dark:text-rose-400">🚫 Out of Stock</p>
                <p className="mt-2 font-serif text-3xl text-rose-700 dark:text-rose-400">{outOfStockCount}</p>
                <p className="mt-1 text-[11px] text-foreground/50">0 units available</p>
              </button>
              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="text-sm font-medium text-foreground/60">Trash Items</p>
                <p className="mt-2 font-serif text-3xl text-foreground">{trashedInventory.length}</p>
                <p className="mt-1 text-[11px] text-foreground/50">Archived items</p>
              </div>
            </div>

            <Tabs
              value={activeTab}
              onValueChange={(value) => setActiveTab(value as InventoryView)}
              className="gap-6"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <TabsList>
                  <TabsTrigger value="active">Active Inventory ({activeInventory.length})</TabsTrigger>
                  <TabsTrigger value="trash">Trash ({trashedInventory.length})</TabsTrigger>
                </TabsList>

                <div className="flex flex-wrap items-center gap-2">
                  {activeTab === 'active' && (
                    <div className="flex items-center gap-1.5 rounded-xl border border-border bg-background p-1 text-xs">
                      <button
                        type="button"
                        onClick={() => setStockHealthFilter('all')}
                        className={`rounded-lg px-2.5 py-1.5 font-medium transition ${
                          stockHealthFilter === 'all'
                            ? 'bg-primary text-primary-foreground'
                            : 'text-foreground/70 hover:text-foreground'
                        }`}
                      >
                        All ({activeInventory.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStockHealthFilter('low_stock')}
                        className={`rounded-lg px-2.5 py-1.5 font-medium transition ${
                          stockHealthFilter === 'low_stock'
                            ? 'bg-amber-500 text-white'
                            : 'text-amber-700 hover:bg-amber-50'
                        }`}
                      >
                        Low ({lowStockCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStockHealthFilter('over_stock')}
                        className={`rounded-lg px-2.5 py-1.5 font-medium transition ${
                          stockHealthFilter === 'over_stock'
                            ? 'bg-purple-600 text-white'
                            : 'text-purple-700 hover:bg-purple-50'
                        }`}
                      >
                        Over ({overStockCount})
                      </button>
                      <button
                        type="button"
                        onClick={() => setStockHealthFilter('out_of_stock')}
                        className={`rounded-lg px-2.5 py-1.5 font-medium transition ${
                          stockHealthFilter === 'out_of_stock'
                            ? 'bg-rose-600 text-white'
                            : 'text-rose-700 hover:bg-rose-50'
                        }`}
                      >
                        Empty ({outOfStockCount})
                      </button>
                    </div>
                  )}

                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder={`Search ${activeTab === 'active' ? 'active' : 'trash'} inventory...`}
                    className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent lg:w-72"
                  />
                </div>
              </div>

              <TabsContent value="active">
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Product</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Stock Status Alert</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Stock</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Reorder Point</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Max (Overstock)</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Location</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Last Updated</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} className="px-6 py-12 text-center text-foreground/60">
                              No active inventory items matched your filter or search.
                            </td>
                          </tr>
                        ) : (
                          filteredRows.map((row) => {
                            const draft = drafts[row.productId] ?? {
                              stock: String(row.stock),
                              reorderPoint: String(row.reorderPoint),
                              overStockThreshold: String(row.overStockThreshold ?? DEFAULT_OVERSTOCK_THRESHOLD),
                              location: row.location,
                            }
                            const health = getInventoryStockHealth(
                              row.stock,
                              row.reorderPoint,
                              row.overStockThreshold,
                              row.isArchived,
                            )
                            const badgeLabel =
                              health === 'over_stock'
                                ? `Over Stock (${row.stock} units)`
                                : health === 'low_stock'
                                  ? `Low Stock (${row.stock} left)`
                                  : health === 'out_of_stock'
                                    ? 'Out of Stock'
                                    : 'In Stock'
                            const badgeTone =
                              health === 'over_stock'
                                ? 'bg-purple-100 text-purple-700 font-bold border border-purple-200'
                                : health === 'low_stock'
                                  ? 'bg-amber-100 text-amber-800 font-bold border border-amber-200'
                                  : health === 'out_of_stock'
                                    ? 'bg-rose-100 text-rose-700 font-bold border border-rose-200'
                                    : 'bg-emerald-100 text-emerald-700'

                            return (
                              <tr key={row.productId} className="border-b border-border last:border-0">
                                <td className="px-6 py-4 align-top">
                                  <p className="font-medium text-foreground">{row.productName}</p>
                                  <p className="text-xs text-foreground/60">
                                    {row.productBrand} - {row.sku}
                                  </p>
                                </td>
                                <td className="px-6 py-4 align-top">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs ${badgeTone}`}>
                                    {badgeLabel}
                                  </span>
                                </td>
                                <td className="px-6 py-4 align-top">
                                  <input
                                    type="number"
                                    min="0"
                                    value={draft.stock}
                                    onChange={(event) =>
                                      handleDraftChange(row.productId, 'stock', event.target.value)
                                    }
                                    className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                                  />
                                </td>
                                <td className="px-6 py-4 align-top">
                                  <input
                                    type="number"
                                    min="0"
                                    value={draft.reorderPoint}
                                    onChange={(event) =>
                                      handleDraftChange(row.productId, 'reorderPoint', event.target.value)
                                    }
                                    className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                                  />
                                </td>
                                <td className="px-6 py-4 align-top">
                                  <input
                                    type="number"
                                    min="1"
                                    value={draft.overStockThreshold}
                                    onChange={(event) =>
                                      handleDraftChange(row.productId, 'overStockThreshold', event.target.value)
                                    }
                                    className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                                  />
                                </td>
                                <td className="px-6 py-4 align-top">
                                  <input
                                    type="text"
                                    value={draft.location}
                                    onChange={(event) =>
                                      handleDraftChange(row.productId, 'location', event.target.value)
                                    }
                                    className="w-28 rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                                  />
                                </td>
                                <td className="px-6 py-4 align-top text-foreground/60">
                                  <p>{formatDateTime(row.lastUpdated)}</p>
                                  <p className="text-xs">
                                    {row.lastUpdatedBy || 'Store team'}
                                  </p>
                                </td>
                                <td className="px-6 py-4 align-top">
                                  <div className="flex flex-wrap gap-2">
                                    <Button size="sm" onClick={() => handleSave(row.productId)}>
                                      Save
                                    </Button>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="gap-2 text-slate-700"
                                      onClick={() => setArchiveTarget(row)}
                                    >
                                      <Trash2 className="h-4 w-4" />
                                      Move to Trash
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            )
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="trash">
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="border-b border-border bg-muted/30 px-6 py-4 text-sm text-foreground/65">
                    Trashed products stay here until you restore them. Use <span className="font-semibold text-foreground">Restore</span> to bring an item back, or <span className="font-semibold text-foreground">Delete Permanently</span> to remove it for good.
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Product</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Status</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Stored Stock</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Reorder Point</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Location</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Moved to Trash</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-foreground/60">
                              No trashed inventory items matched your search.
                            </td>
                          </tr>
                        ) : (
                          filteredRows.map((row) => (
                            <tr key={row.productId} className="border-b border-border last:border-0">
                              <td className="px-6 py-4 align-top">
                                <p className="font-medium text-foreground">{row.productName}</p>
                                <p className="text-xs text-foreground/60">
                                  {row.productBrand} - {row.sku}
                                </p>
                              </td>
                              <td className="px-6 py-4 align-top">
                                <span className="rounded-full bg-slate-200 px-3 py-1 text-xs font-semibold text-slate-700">
                                  In Trash
                                </span>
                              </td>
                              <td className="px-6 py-4 align-top text-foreground">{row.stock}</td>
                              <td className="px-6 py-4 align-top text-foreground">{row.reorderPoint}</td>
                              <td className="px-6 py-4 align-top text-foreground">{row.location}</td>
                              <td className="px-6 py-4 align-top text-foreground/60">
                                <p>{formatDateTime(row.archivedAt)}</p>
                                <p className="text-xs">{row.archivedBy || 'Store team'}</p>
                              </td>
                              <td className="px-6 py-4 align-top">
                                <div className="flex flex-wrap gap-2">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-2"
                                    onClick={() => handleRestore(row.productId)}
                                  >
                                    <RotateCcw className="h-4 w-4" />
                                    Restore
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="gap-2 text-red-600"
                                    onClick={() => setDeleteTarget(row)}
                                  >
                                    <Trash2 className="h-4 w-4" />
                                    Delete Permanently
                                  </Button>
                                </div>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      <Dialog open={isRestockDialogOpen} onOpenChange={setIsRestockDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Stock</DialogTitle>
            <DialogDescription>
              Restock an active inventory item and log the movement in the stock history.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleRestockSubmit} className="space-y-5">
            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Product</label>
              <select
                value={restockDraft.productId}
                onChange={(event) =>
                  setRestockDraft((current) => ({
                    ...current,
                    productId: event.target.value,
                  }))
                }
                className="rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              >
                {activeInventory.map((row) => (
                  <option key={row.productId} value={row.productId}>
                    {row.productName} ({row.sku})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Quantity to Add</label>
              <input
                type="number"
                min="1"
                value={restockDraft.quantity}
                onChange={(event) =>
                  setRestockDraft((current) => ({
                    ...current,
                    quantity: event.target.value,
                  }))
                }
                className="rounded-lg border border-border bg-background px-4 py-3 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            {(() => {
              const targetRow = activeInventory.find((r) => r.productId === restockDraft.productId)
              if (!targetRow) return null
              const addQty = Number(restockDraft.quantity) || 0
              const futureStock = targetRow.stock + addQty
              const isOver = futureStock >= targetRow.overStockThreshold
              return (
                <div className={`rounded-xl p-3 text-xs border ${
                  isOver ? 'border-purple-300 bg-purple-50 text-purple-900 font-medium' : 'border-border bg-muted/40 text-foreground/75'
                }`}>
                  <p>Current stock: <strong>{targetRow.stock}</strong> units → After restock: <strong>{futureStock}</strong> units (Overstock threshold: {targetRow.overStockThreshold})</p>
                  {isOver && (
                    <p className="mt-1 font-bold text-purple-700">
                      📦 Overstock Alert: Restocking this amount will flag this item as Overstocked.
                    </p>
                  )}
                </div>
              )
            })()}

            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Location Override</label>
              <input
                type="text"
                value={restockDraft.location}
                onChange={(event) =>
                  setRestockDraft((current) => ({
                    ...current,
                    location: event.target.value,
                  }))
                }
                placeholder="Optional shelf/bin update"
                className="rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <div className="grid gap-2">
              <label className="text-sm font-medium text-foreground">Note</label>
              <textarea
                value={restockDraft.note}
                onChange={(event) =>
                  setRestockDraft((current) => ({
                    ...current,
                    note: event.target.value,
                  }))
                }
                placeholder="Optional restock note"
                className="min-h-24 rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent"
              />
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsRestockDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Add Stock</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={Boolean(archiveTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setArchiveTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move item to trash?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget
                ? `${archiveTarget.productName} will be moved to trash, removed from active inventory operations, and become unavailable in POS and online checkout. You can restore it later from the Trash tab. Historical orders and reports will stay intact.`
                : 'Move this inventory item to trash.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Move to Trash</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={Boolean(deleteTarget)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteTarget(null)
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete item permanently?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget
                ? `${deleteTarget.productName} will be removed permanently from the catalog and inventory. This cannot be undone from the Trash tab.`
                : 'Delete this inventory item permanently.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handlePermanentDelete}>Delete Permanently</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  )
}
