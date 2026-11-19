export type ShippingRegion = 'mindanao' | 'visayas' | 'luzon'

export interface JntRateTier {
  id: string
  label: string
  minGrams: number
  maxGrams: number
  rates: Record<ShippingRegion, number>
}

export const JNT_COURIER_NAME = 'J&T Express'
export const JNT_ORIGIN_LABEL = 'Mindanao (Davao de Oro)'
export const PARCEL_PACKAGING_ALLOWANCE_GRAMS = 80

export const SHIPPING_REGION_META: Record<
  ShippingRegion,
  {
    id: ShippingRegion
    label: string
    routeLabel: string
    shortLabel: string
    startingRate: number
    excessPerKgRate: number
    etaLabel: string
  }
> = {
  mindanao: {
    id: 'mindanao',
    label: 'Mindanao',
    routeLabel: 'Within Mindanao',
    shortLabel: 'Within Mindanao',
    startingRate: 85,
    excessPerKgRate: 95,
    etaLabel: '2–4 business days',
  },
  visayas: {
    id: 'visayas',
    label: 'Visayas',
    routeLabel: 'Mindanao to Visayas',
    shortLabel: 'To Visayas',
    startingRate: 105,
    excessPerKgRate: 105,
    etaLabel: '4–6 business days',
  },
  luzon: {
    id: 'luzon',
    label: 'Luzon',
    routeLabel: 'Mindanao to Luzon',
    shortLabel: 'To Luzon',
    startingRate: 105,
    excessPerKgRate: 105,
    etaLabel: '5–7 business days',
  },
}

export const JNT_STANDARD_RATE_TIERS: readonly JntRateTier[] = [
  {
    id: '0-500g',
    label: '0–500g',
    minGrams: 0,
    maxGrams: 500,
    rates: { mindanao: 85, visayas: 105, luzon: 105 },
  },
  {
    id: '500g-1kg',
    label: '500g–1kg',
    minGrams: 501,
    maxGrams: 1000,
    rates: { mindanao: 155, visayas: 175, luzon: 175 },
  },
  {
    id: '1-3kg',
    label: '1–3kg',
    minGrams: 1001,
    maxGrams: 3000,
    rates: { mindanao: 180, visayas: 195, luzon: 195 },
  },
  {
    id: '3-4kg',
    label: '3–4kg',
    minGrams: 3001,
    maxGrams: 4000,
    rates: { mindanao: 270, visayas: 285, luzon: 285 },
  },
  {
    id: '4-5kg',
    label: '4–5kg',
    minGrams: 4001,
    maxGrams: 5000,
    rates: { mindanao: 360, visayas: 380, luzon: 380 },
  },
  {
    id: '5-6kg',
    label: '5–6kg',
    minGrams: 5001,
    maxGrams: 6000,
    rates: { mindanao: 455, visayas: 475, luzon: 475 },
  },
] as const

export interface ShippableItemInput {
  size: number
  quantity: number
  weightGrams?: number
}

export interface ShippingRegionDetectionInput {
  province?: string | null
  city?: string | null
  postalCode?: string | null
  shippingAddress?: string | null
  latitude?: number | null
  longitude?: number | null
}

export interface ShippingRegionDetectionResult {
  region: ShippingRegion
  detected: boolean
  source: 'keyword' | 'postal' | 'coordinates' | 'default'
}

export interface JntShippingCalculation {
  courier: string
  originLabel: string
  region: ShippingRegion
  routeLabel: string
  etaLabel: string
  weightGrams: number
  weightLabel: string
  bracketLabel: string
  baseFee: number
  fee: number
  isFreeShipping: boolean
  startingRate: number
}

const MINDANAO_KEYWORDS = [
  'mindanao',
  'davao',
  'davao region',
  'region xi',
  'davao del norte',
  'davao del sur',
  'davao oriental',
  'davao occidental',
  'davao de oro',
  'compostela valley',
  'mabini',
  'tagum',
  'panabo',
  'digos',
  'mati',
  'samal',
  'cagayan de oro',
  'northern mindanao',
  'region x',
  'cdo',
  'iligan',
  'butuan',
  'surigao',
  'surigao del norte',
  'surigao del sur',
  'general santos',
  'gensan',
  'koronadal',
  'cotabato',
  'kidapawan',
  'tacurong',
  'zamboanga',
  'zamboanga peninsula',
  'region ix',
  'zamboanga del norte',
  'zamboanga del sur',
  'zamboanga sibugay',
  'pagadian',
  'dipolog',
  'dapitan',
  'ozamiz',
  'oroquieta',
  'tangub',
  'malaybalay',
  'valencia',
  'bukidnon',
  'misamis',
  'misamis oriental',
  'misamis occidental',
  'agusan',
  'agusan del norte',
  'agusan del sur',
  'lanao',
  'lanao del norte',
  'lanao del sur',
  'maguindanao',
  'sultan kudarat',
  'sarangani',
  'south cotabato',
  'north cotabato',
  'camiguin',
  'dinagat',
  'siargao',
  'basilan',
  'sulu',
  'tawi-tawi',
  'marawi',
  'bislig',
  'tandag',
  'bayugan',
  'cabadbaran',
  'caraga',
  'region xiii',
  'soccsksargen',
  'region xii',
  'barmm',
  'bangsamoro',
]

const VISAYAS_KEYWORDS = [
  'visayas',
  'central visayas',
  'western visayas',
  'eastern visayas',
  'negros island region',
  'region vi',
  'region vii',
  'region viii',
  'cebu',
  'mandaue',
  'lapu-lapu',
  'talisay, cebu',
  'danao',
  'toledo',
  'naga, cebu',
  'carcar',
  'bogo',
  'bohol',
  'tagbilaran',
  'siquijor',
  'negros',
  'negros occidental',
  'negros oriental',
  'bacolod',
  'dumaguete',
  'bago',
  'cadiz',
  'escalante',
  'himamaylan',
  'kabankalan',
  'la carlota',
  'sagay',
  'san carlos, negros',
  'silay',
  'sipalay',
  'victorias',
  'bais',
  'bayawan',
  'canlaon',
  'guihulngan',
  'tanjay',
  'iloilo',
  'passi',
  'aklan',
  'kalibo',
  'boracay',
  'malay, aklan',
  'antique',
  'san jose de buenavista',
  'capiz',
  'roxas, capiz',
  'guimaras',
  'leyte',
  'southern leyte',
  'tacloban',
  'ormoc',
  'baybay',
  'maasin',
  'samar',
  'northern samar',
  'eastern samar',
  'western samar',
  'catbalogan',
  'calbayog',
  'borongan',
  'catarman',
  'biliran',
  'naval',
]

const LUZON_KEYWORDS = [
  'luzon',
  'metro manila',
  'ncr',
  'national capital region',
  'central luzon',
  'ilocos region',
  'cagayan valley',
  'cordillera administrative region',
  'bicol region',
  'region i',
  'region ii',
  'region iii',
  'region iv-a',
  'region iv-b',
  'region v',
  'manila',
  'quezon city',
  'makati',
  'taguig',
  'pasig',
  'mandaluyong',
  'san juan',
  'marikina',
  'pasay',
  'paranaque',
  'para\u00f1aque',
  'las pinas',
  'las pi\u00f1as',
  'muntinlupa',
  'caloocan',
  'malabon',
  'navotas',
  'valenzuela',
  'pateros',
  'cavite',
  'bacoor',
  'dasmarinas',
  'dasmari\u00f1as',
  'imus',
  'tagaytay',
  'laguna',
  'santa rosa',
  'calamba',
  'binan',
  'bi\u00f1an',
  'san pedro',
  'cabuyao',
  'batangas',
  'lipa',
  'tanauan',
  'rizal',
  'antipolo',
  'cainta',
  'taytay',
  'quezon province',
  'lucena',
  'bulacan',
  'malolos',
  'meycauayan',
  'san jose del monte',
  'pampanga',
  'angeles',
  'san fernando',
  'mabalacat',
  'tarlac',
  'nueva ecija',
  'cabanatuan',
  'bataan',
  'balanga',
  'zambales',
  'olongapo',
  'subic',
  'aurora',
  'baler',
  'pangasinan',
  'dagupan',
  'alaminos',
  'urdaneta',
  'la union',
  'ilocos',
  'ilocos norte',
  'ilocos sur',
  'laoag',
  'vigan',
  'baguio',
  'benguet',
  'abra',
  'apayao',
  'ifugao',
  'kalinga',
  'mountain province',
  'cagayan',
  'tuguegarao',
  'isabela',
  'santiago',
  'ilagan',
  'cauayan',
  'nueva vizcaya',
  'quirino',
  'batanes',
  'bicol',
  'albay',
  'legazpi',
  'ligao',
  'tabaco',
  'camarines',
  'camarines norte',
  'camarines sur',
  'naga',
  'iriga',
  'sorsogon',
  'catanduanes',
  'masbate',
  'mindoro',
  'occidental mindoro',
  'oriental mindoro',
  'calapan',
  'marinduque',
  'romblon',
  'palawan',
  'puerto princesa',
  'calabarzon',
  'mimaropa',
]

export function isValidShippingRegion(value: unknown): value is ShippingRegion {
  return value === 'mindanao' || value === 'visayas' || value === 'luzon'
}

export function normalizeShippingRegion(
  value: unknown,
  fallback: ShippingRegion = 'mindanao',
): ShippingRegion {
  return isValidShippingRegion(value) ? value : fallback
}

function matchesAnyKeyword(haystack: string, keywords: string[]): boolean {
  return keywords.some((keyword) => {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(haystack)
  })
}

function detectRegionFromPostalCode(rawPostal: string): ShippingRegion | null {
  const match = rawPostal.match(/\b(\d{4})\b/)
  if (!match) return null
  const zip = Number(match[1])
  if (!Number.isFinite(zip)) return null

  if (zip >= 7000 && zip <= 9899) {
    return 'mindanao'
  }
  if ((zip >= 5000 && zip <= 5099) || (zip >= 5600 && zip <= 6999)) {
    return 'visayas'
  }
  if ((zip >= 400 && zip <= 4999) || (zip >= 5100 && zip <= 5599)) {
    return 'luzon'
  }
  return null
}

function detectRegionFromCoordinates(lat: number, lng?: number | null): ShippingRegion | null {
  if (!Number.isFinite(lat)) return null
  // Palawan lies south of 12N but west of 120E and belongs to Luzon (MIMAROPA)
  if (typeof lng === 'number' && Number.isFinite(lng) && lng < 120.2 && lat >= 7.5 && lat <= 12.5) {
    return 'luzon'
  }
  if (lat < 9.5) {
    return 'mindanao'
  }
  if (lat < 12.6) {
    return 'visayas'
  }
  return 'luzon'
}

/**
 * Infers the Philippine destination island group from province, city, postal code,
 * formatted shipping address, or coordinates. Falls back to `'mindanao'` when unknown.
 */
export function detectPhilippineShippingRegion(
  input: ShippingRegionDetectionInput,
): ShippingRegionDetectionResult {
  const textCombined = [input.province, input.city, input.shippingAddress]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(', ')
    .toLowerCase()

  if (textCombined) {
    // Check explicit region labels / major provinces & cities first
    if (matchesAnyKeyword(textCombined, MINDANAO_KEYWORDS)) {
      return { region: 'mindanao', detected: true, source: 'keyword' }
    }
    if (matchesAnyKeyword(textCombined, VISAYAS_KEYWORDS)) {
      return { region: 'visayas', detected: true, source: 'keyword' }
    }
    if (matchesAnyKeyword(textCombined, LUZON_KEYWORDS)) {
      return { region: 'luzon', detected: true, source: 'keyword' }
    }
  }

  const postalSource = [input.postalCode, input.shippingAddress]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .join(' ')
  if (postalSource) {
    const fromZip = detectRegionFromPostalCode(postalSource)
    if (fromZip) {
      return { region: fromZip, detected: true, source: 'postal' }
    }
  }

  if (typeof input.latitude === 'number' && Number.isFinite(input.latitude)) {
    const fromCoords = detectRegionFromCoordinates(input.latitude, input.longitude)
    if (fromCoords) {
      return { region: fromCoords, detected: true, source: 'coordinates' }
    }
  }

  if (typeof input.shippingAddress === 'string') {
    const gpsMatch = input.shippingAddress.match(/\[GPS:\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\]/i)
    if (gpsMatch) {
      const gpsLat = Number(gpsMatch[1])
      const gpsLng = Number(gpsMatch[2])
      const fromGpsTag = detectRegionFromCoordinates(gpsLat, gpsLng)
      if (fromGpsTag) {
        return { region: fromGpsTag, detected: true, source: 'coordinates' }
      }
    }
  }

  return { region: 'mindanao', detected: false, source: 'default' }
}

/**
 * Estimates the gross weight in grams of a single perfume bottle (glass + liquid + box)
 * from its volume in ml, or uses a custom gram weight when provided.
 */
export function estimateBottleWeightGrams(sizeMl: number, customWeightGrams?: number): number {
  if (typeof customWeightGrams === 'number' && Number.isFinite(customWeightGrams) && customWeightGrams > 0) {
    return Math.round(customWeightGrams)
  }

  const normalizedMl = Number.isFinite(sizeMl) && sizeMl > 0 ? sizeMl : 50
  if (normalizedMl <= 15) return 110
  if (normalizedMl <= 30) return 160
  if (normalizedMl <= 50) return 250
  if (normalizedMl <= 75) return 320
  if (normalizedMl <= 100) return 380
  return Math.round(normalizedMl * 3.8)
}

/**
 * Calculates total parcel weight in grams for a list of items, including outer
 * protective parcel packaging.
 */
export function calculateParcelWeightGrams(items: ShippableItemInput[]): number {
  const totalQuantity = items.reduce(
    (sum, item) => sum + (Number.isFinite(item.quantity) && item.quantity > 0 ? Math.round(item.quantity) : 0),
    0,
  )
  if (totalQuantity <= 0) return 0

  const itemsWeight = items.reduce((sum, item) => {
    const qty = Number.isFinite(item.quantity) && item.quantity > 0 ? Math.round(item.quantity) : 0
    if (qty <= 0) return sum
    return sum + estimateBottleWeightGrams(item.size, item.weightGrams) * qty
  }, 0)

  return itemsWeight + PARCEL_PACKAGING_ALLOWANCE_GRAMS
}

export function formatParcelWeight(weightGrams: number): string {
  if (!Number.isFinite(weightGrams) || weightGrams <= 0) return '0g'
  if (weightGrams < 1000) {
    return `${Math.round(weightGrams)}g`
  }
  const kg = weightGrams / 1000
  return `${Number.isInteger(kg) ? kg.toFixed(0) : kg.toFixed(2)} kg`
}

export function getJntRateForWeight(
  weightGrams: number,
  region: ShippingRegion,
): { fee: number; bracketLabel: string } {
  if (!Number.isFinite(weightGrams) || weightGrams <= 0) {
    return { fee: 0, bracketLabel: 'No items' }
  }

  const matchedTier = JNT_STANDARD_RATE_TIERS.find(
    (tier) => weightGrams <= tier.maxGrams,
  )
  if (matchedTier) {
    return {
      fee: matchedTier.rates[region],
      bracketLabel: matchedTier.label,
    }
  }

  const topTier = JNT_STANDARD_RATE_TIERS[JNT_STANDARD_RATE_TIERS.length - 1]
  const excessKg = Math.ceil((weightGrams - topTier.maxGrams) / 1000)
  const extraFee = excessKg * SHIPPING_REGION_META[region].excessPerKgRate
  return {
    fee: topTier.rates[region] + extraFee,
    bracketLabel: `${Math.ceil(weightGrams / 1000)}kg (>6kg)`,
  }
}

export interface CalculateJntShippingInput {
  items: ShippableItemInput[]
  region?: ShippingRegion | null
  isTestCart?: boolean
  waiveShipping?: boolean
}

export function calculateJntShipping(
  input: CalculateJntShippingInput,
): JntShippingCalculation {
  const region = normalizeShippingRegion(input.region, 'mindanao')
  const regionMeta = SHIPPING_REGION_META[region]
  const weightGrams = calculateParcelWeightGrams(input.items)
  const weightLabel = formatParcelWeight(weightGrams)

  if (input.isTestCart || weightGrams <= 0) {
    return {
      courier: JNT_COURIER_NAME,
      originLabel: JNT_ORIGIN_LABEL,
      region,
      routeLabel: regionMeta.routeLabel,
      etaLabel: regionMeta.etaLabel,
      weightGrams,
      weightLabel,
      bracketLabel: input.isTestCart ? 'Test item' : '0–500g',
      baseFee: 0,
      fee: 0,
      isFreeShipping: true,
      startingRate: regionMeta.startingRate,
    }
  }

  const { fee: baseFee, bracketLabel } = getJntRateForWeight(weightGrams, region)
  const isFreeShipping = Boolean(input.waiveShipping)

  return {
    courier: JNT_COURIER_NAME,
    originLabel: JNT_ORIGIN_LABEL,
    region,
    routeLabel: regionMeta.routeLabel,
    etaLabel: regionMeta.etaLabel,
    weightGrams,
    weightLabel,
    bracketLabel,
    baseFee,
    fee: isFreeShipping ? 0 : baseFee,
    isFreeShipping,
    startingRate: regionMeta.startingRate,
  }
}
