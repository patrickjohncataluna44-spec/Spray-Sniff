import { formatPHP } from '@/lib/currency'
import { subscribeToPromotions as subscribeToPromotionChanges } from '@/lib/supabase-realtime'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

export const PROMOTION_TYPES = ['Percentage', 'Fixed'] as const
export const PROMOTION_STATUSES = ['Draft', 'Scheduled', 'Active', 'Paused', 'Expired'] as const

export type PromotionType = (typeof PROMOTION_TYPES)[number]
export type PromotionStatus = (typeof PROMOTION_STATUSES)[number]

export interface StoredPromotion {
  id: string
  code: string
  type: PromotionType
  discount: number
  usedCount: number
  usageLimit: number | null
  status: PromotionStatus
  startsAt: string
  expiresAt: string
  description: string
}

export interface PromotionFormValues {
  code: string
  type: PromotionType
  discountValue: string
  usedCount: string
  usageLimit: string
  status: PromotionStatus
  startsAt: string
  expiresAt: string
  description: string
}

export const seedPromotions: StoredPromotion[] = [
  {
    id: 'spring2024',
    code: 'SPRING2024',
    type: 'Percentage',
    discount: 20,
    usedCount: 156,
    usageLimit: 500,
    status: 'Active',
    startsAt: '2024-03-01',
    expiresAt: '2024-04-30',
    description: 'Seasonal spring campaign for fragrance bestsellers.',
  },
  {
    id: 'welcome10',
    code: 'WELCOME10',
    type: 'Fixed',
    discount: 10,
    usedCount: 342,
    usageLimit: null,
    status: 'Active',
    startsAt: '2024-01-01',
    expiresAt: '2024-12-31',
    description: 'Simple first-order welcome discount for new customers.',
  },
  {
    id: 'summer15',
    code: 'SUMMER15',
    type: 'Percentage',
    discount: 15,
    usedCount: 89,
    usageLimit: 300,
    status: 'Active',
    startsAt: '2024-05-01',
    expiresAt: '2024-08-31',
    description: 'Warm-weather promo built for daytime and body mist lines.',
  },
  {
    id: 'holiday25',
    code: 'HOLIDAY25',
    type: 'Percentage',
    discount: 25,
    usedCount: 0,
    usageLimit: 500,
    status: 'Scheduled',
    startsAt: '2024-12-01',
    expiresAt: '2024-12-26',
    description: 'Holiday push with stronger discounting and capped redemptions.',
  },
  {
    id: 'vip30',
    code: 'VIP30',
    type: 'Percentage',
    discount: 30,
    usedCount: 45,
    usageLimit: null,
    status: 'Active',
    startsAt: '2024-01-01',
    expiresAt: '2024-12-31',
    description: 'VIP loyalty code reserved for high-value returning customers.',
  },
]

export const initialPromotionFormValues: PromotionFormValues = {
  code: '',
  type: 'Percentage',
  discountValue: '',
  usedCount: '0',
  usageLimit: '',
  status: 'Draft',
  startsAt: '',
  expiresAt: '',
  description: '',
}

function normalizePromotionCode(value: string) {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9_-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '')
}

function createPromotionId(code: string) {
  const normalizedCode = normalizePromotionCode(code).toLowerCase()
  return normalizedCode || `promotion-${Date.now()}`
}

async function getAuthHeaders() {
  const supabase = getSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const headers: Record<string, string> = {}

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

export async function listPromotions(): Promise<StoredPromotion[]> {
  const response = await fetch('/api/promotions', {
    method: 'GET',
    headers: await getAuthHeaders(),
    cache: 'no-store',
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error ?? 'Unable to load promotions.')
  }

  return Array.isArray(payload.promotions) ? (payload.promotions as StoredPromotion[]) : []
}

export async function createStoredPromotion(promotion: StoredPromotion) {
  const response = await fetch('/api/promotions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(await getAuthHeaders()),
    },
    body: JSON.stringify(promotion),
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error ?? 'Unable to create promotion.')
  }

  return payload.promotion as StoredPromotion
}

export async function updateStoredPromotion(promotion: StoredPromotion) {
  const response = await fetch(`/api/promotions/${promotion.id}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      ...(await getAuthHeaders()),
    },
    body: JSON.stringify(promotion),
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error ?? 'Unable to update promotion.')
  }

  return payload.promotion as StoredPromotion
}

export async function deleteStoredPromotion(promotionId: string) {
  const response = await fetch(`/api/promotions/${promotionId}`, {
    method: 'DELETE',
    headers: await getAuthHeaders(),
  })
  const payload = await response.json().catch(() => ({}))

  if (!response.ok) {
    throw new Error(payload.error ?? 'Unable to delete promotion.')
  }
}

export function subscribeToPromotions(onChange: () => void) {
  return subscribeToPromotionChanges(onChange)
}

export function formatPromotionUsage(promotion: StoredPromotion) {
  return `${promotion.usedCount}/${promotion.usageLimit ?? 'Unlimited'}`
}

export function formatStoredPromotionDiscount(promotion: StoredPromotion) {
  return promotion.type === 'Fixed' ? formatPHP(promotion.discount) : `${promotion.discount}%`
}

export function promotionFormValuesFromPromotion(promotion: StoredPromotion): PromotionFormValues {
  return {
    code: promotion.code,
    type: promotion.type,
    discountValue: String(promotion.discount),
    usedCount: String(promotion.usedCount),
    usageLimit: typeof promotion.usageLimit === 'number' ? String(promotion.usageLimit) : '',
    status: promotion.status,
    startsAt: promotion.startsAt,
    expiresAt: promotion.expiresAt,
    description: promotion.description,
  }
}

export function createPromotionFromForm(values: PromotionFormValues): StoredPromotion {
  return {
    id: createPromotionId(values.code),
    code: normalizePromotionCode(values.code),
    type: values.type,
    discount: Number(values.discountValue),
    usedCount: Math.max(0, Math.round(Number(values.usedCount) || 0)),
    usageLimit:
      values.usageLimit.trim().length > 0 ? Math.max(0, Math.round(Number(values.usageLimit))) : null,
    status: values.status,
    startsAt: values.startsAt,
    expiresAt: values.expiresAt,
    description: values.description.trim(),
  }
}

export function updatePromotionFromForm(
  existingPromotion: StoredPromotion,
  values: PromotionFormValues,
): StoredPromotion {
  return {
    ...existingPromotion,
    code: normalizePromotionCode(values.code),
    type: values.type,
    discount: Number(values.discountValue),
    usedCount: Math.max(0, Math.round(Number(values.usedCount) || 0)),
    usageLimit:
      values.usageLimit.trim().length > 0 ? Math.max(0, Math.round(Number(values.usageLimit))) : null,
    status: values.status,
    startsAt: values.startsAt,
    expiresAt: values.expiresAt,
    description: values.description.trim(),
  }
}
