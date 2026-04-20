'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Archive, ArrowLeft, Boxes, PackagePlus, RotateCcw } from 'lucide-react'
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
import { toast } from '@/hooks/use-toast'

type DraftMap = Record<string, { stock: string; reorderPoint: string; location: string }>
type InventoryView = 'active' | 'archived'

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
    restoreInventoryItem,
    updateInventory,
  } = useStore()
  const [searchQuery, setSearchQuery] = useState('')
  const [activeTab, setActiveTab] = useState<InventoryView>('active')
  const [drafts, setDrafts] = useState<DraftMap>({})
  const [isRestockDialogOpen, setIsRestockDialogOpen] = useState(false)
  const [restockDraft, setRestockDraft] = useState<RestockDraft>(EMPTY_RESTOCK_DRAFT)
  const [archiveTarget, setArchiveTarget] = useState<InventoryRow | null>(null)

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        inventory.map((record) => [
          record.productId,
          {
            stock: String(record.stock),
            reorderPoint: String(record.reorderPoint),
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
  const archivedInventory = useMemo(
    () => inventoryRows.filter((row) => row.isArchived),
    [inventoryRows],
  )

  const filteredRows = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    const source = activeTab === 'active' ? activeInventory : archivedInventory

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
  }, [activeInventory, activeTab, archivedInventory, searchQuery])

  const lowStockCount = activeInventory.filter(
    (item) => item.stock > 0 && item.stock <= item.reorderPoint,
  ).length
  const outOfStockCount = activeInventory.filter((item) => item.stock === 0).length

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
                    Manage active stock, archive products safely, and keep availability in sync across POS and online sales.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <span className="rounded-full bg-amber-100 px-3 py-1 text-sm text-amber-700">
                    {lowStockCount} low stock
                  </span>
                  <span className="rounded-full bg-red-100 px-3 py-1 text-sm text-red-700">
                    {outOfStockCount} out of stock
                  </span>
                  <span className="rounded-full bg-slate-200 px-3 py-1 text-sm text-slate-700">
                    {archivedInventory.length} archived
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
            <div className="grid gap-4 md:grid-cols-4 mb-8">
              <div className="rounded-2xl border border-border bg-card p-6">
                <Boxes className="h-5 w-5 text-accent mb-4" />
                <p className="text-sm font-medium text-foreground/60">Active Products</p>
                <p className="mt-2 font-serif text-3xl text-foreground">{activeInventory.length}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="text-sm font-medium text-foreground/60">Low Stock Alerts</p>
                <p className="mt-2 font-serif text-3xl text-foreground">{lowStockCount}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="text-sm font-medium text-foreground/60">Out of Stock</p>
                <p className="mt-2 font-serif text-3xl text-foreground">{outOfStockCount}</p>
              </div>
              <div className="rounded-2xl border border-border bg-card p-6">
                <p className="text-sm font-medium text-foreground/60">Archived Items</p>
                <p className="mt-2 font-serif text-3xl text-foreground">{archivedInventory.length}</p>
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
                  <TabsTrigger value="archived">Archived ({archivedInventory.length})</TabsTrigger>
                </TabsList>

                <input
                  type="text"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder={`Search ${activeTab === 'active' ? 'active' : 'archived'} inventory...`}
                  className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent lg:max-w-sm"
                />
              </div>

              <TabsContent value="active">
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Product</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Availability</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Stock</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Reorder Point</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Location</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Last Updated</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-foreground/60">
                              No active inventory items matched your search.
                            </td>
                          </tr>
                        ) : (
                          filteredRows.map((row) => {
                            const draft = drafts[row.productId] ?? {
                              stock: String(row.stock),
                              reorderPoint: String(row.reorderPoint),
                              location: row.location,
                            }
                            const availability = getAvailabilityStatus(row.productId)
                            const tone =
                              availability === 'In Stock'
                                ? 'bg-green-100 text-green-700'
                                : availability === 'Low Stock'
                                  ? 'bg-amber-100 text-amber-700'
                                  : 'bg-red-100 text-red-700'

                            return (
                              <tr key={row.productId} className="border-b border-border last:border-0">
                                <td className="px-6 py-4 align-top">
                                  <p className="font-medium text-foreground">{row.productName}</p>
                                  <p className="text-xs text-foreground/60">
                                    {row.productBrand} - {row.sku}
                                  </p>
                                </td>
                                <td className="px-6 py-4 align-top">
                                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${tone}`}>
                                    {availability}
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
                                    className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
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
                                    className="w-24 rounded-lg border border-border bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
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
                                      <Archive className="h-4 w-4" />
                                      Archive
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

              <TabsContent value="archived">
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border">
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Product</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Status</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Stored Stock</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Reorder Point</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Location</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Archived</th>
                          <th className="px-6 py-4 text-left font-medium text-foreground/60">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={7} className="px-6 py-12 text-center text-foreground/60">
                              No archived inventory items matched your search.
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
                                  Archived
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
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="gap-2"
                                  onClick={() => handleRestore(row.productId)}
                                >
                                  <RotateCcw className="h-4 w-4" />
                                  Restore
                                </Button>
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
            <AlertDialogTitle>Archive inventory item?</AlertDialogTitle>
            <AlertDialogDescription>
              {archiveTarget
                ? `${archiveTarget.productName} will be removed from active inventory operations and become unavailable in POS and online checkout. Historical orders and reports will stay intact.`
                : 'Archive this inventory item.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleArchive}>Archive</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ProtectedRoute>
  )
}
