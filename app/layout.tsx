import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { AuthProvider } from '@/lib/auth-context'
import { CustomerSupportWidget } from '@/components/customer-support-widget'
import { getPublicRuntimeEnv } from '@/lib/server-runtime-env'
import { StoreProvider } from '@/lib/store-context'
import { Toaster } from '@/components/ui/toaster'
import { SITE_DESCRIPTION, SITE_NAME } from '@/lib/site'
import './globals.css'

export const metadata: Metadata = {
  title: `${SITE_NAME} - Luxury Fragrances`,
  description: SITE_DESCRIPTION,
  generator: 'v0.app',
  icons: {
    icon: [
      {
        url: '/icon-light-32x32.png',
        media: '(prefers-color-scheme: light)',
      },
      {
        url: '/icon-dark-32x32.png',
        media: '(prefers-color-scheme: dark)',
      },
      {
        url: '/icon.svg',
        type: 'image/svg+xml',
      },
    ],
    apple: '/apple-icon.png',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#fffaf5',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const publicEnv = getPublicRuntimeEnv()

  return (
    <html lang="en">
      <body className="font-sans antialiased">
        <script
          dangerouslySetInnerHTML={{
            __html: `window.__APP_PUBLIC_ENV__ = ${JSON.stringify(publicEnv)};`,
          }}
        />
        <AuthProvider>
          <StoreProvider>
            {children}
            <CustomerSupportWidget />
            <Toaster />
          </StoreProvider>
        </AuthProvider>
        <Analytics />
      </body>
    </html>
  )
}
