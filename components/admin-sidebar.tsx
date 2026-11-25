'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  Boxes,
  Home,
  LayoutDashboard,
  LifeBuoy,
  LogOut,
  Menu,
  Package,
  ReceiptText,
  ShoppingBag,
  TicketPercent,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth, type UserRole } from '@/lib/auth-context'
import { getRoleLabel } from '@/lib/auth'
import { useStore } from '@/lib/store-context'
import { SITE_NAME } from '@/lib/site'

const adminMenuItems: Array<{
  href: string
  label: string
  icon: typeof LayoutDashboard
  roles: UserRole[]
  badgeKey?: 'orders' | 'inventory'
}> = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'STAFF'] },
  { href: '/admin/products', label: 'Products', icon: Package, roles: ['ADMIN', 'STAFF'] },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingBag, roles: ['ADMIN', 'STAFF'], badgeKey: 'orders' },
  { href: '/admin/customers', label: 'Customers', icon: Users, roles: ['ADMIN'] },
  { href: '/admin/reports', label: 'Analytics', icon: BarChart3, roles: ['ADMIN'] },
  { href: '/admin/pos', label: 'POS Terminal', icon: ReceiptText, roles: ['ADMIN', 'STAFF'] },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes, roles: ['ADMIN', 'STAFF'], badgeKey: 'inventory' },
  { href: '/admin/promotions', label: 'Discounts', icon: TicketPercent, roles: ['ADMIN'] },
  { href: '/admin/support', label: 'Support', icon: LifeBuoy, roles: ['ADMIN', 'STAFF'] },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const [mobileOpen, setMobileOpen] = useState(false)
  const { logout, user } = useAuth()
  const { inventory, isRealtimeRefreshing, lastSyncedAt, orders } = useStore()
  const roleLabel = getRoleLabel(user?.role)
  const visibleItems = adminMenuItems.filter((item) =>
    user ? item.roles.includes(user.role) : false,
  )

  const pendingOrdersCount = orders.filter(
    (order) => order.status === 'Pending' || order.status === 'Processing',
  ).length

  const activeInventory = inventory.filter((item) => !item.isArchived)
  const lowStockCount = activeInventory.filter(
    (item) => item.stock > 0 && item.stock <= item.reorderPoint,
  ).length
  const outOfStockCount = activeInventory.filter((item) => item.stock === 0).length
  const totalStockAlerts = lowStockCount + outOfStockCount

  const syncLabel = isRealtimeRefreshing ? 'Syncing...' : 'Live'

  // Close the mobile drawer when navigating to another admin page
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  return (
    <>
      {/* Mobile top bar with sidebar toggle */}
      <div data-ui="admin-mobile-topbar" className="lg:hidden fixed top-0 inset-x-0 z-50 flex h-14 items-center justify-between border-b border-border bg-card px-4">
        <button
          type="button"
          aria-label="Open admin menu"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-background text-foreground hover:bg-muted"
        >
          <Menu className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-2">
          <span className="font-serif font-bold tracking-tight text-foreground">{SITE_NAME}</span>
          <span className="text-xs text-muted-foreground">Studio</span>
        </div>
        <div className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className={`h-2 w-2 rounded-full ${isRealtimeRefreshing ? 'bg-amber-500' : 'bg-emerald-500'}`} />
          <span>{syncLabel}</span>
        </div>
      </div>

      {/* Backdrop when the drawer is open */}
      {mobileOpen && (
        <div
          role="presentation"
          onClick={() => setMobileOpen(false)}
          className="lg:hidden fixed inset-0 z-40 bg-black/40"
        />
      )}

      <aside
        data-ui="admin-sidebar"
        className={`${
          mobileOpen ? 'flex fixed inset-y-0 left-0 z-50' : 'hidden'
        } lg:flex lg:sticky lg:top-0 lg:h-[100dvh] w-64 shrink-0 bg-[#FDFBF9] border-r border-[#EFEAE6] flex-col justify-between`}
      >
        {/* Brand Header */}
        <div>
          <div className="p-6 pb-5 flex items-center justify-between">
            <Link href="/admin/dashboard" className="block group">
              <span className="font-serif text-2xl font-bold tracking-tight text-[#2D1B22] block leading-tight">
                {SITE_NAME}
              </span>
              <span className="text-xs text-[#8E7881] font-normal tracking-wide block mt-0.5">
                Fragrance Studio
              </span>
            </Link>
            <button
              type="button"
              aria-label="Close admin menu"
              onClick={() => setMobileOpen(false)}
              className="lg:hidden inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="px-3 space-y-1">
            {visibleItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || (item.href !== '/admin/dashboard' && pathname.startsWith(item.href))
              
              let badgeCount: number | null = null
              if (item.badgeKey === 'orders' && pendingOrdersCount > 0) {
                badgeCount = pendingOrdersCount
              } else if (item.badgeKey === 'inventory' && totalStockAlerts > 0) {
                badgeCount = totalStockAlerts
              }

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-[#4A1521] text-white shadow-none font-medium'
                      : 'text-[#5C4A52] hover:bg-[#F5ECE8] hover:text-[#2D1B22]'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : 'text-[#7D6B73]'}`} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {badgeCount !== null && (
                    <span
                      className={`inline-flex items-center justify-center min-w-[20px] h-5 px-1.5 text-[11px] font-semibold rounded-full ${
                        isActive
                          ? 'bg-[#E03A58] text-white'
                          : 'bg-[#E03A58] text-white'
                      }`}
                    >
                      {badgeCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Bottom Section: Quick Actions & Logout */}
        <div className="p-4 space-y-1">
          <Link
            href="/"
            className="flex items-center gap-3 px-3 py-2 text-xs font-medium text-[#6B575F] hover:text-[#2D1B22] rounded-lg hover:bg-[#F5ECE8] transition-colors"
          >
            <Home className="w-4 h-4 text-[#8E7B83]" />
            <span>Visit Storefront</span>
          </Link>
          <button
            type="button"
            onClick={async () => {
              await logout()
              router.push('/admin/login')
            }}
            className="w-full flex items-center gap-3 px-3 py-2 text-xs font-medium text-[#6B575F] hover:text-[#B91C1C] rounded-lg hover:bg-rose-50 transition-colors text-left"
          >
            <LogOut className="w-4 h-4 text-[#8E7B83]" />
            <span>Log Out</span>
          </button>
        </div>
      </aside>
    </>
  )
}
