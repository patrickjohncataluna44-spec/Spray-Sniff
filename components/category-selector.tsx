'use client'

import { useEffect, useState, useMemo, useCallback } from 'react'
import { PlusCircle, ListFilter, Check, Sparkles, Plus, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  PRODUCT_CATEGORIES,
  getStoredCustomCategories,
  saveStoredCustomCategory,
} from '@/lib/admin-products'
import { useStore } from '@/lib/store-context'
import { subscribeToProductCategories } from '@/lib/supabase-realtime'
import { cn } from '@/lib/utils'

interface CategorySelectorProps {
  value: string
  onChange: (value: string) => void
  id?: string
  className?: string
}

export function CategorySelector({
  value,
  onChange,
  id = 'category',
  className,
}: CategorySelectorProps) {
  const { catalog } = useStore()
  const [customCategories, setCustomCategories] = useState<string[]>([])
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false)
  const [customInputValue, setCustomInputValue] = useState<string>('')
  const [isSavingCategory, setIsSavingCategory] = useState<boolean>(false)

  // Fetch persisted categories from Supabase API
  const fetchDbCategories = useCallback(async () => {
    try {
      const res = await fetch('/api/categories')
      if (res.ok) {
        const data = await res.json()
        if (Array.isArray(data.categories)) {
          const names: string[] = data.categories.map((c: { name: string }) => c.name)
          setCustomCategories((prev) => {
            const merged = Array.from(new Set([...prev, ...names]))
            return merged
          })
          return
        }
      }
    } catch (err) {
      console.warn('Failed to load categories from API, using local storage fallback', err)
    }

    // LocalStorage fallback
    setCustomCategories(getStoredCustomCategories())
  }, [])

  // Load stored and database categories on mount + subscribe to Realtime changes
  useEffect(() => {
    // Initial local cache
    setCustomCategories(getStoredCustomCategories())

    // Fetch from database
    void fetchDbCategories()

    // Subscribe to realtime database changes across all clients/staff
    const unsubscribe = subscribeToProductCategories(() => {
      void fetchDbCategories()
    })

    return () => {
      unsubscribe()
    }
  }, [fetchDbCategories])

  // Combine default categories, stored custom categories, and catalog categories
  const allCategories = useMemo(() => {
    const defaultList = Array.from(PRODUCT_CATEGORIES)
    const catalogCats = catalog ? catalog.map((p) => p.category) : []
    const combined = new Set([
      ...defaultList,
      ...customCategories,
      ...catalogCats,
    ])

    // If current value is non-empty and not in the combined list, include it
    if (value && value.trim() && !combined.has(value)) {
      combined.add(value)
    }

    return Array.from(combined).filter(Boolean)
  }, [catalog, customCategories, value])

  // Custom categories list (categories not in default PRODUCT_CATEGORIES)
  const isDefaultCategory = (cat: string) =>
    (PRODUCT_CATEGORIES as readonly string[]).includes(cat)

  // Handle adding a new custom category (persists to Supabase DB & localStorage)
  const handleAddCustomCategory = async () => {
    const trimmed = customInputValue.trim()
    if (!trimmed) return

    setIsSavingCategory(true)

    // Save locally first for instant optimistic response
    const updatedCustoms = saveStoredCustomCategory(trimmed)
    setCustomCategories(updatedCustoms)
    onChange(trimmed)
    setCustomInputValue('')
    setIsCustomMode(false)

    // Persist to Supabase product_categories table via API
    try {
      await fetch('/api/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      })
      void fetchDbCategories()
    } catch (error) {
      console.warn('Could not persist category to database, preserved in local storage', error)
    } finally {
      setIsSavingCategory(false)
    }
  }

  // Handle select change
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value
    if (val === '__NEW_CUSTOM__') {
      setIsCustomMode(true)
      setCustomInputValue('')
    } else {
      setIsCustomMode(false)
      onChange(val)
    }
  }

  // Handle category chip click
  const handleChipClick = (cat: string) => {
    setIsCustomMode(false)
    onChange(cat)
  }

  return (
    <div className={cn('space-y-2', className)}>
      {/* Top Controls: Mode Toggle */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground font-medium">
          {isCustomMode ? 'Custom Input Mode' : 'Dropdown Mode'}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {
            setIsCustomMode(!isCustomMode)
            if (!isCustomMode) {
              setCustomInputValue('')
            }
          }}
          className="h-7 text-xs gap-1 px-2 text-primary hover:text-primary/80"
        >
          {isCustomMode ? (
            <>
              <ListFilter className="w-3.5 h-3.5" />
              Switch to Select List
            </>
          ) : (
            <>
              <PlusCircle className="w-3.5 h-3.5" />
              + Add Custom Category
            </>
          )}
        </Button>
      </div>

      {/* Main Input / Select Field */}
      {isCustomMode ? (
        <div className="flex items-center gap-2">
          <Input
            id={id}
            type="text"
            value={customInputValue}
            onChange={(e) => setCustomInputValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                handleAddCustomCategory()
              }
            }}
            placeholder="Type new category name..."
            className="h-10 text-sm focus-visible:ring-2"
            autoFocus
          />
          <Button
            type="button"
            size="sm"
            onClick={handleAddCustomCategory}
            disabled={!customInputValue.trim() || isSavingCategory}
            className="h-10 px-4 gap-1.5 shrink-0"
          >
            {isSavingCategory ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Plus className="w-4 h-4" />
            )}
            Add & Select
          </Button>
        </div>
      ) : (
        <select
          id={id}
          value={value}
          onChange={handleSelectChange}
          className="w-full h-10 rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        >
          {allCategories.map((category) => (
            <option key={category} value={category}>
              {category} {!isDefaultCategory(category) ? '(Custom)' : ''}
            </option>
          ))}
          <option value="__NEW_CUSTOM__" className="font-semibold text-primary">
            + Type New Custom Category...
          </option>
        </select>
      )}

      {/* Child Category Suggestions & Added Categories Container */}
      <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span className="font-medium flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            Category Suggestions ({allCategories.length}):
          </span>
          <span className="text-[11px] text-muted-foreground/80">
            Click to select
          </span>
        </div>

        {/* Category Pills Flex Wrap */}
        <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1">
          {allCategories.map((category) => {
            const isSelected = value === category
            const isCustom = !isDefaultCategory(category)

            return (
              <Badge
                key={category}
                variant={isSelected ? 'default' : 'outline'}
                onClick={() => handleChipClick(category)}
                className={cn(
                  'cursor-pointer select-none px-2.5 py-1 text-xs transition-all flex items-center gap-1',
                  isSelected
                    ? 'bg-primary text-primary-foreground font-semibold shadow-xs ring-1 ring-primary'
                    : 'bg-background hover:bg-accent hover:text-accent-foreground border-border/80',
                )}
              >
                {isSelected && <Check className="w-3 h-3 text-current" />}
                {category}
                {isCustom && (
                  <span
                    className={cn(
                      'text-[10px] px-1 py-0.2 rounded-full font-mono',
                      isSelected
                        ? 'bg-primary-foreground/20 text-primary-foreground'
                        : 'bg-amber-500/15 text-amber-600 dark:text-amber-400',
                    )}
                  >
                    Custom
                  </span>
                )}
              </Badge>
            )
          })}
        </div>
      </div>
    </div>
  )
}
