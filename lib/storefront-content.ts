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
  name: string
  role: string
  quote: string
}

export type StorefrontJournalEntry = {
  title: string
  excerpt: string
  image: string
  imageAlt: string
  label: string
  date: string
  href: string
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
  { label: 'Reviews', href: '#reviews', kind: 'anchor' },
  { label: 'Journal', href: '#journal', kind: 'anchor' },
  { label: 'Contact', href: '#contact', kind: 'anchor' },
]

export const HOME_BENEFITS: StorefrontBenefit[] = [
  {
    id: 'craft',
    title: 'Long-Wear Blends',
    description:
      'Each bottle is chosen for a polished scent trail that stays elegant from first spray to late evening.',
  },
  {
    id: 'notes',
    title: 'Curated Scent Families',
    description:
      'Shop floral, woody, fresh, oriental, and citrus profiles with note breakdowns that make choosing easier.',
  },
  {
    id: 'gifting',
    title: 'Gift-Ready Picks',
    description:
      'Our featured collections are easy to gift, easy to layer into a wardrobe, and easy to wear every day.',
  },
  {
    id: 'delivery',
    title: 'Fast Fragrance Dispatch',
    description:
      'From quick shipping updates to clear order tracking, the full experience stays smooth after checkout.',
  },
]

export const HOME_TESTIMONIALS: StorefrontTestimonial[] = [
  {
    name: 'Iris M.',
    role: 'Signature-scent collector',
    quote:
      'I wanted a perfume wardrobe that felt refined without being overwhelming. Spray & Sniff made it easy to discover scents that actually match my day-to-day style.',
  },
  {
    name: 'Daniel R.',
    role: 'Evening fragrance buyer',
    quote:
      'The note breakdowns and scent families helped me shop with confidence. My order arrived quickly, and the fragrance wore beautifully through dinner and late-night events.',
  },
  {
    name: 'Camille T.',
    role: 'Gift shopper',
    quote:
      'I ordered a bottle as a gift and ended up buying one for myself too. The site feels premium, and the recommendations are genuinely useful for perfume-only shopping.',
  },
]

export const HOME_JOURNAL_ENTRIES: StorefrontJournalEntry[] = [
  {
    title: 'How To Build A Perfume Wardrobe For Day, Date Night, And Special Events',
    excerpt:
      'A simple approach to choosing bottles that work across casual mornings, polished office days, and evening plans.',
    image: '/collections/timeless-classics-banner.jpg',
    imageAlt: 'Perfume bottles from the Timeless Classics collection',
    label: 'Scent Styling',
    date: 'April 2026',
    href: '/collections',
  },
  {
    title: 'Understanding Top, Heart, And Base Notes Before You Buy',
    excerpt:
      'Learn what each perfume note layer does so you can shop fragrance profiles with more confidence.',
    image: '/collections/fresh-essence-banner.jpg',
    imageAlt: 'Fresh perfume collection banner',
    label: 'Fragrance Basics',
    date: 'April 2026',
    href: '/discovery',
  },
  {
    title: 'Warm, Fresh, Or Floral: Choosing A Signature Scent That Feels Like You',
    excerpt:
      'Use mood, season, and intensity to narrow down the perfume styles that fit your wardrobe and routine.',
    image: '/collections/evening-elegance-banner.jpg',
    imageAlt: 'Evening Elegance perfume collection banner',
    label: 'Buying Guide',
    date: 'April 2026',
    href: '/shop',
  },
]

export const STOREFRONT_FOOTER_GROUPS: StorefrontFooterGroup[] = [
  {
    title: 'Shop',
    links: [
      { label: 'All Fragrances', href: '/shop' },
      { label: 'Collections', href: '/collections' },
      { label: 'Discovery Quiz', href: '/discovery' },
    ],
  },
  {
    title: 'Customer Care',
    links: [
      { label: 'My Account', href: '/account' },
      { label: 'Track Orders', href: '/orders' },
      { label: 'FAQ', href: '/help/faq' },
    ],
  },
  {
    title: 'Brand',
    links: [
      { label: 'About Us', href: '/about' },
      { label: 'Reviews', href: '/#reviews' },
      { label: 'Journal', href: '/#journal' },
    ],
  },
]

export const STOREFRONT_CONTACT_DETAILS = {
  location: 'Mabini fragrance boutique',
  email: ADMIN_EMAIL,
  hours: 'Mon-Sat, 10:00 AM - 7:00 PM',
}

export const STOREFRONT_NEWSLETTER = {
  eyebrow: 'Perfume Circle',
  title: `Join The ${SITE_NAME} List`,
  description:
    'Receive fragrance launches, curated scent edits, and perfume gifting ideas in a warm editorial format.',
}
