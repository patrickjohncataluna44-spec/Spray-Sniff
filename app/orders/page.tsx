'use client'

import Link from 'next/link'
import { ProtectedRoute } from '@/components/protected-route'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { formatPHP } from '@/lib/currency'
import { useStore } from '@/lib/store-context'

const statusTone: Record<string, string> = {
  Pending: 'bg-[#ffe5de] text-[#b85b48]',
  Processing: 'bg-[#fff0be] text-[#8f6b26]',
  'Ready for Dispatch': 'bg-[#ffe8d9] text-[#9c624d]',
  'Out for Delivery': 'bg-[#ffd6a6] text-[#7d5a1f]',
  Delivered: 'bg-[#e6f4ea] text-[#2f7a4e]',
}

export default function OrdersPage() {
  const { user } = useAuth()
  const { getAvailableStock, orders } = useStore()

  const userOrders = orders.filter(
    (order) =>
      order.source === 'ONLINE' &&
      order.customerEmail.toLowerCase() === (user?.email ?? '').toLowerCase(),
  )

  return (
    <ProtectedRoute requiredRole="USER">
      <StorefrontShell>
        <StorefrontPageHero
          eyebrow="Order History"
          title="My Orders"
          description="Follow each online perfume order from payment through dispatch and delivery, with live item context along the way."
        />

        <section className="px-4 pb-16 pt-2 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            {userOrders.length === 0 ? (
              <div className="storefront-panel rounded-[2rem] p-12 text-center">
                <p className="text-2xl text-foreground">No online orders are linked to {user?.email} yet.</p>
                <Button className="mt-6 h-11 rounded-2xl bg-primary px-6 text-primary-foreground hover:bg-[#ff8a73]" asChild>
                  <Link href="/shop">Browse Perfumes</Link>
                </Button>
              </div>
            ) : (
              <div className="space-y-6">
                {userOrders.map((order) => (
                  <article key={order.id} className="storefront-panel rounded-[2rem] p-6 sm:p-8">
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <p className="storefront-eyebrow">{order.id}</p>
                        <h2 className="mt-3 text-3xl text-foreground">{order.status}</h2>
                        <p className="mt-2 text-sm text-foreground/55">
                          Placed on {new Date(order.createdAt).toLocaleString()}
                        </p>
                      </div>

                      <div className="md:text-right">
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                            statusTone[order.status] ?? 'bg-muted text-foreground'
                          }`}
                        >
                          {order.status}
                        </span>
                        <p className="mt-3 text-sm text-foreground/60">
                          Total: <span className="font-semibold text-foreground">{formatPHP(order.total)}</span>
                        </p>
                      </div>
                    </div>

                    <div className="mt-8 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/48">
                          Tracking Timeline
                        </h3>
                        {order.timeline.map((entry) => (
                          <div
                            key={`${order.id}-${entry.status}-${entry.createdAt}`}
                            className="rounded-[1.5rem] bg-muted/28 p-4"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <p className="font-semibold text-foreground">{entry.status}</p>
                              <p className="text-xs text-foreground/48">
                                {new Date(entry.createdAt).toLocaleString()}
                              </p>
                            </div>
                            <p className="mt-2 text-sm leading-7 text-foreground/62">{entry.note}</p>
                          </div>
                        ))}
                      </div>

                      <div className="space-y-4">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/48">
                          Ordered Items
                        </h3>
                        {order.items.map((item) => (
                          <div
                            key={`${order.id}-${item.productId}-${item.size}`}
                            className="rounded-[1.5rem] bg-muted/28 p-4"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <p className="font-semibold text-foreground">{item.productName}</p>
                              <p className="text-sm text-foreground/55">
                                {item.quantity} x {item.size}ml
                              </p>
                            </div>
                            <p className="mt-2 text-sm text-foreground/58">
                              Current store availability: {getAvailableStock(item.productId)} unit(s)
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </StorefrontShell>
    </ProtectedRoute>
  )
}
