# SPRAY & SNIFF - Luxury Fragrance eCommerce Platform

A complete luxury fragrance eCommerce platform built with Next.js, featuring both customer-facing and admin-facing experiences.

## Features

### Customer Experience
- **Homepage & Collections**: Discover featured fragrances and curated collections
- **Product Browsing**: Advanced filtering by scent family, gender, price, and more
- **Product Details**: Detailed scent profiles with notes breakdown, intensity/longevity indicators
- **Shopping Cart**: Full cart management with quantity control
- **Checkout**: Multi-step checkout with shipping, billing, and payment
- **Wishlist**: Save favorite fragrances for later
- **Authentication**: Sign in/Sign up pages
- **Account Management**: User profiles and order tracking
- **Discovery Quiz**: Personalized fragrance recommendations
- **Support**: FAQ and contact pages

### Admin Experience
- **Dashboard**: Overview of sales, orders, customers, and performance KPIs
- **Products Management**: Create, edit, and manage product listings
- **Inventory Management**: Track stock levels and manage availability
- **Orders Management**: Process and track customer orders
- **Customer Management**: View customer profiles and purchase history
- **Promotions**: Create and manage discount codes and campaigns
- **Collections**: Manage product collections and categories
- **Analytics**: Sales trends and performance metrics (template included)

## Design System

### Color Palette
- **Primary**: Warm Gold/Rose (#b89968) - Accent color for CTAs and highlights
- **Neutral**: Warm Taupes & Creams - Sophisticated background and text
- **Dark**: Deep Charcoal (#332d29) - Primary text color
- **Light**: Creamy Ivory (#faf8f5) - Main background

### Typography
- **Headings**: Playfair Display (Serif) - Elegant luxury feel
- **Body**: Geist (Sans-serif) - Clean, readable text

### Components
- Built with Radix UI and shadcn/ui
- Responsive design with Tailwind CSS
- Smooth animations for luxury aesthetic

## Project Structure

```
app/
├── page.tsx                      # Homepage
├── about/page.tsx               # About page
├── collections/page.tsx         # Collections listing
├── shop/page.tsx                # Product shop with filters
├── products/[id]/page.tsx       # Product detail page
├── cart/page.tsx                # Shopping cart
├── checkout/page.tsx            # Checkout flow
├── wishlist/page.tsx            # Saved favorites
├── auth/
│   ├── signin/page.tsx          # Sign in
│   └── signup/page.tsx          # Sign up
├── help/
│   └── faq/page.tsx             # FAQ
├── admin/
│   ├── login/page.tsx           # Admin login
│   ├── dashboard/page.tsx       # Main dashboard
│   ├── products/page.tsx        # Product management
│   ├── orders/page.tsx          # Order management
│   ├── customers/page.tsx       # Customer management
│   └── promotions/page.tsx      # Promotions management
├── layout.tsx                   # Root layout
└── globals.css                  # Global styles

components/
├── header.tsx                   # Navigation header
├── product-card.tsx             # Product card component
└── ui/                          # shadcn/ui components

lib/
└── products.ts                  # Product data and utilities

public/
├── hero-banner.jpg              # Hero image
└── products/                    # Product images
```

## Getting Started

### Prerequisites
- Node.js 18+ 
- pnpm (or npm/yarn)

### Installation

1. Clone or download the project
2. Install dependencies:
```bash
npm install
```

3. Create your local environment file and add your real credentials:
```bash
copy .env.example .env.local
```

Required variables:
```env
NEXT_PUBLIC_SITE_URL=https://sprayandsniff.vercel.app

NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

PAYMONGO_SECRET_KEY=sk_live_your_paymongo_secret_key
NEXT_PUBLIC_PAYMONGO_PUBLIC_KEY=pk_live_your_paymongo_public_key

SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your_store_email@gmail.com
SMTP_PASS=your_gmail_app_password
SMTP_FROM="Spray & Sniff <your_store_email@gmail.com>"
```

4. In Supabase, open the SQL Editor and run:
```sql
-- paste the full contents of supabase/schema.sql
```

This creates:
- `profiles`
- `app_store_snapshots`
- `user_carts`
- `user_wishlists`
- `promotions`

5. Start the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) to view the app

## Supabase Setup

This project is already wired to Supabase for:
- Auth with email/password
- Email verification before sign-in
- User profiles
- Shared store snapshot data
- Per-user carts
- Per-user wishlists
- Promotions
- Realtime subscriptions for backoffice store data, admin promotions, user carts, user wishlists, and profile role updates

### Supabase CLI Workflow

This repo now includes:
- `supabase/config.toml`
- `supabase/migrations/20260414103353_new-migration.sql`
- `supabase/schema.sql`

To link and push with the Supabase CLI:

```bash
npx supabase link --project-ref axnbkdaooluehoxtduke
npx supabase db push
```

If you want another migration later:

```bash
npx supabase migration new your-migration-name
```

### First Admin User

New signups are created as `USER` by default. To promote your account to admin after signing up, run this in the Supabase SQL Editor:

```sql
update public.profiles
set role = 'ADMIN'
where email = 'your-email@example.com';
```

### Data Model

- `public.profiles`: user identity, display name, role
- `public.app_store_snapshots`: shared catalog, inventory, orders, reports state
- `public.user_carts`: each signed-in user's cart
- `public.user_wishlists`: each signed-in user's saved products
- `public.promotions`: admin-managed promo codes

### Important Notes

- The browser uses the Supabase anon key for auth/session handling.
- Server routes use the Supabase service role key for trusted writes.
- The first app load seeds the store snapshot and starter promotions automatically if the tables are empty.
- Realtime relies on the publication and RLS policies defined in `supabase/schema.sql` and the migration file.
- Hosted Supabase projects do not read your local `supabase/config.toml` automatically. In the Supabase dashboard, turn on `Confirm email` and configure Custom SMTP with the same Gmail SMTP values.
- For deployed email verification, set `NEXT_PUBLIC_SITE_URL` to your production domain on Vercel and in your local env when needed.
- In Supabase Auth URL Configuration, set the Site URL to `https://sprayandsniff.vercel.app` and allow your deployed sign-in redirect URL there as well.
- If you change `.env` or `.env.local`, restart the Next.js server.

### Building for Production

```bash
pnpm build
pnpm start
```

## Key Pages & Routes

### Customer Routes
- `/` - Homepage
- `/about` - Brand story
- `/collections` - Collections listing
- `/shop` - Product shop with filtering
- `/products/[id]` - Product detail
- `/cart` - Shopping cart
- `/checkout` - Checkout process
- `/wishlist` - Wishlist
- `/auth/signin` - Sign in
- `/auth/signup` - Sign up
- `/help/faq` - FAQ

### Admin Routes
- `/admin/login` - Admin login
- `/admin/dashboard` - Dashboard
- `/admin/products` - Product management
- `/admin/orders` - Order management
- `/admin/customers` - Customer management
- `/admin/promotions` - Promotions

## Authentication

- Customer sign-up: `/auth/signup`
- Customer sign-in: `/auth/signin`
- Admin sign-in uses the same Supabase account system at `/admin/login`
- Access to admin pages depends on the `role` value in `public.profiles`

## Sample Data

The project includes 8 premium fragrance products with:
- Multiple sizes and pricing
- Detailed scent profiles (top, heart, base notes)
- Ratings and reviews
- Gender and occasion tags
- Longevity and intensity indicators
- Related product recommendations

## Customization

### Adding Products
Edit `lib/products.ts` to add more fragrances:
```typescript
{
  id: 'unique-id',
  name: 'Fragrance Name',
  brand: 'SPRAY & SNIFF',
  description: 'Description',
  price: 185,
  // ... other properties
}
```

### Updating Colors
Edit the design tokens in `app/globals.css`:
```css
:root {
  --primary: oklch(0.7 0.12 45); /* Warm gold */
  --background: oklch(0.99 0.01 50); /* Creamy ivory */
  /* ... other colors */
}
```

### Modifying Layout
The layout structure is in `components/header.tsx` and can be customized with your branding and navigation.

## Technologies Used

- **Framework**: Next.js 16 with App Router
- **Styling**: Tailwind CSS 4.2
- **UI Components**: Radix UI + shadcn/ui
- **Forms**: React Hook Form with Zod validation
- **Icons**: Lucide React
- **Database**: Supabase-backed store, cart, wishlist, promotions, and profiles
- **Authentication**: Supabase Auth with profile syncing
- **Payments**: PayMongo Checkout API for QR Ph and GCash flows

## Integration Ready

This platform is built with:
- **Authentication**: Supabase Auth
- **Database**: Supabase PostgreSQL
- **Payments**: PayMongo Checkout API
- **Email**: SendGrid, Mailgun, or similar
- **Images**: Vercel Blob or any CDN
- **Analytics**: Vercel Analytics, Google Analytics

## Performance Features

- Image optimization with Next.js Image component
- Responsive design mobile-first approach
- Smooth animations and transitions
- Accessible components with proper ARIA labels
- SEO-optimized metadata

## License

Created with v0.app

## Support

For questions or issues, please contact support or check the FAQ page in the application.
