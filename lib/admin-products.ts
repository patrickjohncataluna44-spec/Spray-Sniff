import type { Product } from '@/lib/products'
import { products } from '@/lib/products'
import { SITE_NAME } from '@/lib/site'

export const ADMIN_PRODUCTS_STORAGE_KEY = 'admin-products'
export const CUSTOM_CATEGORIES_STORAGE_KEY = 'custom-product-categories'

export const PRODUCT_CATEGORIES = [
  'Bath & Body Works',
  'Victoria\'s Secret',
  'Katy Perry',
  'Nicki Minaj',
  'Britney Spears',
  'Sarah Jessica Parker',
  'Kim Kardashian',
  'Mardussia',
  'Charlie',
] as const

export function getStoredCustomCategories(): string[] {
  if (typeof window === 'undefined') {
    return []
  }
  try {
    const raw = window.localStorage.getItem(CUSTOM_CATEGORIES_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveStoredCustomCategory(category: string): string[] {
  if (typeof window === 'undefined') return []
  const trimmed = category.trim()
  if (!trimmed) return getStoredCustomCategories()

  const existing = getStoredCustomCategories()
  const isDefault = (PRODUCT_CATEGORIES as readonly string[]).some(
    (c) => c.toLowerCase() === trimmed.toLowerCase(),
  )
  if (!isDefault && !existing.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
    const next = [...existing, trimmed]
    window.localStorage.setItem(
      CUSTOM_CATEGORIES_STORAGE_KEY,
      JSON.stringify(next),
    )
    return next
  }
  return existing
}

export function removeStoredCustomCategory(category: string): string[] {
  if (typeof window === 'undefined') return []
  const trimmed = category.trim().toLowerCase()
  if (!trimmed) return getStoredCustomCategories()

  const existing = getStoredCustomCategories()
  const next = existing.filter((c) => c.trim().toLowerCase() !== trimmed)
  window.localStorage.setItem(
    CUSTOM_CATEGORIES_STORAGE_KEY,
    JSON.stringify(next),
  )
  return next
}

export interface ProductFormValues {
  name: string
  brand: string
  description: string
  category: string
  gender: Product['gender']
  price: string
  salePrice: string
  originalPrice?: string
  sizeMl: string
  scentFamily: string
  topNotes: string
  middleNotes: string
  baseNotes: string
  occasions: string
  seasons: string
  uploadedImage: string
  featured: boolean
  isNewArrival: boolean
  inStock: boolean
  stockQuantity: string
  reorderPoint: string
  storageLocation: string
}

export interface ProductInventorySnapshot {
  stock: number
  reorderPoint: number
  location: string
}

export const initialProductFormValues: ProductFormValues = {
  name: '',
  brand: SITE_NAME,
  description: '',
  category: PRODUCT_CATEGORIES[0],
  gender: 'unisex',
  price: '',
  salePrice: '',
  originalPrice: '',
  sizeMl: '50',
  scentFamily: '',
  topNotes: '',
  middleNotes: '',
  baseNotes: '',
  occasions: 'Day, Evening',
  seasons: 'All Seasons',
  uploadedImage: '',
  featured: false,
  isNewArrival: true,
  inStock: true,
  stockQuantity: '12',
  reorderPoint: '3',
  storageLocation: 'A1-01',
}

function parseList(value: string, fallback: string[]): string[] {
  const parsed = value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)

  return parsed.length > 0 ? parsed : fallback
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

export function getStoredAdminProducts(): Product[] {
  if (typeof window === 'undefined') {
    return products
  }

  try {
    const storedProducts = window.localStorage.getItem(ADMIN_PRODUCTS_STORAGE_KEY)

    if (!storedProducts) {
      return products
    }

    const parsedProducts = JSON.parse(storedProducts)
    return Array.isArray(parsedProducts) ? parsedProducts : products
  } catch {
    return products
  }
}

export function saveStoredAdminProducts(nextProducts: Product[]) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(
    ADMIN_PRODUCTS_STORAGE_KEY,
    JSON.stringify(nextProducts),
  )
}

export function resolvePricing(values: ProductFormValues): {
  price: number
  originalPrice?: number
} {
  const regularPrice = Number(values.price)
  const rawSale = values.salePrice?.trim()
  let saleNumber = rawSale ? Number(rawSale) : NaN

  // If salePrice wasn't provided, check legacy originalPrice
  if (!Number.isFinite(saleNumber) && values.originalPrice?.trim()) {
    const legacyOrig = Number(values.originalPrice)
    if (Number.isFinite(legacyOrig) && legacyOrig > regularPrice) {
      saleNumber = regularPrice
      return {
        price: saleNumber,
        originalPrice: legacyOrig,
      }
    }
  }

  // If salePrice is valid and lower than regularPrice, apply sale
  if (
    Number.isFinite(saleNumber) &&
    saleNumber > 0 &&
    Number.isFinite(regularPrice) &&
    regularPrice > 0 &&
    saleNumber < regularPrice
  ) {
    return {
      price: saleNumber,
      originalPrice: regularPrice,
    }
  }

  return {
    price: regularPrice,
    originalPrice: undefined,
  }
}

export function createProductFromForm(values: ProductFormValues): Product {
  const { price, originalPrice } = resolvePricing(values)
  const sizeMl = Number(values.sizeMl)
  const timestamp = Date.now()
  const slugBase = slugify(values.name) || `product-${timestamp}`

  return {
    id: `${slugBase}-${timestamp}`,
    name: values.name.trim(),
    brand: values.brand.trim(),
    description: values.description.trim(),
    price,
    originalPrice,
    category: values.category,
    scentFamily: parseList(values.scentFamily, ['Signature']),
    gender: values.gender,
    topNotes: parseList(values.topNotes, ['Signature Opening']),
    middleNotes: parseList(values.middleNotes, ['Heart Accord']),
    baseNotes: parseList(values.baseNotes, ['Soft Musk']),
    longevity: 4,
    intensity: 3,
    sizes: [
      {
        ml: sizeMl,
        price,
      },
    ],
    images: [values.uploadedImage.trim() || '/placeholder.jpg'],
    rating: 5,
    reviewCount: 0,
    inStock: values.inStock,
    featured: values.featured,
    isNewArrival: values.isNewArrival,
    occasions: parseList(values.occasions, ['Day']),
    seasons: parseList(values.seasons, ['All Seasons']),
    relatedProducts: [],
  }
}

export function productFormValuesFromProduct(
  product: Product,
  inventory?: ProductInventorySnapshot | null,
): ProductFormValues {
  const primarySize = product.sizes[0] ?? {
    ml: 50,
    price: product.price,
  }

  const isOnSale = Boolean(
    product.originalPrice &&
      Number(product.originalPrice) > Number(product.price) &&
      Number(product.price) > 0,
  )

  const regularPrice = isOnSale
    ? String(product.originalPrice)
    : String(primarySize.price ?? product.price)
  const salePrice = isOnSale ? String(primarySize.price ?? product.price) : ''

  return {
    name: product.name,
    brand: product.brand,
    description: product.description,
    category: product.category,
    gender: product.gender,
    price: regularPrice,
    salePrice,
    originalPrice: regularPrice,
    sizeMl: String(primarySize.ml ?? 50),
    scentFamily: product.scentFamily.join(', '),
    topNotes: product.topNotes.join(', '),
    middleNotes: product.middleNotes.join(', '),
    baseNotes: product.baseNotes.join(', '),
    occasions: product.occasions.join(', '),
    seasons: product.seasons.join(', '),
    uploadedImage: product.images[0] ?? '',
    featured: product.featured,
    isNewArrival: product.isNewArrival,
    inStock: inventory ? inventory.stock > 0 : product.inStock,
    stockQuantity: String(inventory?.stock ?? (product.inStock ? 1 : 0)),
    reorderPoint: String(inventory?.reorderPoint ?? 3),
    storageLocation: inventory?.location ?? initialProductFormValues.storageLocation,
  }
}

export function updateProductFromForm(
  existingProduct: Product,
  values: ProductFormValues,
): Product {
  const { price, originalPrice } = resolvePricing(values)
  const sizeMl = Number(values.sizeMl)
  const trailingSizes = existingProduct.sizes.slice(1)
  const primaryImage = values.uploadedImage.trim() || existingProduct.images[0] || '/placeholder.jpg'

  return {
    ...existingProduct,
    name: values.name.trim(),
    brand: values.brand.trim(),
    description: values.description.trim(),
    price,
    originalPrice,
    category: values.category,
    scentFamily: parseList(values.scentFamily, existingProduct.scentFamily),
    gender: values.gender,
    topNotes: parseList(values.topNotes, existingProduct.topNotes),
    middleNotes: parseList(values.middleNotes, existingProduct.middleNotes),
    baseNotes: parseList(values.baseNotes, existingProduct.baseNotes),
    sizes: [{ ml: sizeMl, price }, ...trailingSizes],
    images: [primaryImage, ...existingProduct.images.slice(1)],
    inStock: Number(values.stockQuantity) > 0,
    featured: values.featured,
    isNewArrival: values.isNewArrival,
    occasions: parseList(values.occasions, existingProduct.occasions),
    seasons: parseList(values.seasons, existingProduct.seasons),
  }
}
