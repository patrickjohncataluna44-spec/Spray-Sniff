import { SITE_NAME } from '@/lib/site'

export interface Product {
  id: string
  name: string
  brand: string
  description: string
  price: number
  category: string
  scentFamily: string[]
  gender: 'male' | 'female' | 'unisex'
  topNotes: string[]
  middleNotes: string[]
  baseNotes: string[]
  longevity: number
  intensity: number
  sizes: { ml: number; price: number }[]
  images: string[]
  rating: number
  reviewCount: number
  inStock: boolean
  featured: boolean
  isNewArrival: boolean
  occasions: string[]
  seasons: string[]
  relatedProducts: string[]
}

export const products: Product[] = [
  {
    id: 'test-1peso',
    name: 'Payment Test Item',
    brand: SITE_NAME,
    description: 'A 1 peso test item for verifying checkout and payment flows.',
    price: 1,
    category: 'Test Item',
    scentFamily: ['Test'],
    gender: 'unisex',
    topNotes: ['Test'],
    middleNotes: ['Test'],
    baseNotes: ['Test'],
    longevity: 1,
    intensity: 1,
    sizes: [{ ml: 1, price: 1 }],
    images: ['/products/dawn-light-1.jpg'],
    rating: 5,
    reviewCount: 1,
    inStock: true,
    featured: false,
    isNewArrival: false,
    occasions: ['Testing'],
    seasons: ['All Seasons'],
    relatedProducts: [],
  },
  {
    id: '1',
    name: 'Midnight Elegance',
    brand: SITE_NAME,
    description: 'A sophisticated blend of dark florals and woody notes, perfect for evening occasions.',
    price: 185,
    category: 'Eau de Parfum',
    scentFamily: ['Floral', 'Woody'],
    gender: 'female',
    topNotes: ['Bergamot', 'Black Currant'],
    middleNotes: ['Rose', 'Jasmine', 'Iris'],
    baseNotes: ['Sandalwood', 'Musk', 'Amber'],
    longevity: 8,
    intensity: 4,
    sizes: [
      { ml: 30, price: 185 },
      { ml: 50, price: 245 },
      { ml: 100, price: 385 },
    ],
    images: ['/products/midnight-elegance-1.jpg', '/products/midnight-elegance-2.jpg'],
    rating: 4.8,
    reviewCount: 342,
    inStock: true,
    featured: true,
    isNewArrival: false,
    occasions: ['Evening', 'Special Events', 'Formal Dinners'],
    seasons: ['Fall', 'Winter'],
    relatedProducts: ['2', '5'],
  },
  {
    id: '2',
    name: 'Dawn Light',
    brand: SITE_NAME,
    description: 'A fresh citrus fragrance with subtle floral notes, ideal for daytime wear.',
    price: 155,
    category: 'Eau de Toilette',
    scentFamily: ['Citrus', 'Floral'],
    gender: 'female',
    topNotes: ['Lemon', 'Grapefruit', 'Neroli'],
    middleNotes: ['Peony', 'Magnolia'],
    baseNotes: ['Musk', 'Cedar'],
    longevity: 6,
    intensity: 2,
    sizes: [
      { ml: 30, price: 155 },
      { ml: 75, price: 215 },
      { ml: 150, price: 325 },
    ],
    images: ['/products/dawn-light-1.jpg', '/products/dawn-light-2.jpg'],
    rating: 4.6,
    reviewCount: 278,
    inStock: true,
    featured: true,
    isNewArrival: true,
    occasions: ['Day', 'Work', 'Casual'],
    seasons: ['Spring', 'Summer'],
    relatedProducts: ['3', '1'],
  },
  {
    id: '3',
    name: 'Velvet Spice',
    brand: SITE_NAME,
    description: 'A warm, sensual blend with exotic spices and precious woods.',
    price: 195,
    category: 'Eau de Parfum',
    scentFamily: ['Spicy', 'Woody', 'Oriental'],
    gender: 'unisex',
    topNotes: ['Cardamom', 'Black Pepper'],
    middleNotes: ['Cinnamon', 'Clove', 'Saffron'],
    baseNotes: ['Oud', 'Patchouli', 'Vanilla'],
    longevity: 9,
    intensity: 5,
    sizes: [
      { ml: 30, price: 195 },
      { ml: 50, price: 265 },
      { ml: 100, price: 425 },
    ],
    images: ['/products/velvet-spice-1.jpg', '/products/velvet-spice-2.jpg'],
    rating: 4.9,
    reviewCount: 421,
    inStock: true,
    featured: false,
    isNewArrival: false,
    occasions: ['Evening', 'Special Events', 'Date Night'],
    seasons: ['Fall', 'Winter'],
    relatedProducts: ['4', '6'],
  },
  {
    id: '4',
    name: 'Ocean Breeze',
    brand: SITE_NAME,
    description: 'A crisp aquatic fragrance with marine and green notes.',
    price: 145,
    category: 'Eau de Toilette',
    scentFamily: ['Aquatic', 'Fresh'],
    gender: 'male',
    topNotes: ['Sea Salt', 'Mint', 'Grapefruit'],
    middleNotes: ['Water Lily', 'Green Tea'],
    baseNotes: ['Driftwood', 'Ambroxan'],
    longevity: 5,
    intensity: 2,
    sizes: [
      { ml: 50, price: 145 },
      { ml: 100, price: 215 },
      { ml: 200, price: 365 },
    ],
    images: ['/products/ocean-breeze-1.jpg', '/products/ocean-breeze-2.jpg'],
    rating: 4.5,
    reviewCount: 198,
    inStock: true,
    featured: false,
    isNewArrival: true,
    occasions: ['Day', 'Sports', 'Casual'],
    seasons: ['Spring', 'Summer'],
    relatedProducts: ['5', '2'],
  },
  {
    id: '5',
    name: 'Golden Hour',
    brand: SITE_NAME,
    description: 'A warm amber fragrance with golden accords, perfect for any occasion.',
    price: 175,
    category: 'Eau de Parfum',
    scentFamily: ['Amber', 'Floral', 'Woody'],
    gender: 'unisex',
    topNotes: ['Mandarin', 'Pink Pepper'],
    middleNotes: ['Tuberose', 'Heliotrope'],
    baseNotes: ['Amber', 'Sandalwood', 'Musk'],
    longevity: 8,
    intensity: 3,
    sizes: [
      { ml: 30, price: 175 },
      { ml: 50, price: 235 },
      { ml: 100, price: 375 },
    ],
    images: ['/products/golden-hour-1.jpg', '/products/golden-hour-2.jpg'],
    rating: 4.7,
    reviewCount: 365,
    inStock: true,
    featured: true,
    isNewArrival: false,
    occasions: ['Evening', 'Day', 'Versatile'],
    seasons: ['All Seasons'],
    relatedProducts: ['1', '3'],
  },
  {
    id: '6',
    name: 'Forest Trail',
    brand: SITE_NAME,
    description: 'An earthy, aromatic fragrance with moss, pine, and leather notes.',
    price: 165,
    category: 'Eau de Parfum',
    scentFamily: ['Woody', 'Aromatic', 'Leather'],
    gender: 'male',
    topNotes: ['Juniper', 'Galbanum'],
    middleNotes: ['Pine', 'Cypress', 'Fir Needle'],
    baseNotes: ['Moss', 'Leather', 'Cedar'],
    longevity: 7,
    intensity: 4,
    sizes: [
      { ml: 50, price: 165 },
      { ml: 100, price: 245 },
      { ml: 200, price: 425 },
    ],
    images: ['/products/forest-trail-1.jpg', '/products/forest-trail-2.jpg'],
    rating: 4.6,
    reviewCount: 287,
    inStock: true,
    featured: false,
    isNewArrival: false,
    occasions: ['Day', 'Work', 'Adventure'],
    seasons: ['Fall', 'Winter'],
    relatedProducts: ['3', '4'],
  },
  {
    id: '7',
    name: 'Silk Dreams',
    brand: SITE_NAME,
    description: 'A dreamy tuberose perfume with creamy florals and soft woods.',
    price: 205,
    category: 'Eau de Parfum',
    scentFamily: ['Floral', 'Creamy'],
    gender: 'female',
    topNotes: ['Bergamot', 'Freesia'],
    middleNotes: ['Tuberose', 'Orange Blossom', 'Coconut'],
    baseNotes: ['Sandalwood', 'Musk', 'Amber'],
    longevity: 8,
    intensity: 3,
    sizes: [
      { ml: 30, price: 205 },
      { ml: 50, price: 275 },
      { ml: 100, price: 445 },
    ],
    images: ['/products/silk-dreams-1.jpg', '/products/silk-dreams-2.jpg'],
    rating: 4.8,
    reviewCount: 356,
    inStock: true,
    featured: true,
    isNewArrival: true,
    occasions: ['Evening', 'Special Events', 'Romantic'],
    seasons: ['All Seasons'],
    relatedProducts: ['2', '5'],
  },
  {
    id: '8',
    name: 'Stone & Steel',
    brand: SITE_NAME,
    description: 'A fresh aromatic for the modern man, with clean and crisp accords.',
    price: 155,
    category: 'Eau de Toilette',
    scentFamily: ['Aromatic', 'Fresh'],
    gender: 'male',
    topNotes: ['Lemon', 'Lavender', 'Ginger'],
    middleNotes: ['Geranium', 'Clary Sage'],
    baseNotes: ['Vetiver', 'Musk', 'Amber'],
    longevity: 6,
    intensity: 2,
    sizes: [
      { ml: 50, price: 155 },
      { ml: 100, price: 225 },
      { ml: 200, price: 385 },
    ],
    images: ['/products/stone-steel-1.jpg', '/products/stone-steel-2.jpg'],
    rating: 4.4,
    reviewCount: 214,
    inStock: true,
    featured: false,
    isNewArrival: false,
    occasions: ['Day', 'Work', 'Casual'],
    seasons: ['All Seasons'],
    relatedProducts: ['4', '6'],
  },
]

export function getProductById(id: string): Product | undefined {
  return products.find(p => p.id === id)
}

export function getProductsByCategory(category: string): Product[] {
  return products.filter(p => p.category === category)
}

export function getFeaturedProducts(): Product[] {
  return products.filter(p => p.featured)
}

export function getNewArrivals(): Product[] {
  return products.filter(p => p.isNewArrival)
}

export function searchProducts(query: string): Product[] {
  const q = query.toLowerCase()
  return products.filter(p =>
    p.name.toLowerCase().includes(q) ||
    p.description.toLowerCase().includes(q) ||
    p.scentFamily.some(f => f.toLowerCase().includes(q))
  )
}
