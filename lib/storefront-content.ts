import { ADMIN_EMAIL, SITE_NAME } from '@/lib/site'

export type StorefrontNavItem = {
  label: string
  href: string
  kind: 'route' | 'anchor'
}

export type StorefrontBenefit = {
  id: 'craft' | 'notes' | 'gifting' | 'delivery'
  title: string
  description: string
}

export type StorefrontTestimonial = {
  id: string
  name: string
  role: string
  quote: string
  productName: string
  rating: number
  longevity: string
  verified: boolean
  date: string
}

export type StorefrontJournalArticle = {
  id: string
  slug: string
  title: string
  excerpt: string
  content: string[]
  image: string
  imageAlt: string
  category: string
  readTime: string
  date: string
  author: string
  relatedScents: string[]
}

export type StorefrontFooterGroup = {
  title: string
  links: Array<{
    label: string
    href: string
  }>
}

export const STOREFRONT_NAV_ITEMS: StorefrontNavItem[] = [
  { label: 'Home', href: '/', kind: 'route' },
  { label: 'Shop', href: '/shop', kind: 'route' },
  { label: 'Collections', href: '/collections', kind: 'route' },
  { label: 'Discovery', href: '/discovery', kind: 'route' },
  { label: 'About', href: '/about', kind: 'route' },
  { label: 'Reviews', href: '/reviews', kind: 'route' },
  { label: 'Journal', href: '/journal', kind: 'route' },
  { label: 'Contact', href: '/contact', kind: 'route' },
]

export const HOME_BENEFITS: StorefrontBenefit[] = [
  {
    id: 'craft',
    title: 'Artisanal Maceration',
    description:
      'Every formulation rests for weeks to allow natural oils and resins to mature into a cohesive, enduring fragrance profile.',
  },
  {
    id: 'notes',
    title: 'Note-Led Discovery',
    description:
      'We map top, heart, and base notes so you understand how each fragrance evolves on your skin across 8+ hours of wear.',
  },
  {
    id: 'gifting',
    title: 'Curated Presentation',
    description:
      'Bottles arrive in signature atelier boxes with individualized blotter cards and gifting-ready packaging.',
  },
  {
    id: 'delivery',
    title: 'Direct Dispatch from Mabini',
    description:
      'Hand-inspected and packed locally with real-time delivery notifications and responsive concierge support.',
  },
]

export const STOREFRONT_TESTIMONIALS: StorefrontTestimonial[] = [
  {
    id: 'rev-1',
    name: 'Iris Morales',
    role: 'Collector & Architect',
    quote:
      'Midnight Elegance is by far the most balanced evening extrait I have worn this year. The iris and sandalwood dry-down is intoxicating without screaming across the room.',
    productName: 'Midnight Elegance',
    rating: 5,
    longevity: '9-10 hours',
    verified: true,
    date: 'March 2026',
  },
  {
    id: 'rev-2',
    name: 'Daniel Rivera',
    role: 'Creative Director',
    quote:
      'Forest Trail evokes damp cedar and cold pine needles after rain. It does not smell like artificial cologne; it smells like walking through Benguet pine woods at daybreak.',
    productName: 'Forest Trail',
    rating: 5,
    longevity: '8 hours',
    verified: true,
    date: 'April 2026',
  },
  {
    id: 'rev-3',
    name: 'Camille Tan',
    role: 'Brand Strategist',
    quote:
      'Took the Discovery Quiz on a whim and ordered Dawn Light. The recommendation was spot on: crisp bergamot and neroli that lifts my morning without fading by lunchtime.',
    productName: 'Dawn Light',
    rating: 5,
    longevity: '7 hours',
    verified: true,
    date: 'April 2026',
  },
  {
    id: 'rev-4',
    name: 'Marco Santos',
    role: 'Interior Designer',
    quote:
      'Velvet Spice has this warm, enveloping cardamom and bourbon vanilla profile that garners compliments everywhere. Delivery was fast and beautifully boxed.',
    productName: 'Velvet Spice',
    rating: 5,
    longevity: '10+ hours',
    verified: true,
    date: 'April 2026',
  },
  {
    id: 'rev-5',
    name: 'Elena Rostova',
    role: 'Photographer',
    quote:
      'Silk Dreams is my default office scent. White florals wrapped in clean musk. Subtle, sophisticated, and completely non-cloying even in hot weather.',
    productName: 'Silk Dreams',
    rating: 4,
    longevity: '6-7 hours',
    verified: true,
    date: 'March 2026',
  },
  {
    id: 'rev-6',
    name: 'Rafael Cruz',
    role: 'Culinary Artist',
    quote:
      'Golden Hour feels like afternoon sun trapped in amber glass. Citrus and rich tonka bean with fantastic projection. A triumph of local perfume curation.',
    productName: 'Golden Hour',
    rating: 5,
    longevity: '8 hours',
    verified: true,
    date: 'February 2026',
  },
]

export const STOREFRONT_JOURNAL_ARTICLES: StorefrontJournalArticle[] = [
  {
    id: 'article-1',
    slug: 'build-perfume-wardrobe',
    title: 'How To Build A Fragrance Wardrobe For Day, Date Night, And Formal Wear',
    excerpt:
      'A structured approach to selecting signature bottles that harmonize with your routine rather than compete with it.',
    content: [
      'Just as a capsule wardrobe provides dependable choices for any dress code, an intentional fragrance wardrobe ensures your scent fluidly matches the hour, temperature, and mood.',
      'We recommend curating three foundational pillars: A crisp, uplifting daily signature with high volatility (bergamot, aquatic notes, neroli); an intimate skin scent for focused work or travel; and a resinous, dark evening statement composed around labdanum, iris, or aged woods.',
      'When testing candidates, always evaluate the dry-down after 4 hours on pulse points, where body warmth activates the true personality of the base notes.',
    ],
    image: '/collections/timeless-classics-banner.jpg',
    imageAlt: 'Perfume bottles from the Timeless Classics collection',
    category: 'Olfactive Styling',
    readTime: '4 min read',
    date: 'April 2026',
    author: 'Editorial Desk',
    relatedScents: ['Midnight Elegance', 'Dawn Light'],
  },
  {
    id: 'article-2',
    slug: 'perfume-concentration-guide',
    title: 'Extrait, EDP, and EDT: Demystifying Concentration and Sillage',
    excerpt:
      'Understanding the percentage of aromatic compounds and why high concentration behaves differently on the skin.',
    content: [
      'The difference between Eau de Toilette (10–15%), Eau de Parfum (15–20%), and Extrait de Parfum (25–35%) is not merely longevity; it dictates how the fragrance blooms in the air.',
      'Eau de Toilette carries higher alcohol volatility, creating a sharp opening and immediate sillage that fades more quickly. Extrait de Parfum, having less alcohol and more dense resinous oils, stays closer to the wearer as a rich aura that endures well into the night.',
      'Choosing concentration depends on how you want to be remembered: as a presence that enters the room before you, or an intimate discovery revealed only to those closest.',
    ],
    image: '/collections/evening-elegance-banner.jpg',
    imageAlt: 'Bottles in dark atelier evening light',
    category: 'Fragrance Science',
    readTime: '5 min read',
    date: 'April 2026',
    author: 'Atelier Chemist',
    relatedScents: ['Forest Trail', 'Velvet Spice'],
  },
  {
    id: 'article-3',
    slug: 'art-of-scent-layering',
    title: 'The Art of Scent Layering: Harmonizing Woody and Floral Accords',
    excerpt:
      'How to blend complementary fragrances on your skin without creating sensory discord.',
    content: [
      'Layering fragrances is an exercise in restraint. The golden rule is applying the heavier, resinous scent first as a structural foundation before misting a lighter, more volatile floral or citrus over top.',
      'For example, pair the cedar and moss base of Forest Trail with a light whisper of Dawn Light’s neroli to create a dewy mountain dawn aura that is uniquely yours.',
      'Never rub your wrists together after spraying; friction crushes delicate volatile molecules and truncates the top note transition.',
    ],
    image: '/collections/fresh-essence-banner.jpg',
    imageAlt: 'Fresh botanical essences and perfume flacons',
    category: 'Rituals & Craft',
    readTime: '3 min read',
    date: 'March 2026',
    author: 'Fragrance Curation',
    relatedScents: ['Dawn Light', 'Forest Trail', 'Golden Hour'],
  },
]

export const STOREFRONT_FOOTER_GROUPS: StorefrontFooterGroup[] = [
  {
    title: 'Storefront',
    links: [
      { label: 'Home', href: '/' },
      { label: 'Shop Catalog', href: '/shop' },
      { label: 'Curated Collections', href: '/collections' },
      { label: 'Discovery Quiz', href: '/discovery' },
    ],
  },
  {
    title: 'Editorial & Community',
    links: [
      { label: 'Boutique Story', href: '/about' },
      { label: 'Customer Reviews', href: '/reviews' },
      { label: 'Scent Journal', href: '/journal' },
      { label: 'Concierge & Contact', href: '/contact' },
    ],
  },
  {
    title: 'Orders & Care',
    links: [
      { label: 'My Account', href: '/account' },
      { label: 'Track Parcel', href: '/orders' },
      { label: 'FAQ', href: '/help/faq' },
    ],
  },
]

export const STOREFRONT_CONTACT_DETAILS = {
  atelierName: 'Spray & Sniff Atelier & Boutique',
  location: 'A. Mabini Street, Malate / Ermita Cultural District, Manila',
  email: ADMIN_EMAIL,
  phone: '+63 917 800 7764',
  hours: 'Monday – Saturday: 10:00 AM – 7:00 PM (PHT)',
  conciergePromise: 'Inquiries answered within 2 hours during atelier hours.',
}
