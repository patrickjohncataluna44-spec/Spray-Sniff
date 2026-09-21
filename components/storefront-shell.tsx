import type { ReactNode } from 'react'
import { Header } from '@/components/header'
import { StorefrontFooter } from '@/components/storefront-footer'

interface StorefrontShellProps {
  children: ReactNode
}

export function StorefrontShell({ children }: StorefrontShellProps) {
  return (
    <div className="storefront-page min-h-screen pb-16 md:pb-0">
      <Header />
      <main>{children}</main>
      <StorefrontFooter />
    </div>
  )
}
