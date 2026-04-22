'use client'

import Link from 'next/link'
import { ProtectedRoute } from '@/components/protected-route'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { useStore } from '@/lib/store-context'

export default function AccountPage() {
  const { user } = useAuth()
  const { orders } = useStore()

  const userOrders = orders.filter(
    (order) =>
      order.source === 'ONLINE' &&
      order.customerEmail.toLowerCase() === (user?.email ?? '').toLowerCase(),
  )
  const activeOrders = userOrders.filter(
    (order) => order.status !== 'Delivered' && order.status !== 'Cancelled',
  )
  const cancelledOrders = userOrders.filter((order) => order.status === 'Cancelled')

  return (
    <ProtectedRoute requiredRole="USER">
      <StorefrontShell>
        <StorefrontPageHero
          eyebrow="My Account"
          title={user?.name ?? 'Customer Account'}
          description="Review your perfume orders, active shipments, and recent delivery history from one calm account view."
        />

        <section className="px-4 pb-16 pt-2 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-8">
            <article className="storefront-panel rounded-[2rem] p-7 sm:p-9">
              <p className="storefront-eyebrow">Account Details</p>
              <p className="mt-3 text-lg text-foreground/72">{user?.email}</p>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.5rem] bg-muted/30 p-5">
                  <p className="text-sm font-medium text-foreground/55">Orders</p>
                  <p className="mt-2 text-4xl text-foreground">{userOrders.length}</p>
                </div>
                <div className="rounded-[1.5rem] bg-muted/30 p-5">
                  <p className="text-sm font-medium text-foreground/55">Active Orders</p>
                  <p className="mt-2 text-4xl text-foreground">{activeOrders.length}</p>
                </div>
                <div className="rounded-[1.5rem] bg-muted/30 p-5">
                  <p className="text-sm font-medium text-foreground/55">Delivered / Cancelled</p>
                  <p className="mt-2 text-4xl text-foreground">
                    {userOrders.filter((order) => order.status === 'Delivered').length} / {cancelledOrders.length}
                  </p>
                </div>
              </div>

              <div className="mt-8 flex flex-wrap gap-3">
                <Button className="h-11 rounded-2xl bg-primary px-6 text-primary-foreground hover:bg-[#ff8a73]" asChild>
                  <Link href="/orders">Manage Orders</Link>
                </Button>
                <Button variant="outline" className="h-11 rounded-2xl border-border/70 bg-white/70 px-6" asChild>
                  <Link href="/shop">Shop More</Link>
                </Button>
              </div>
            </article>
          </div>
        </section>
      </StorefrontShell>
    </ProtectedRoute>
  )
}
