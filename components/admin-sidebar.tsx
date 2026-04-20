'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  BarChart3,
  Boxes,
  LayoutDashboard,
  LogOut,
  Package,
  ReceiptText,
  ShoppingCart,
  TicketPercent,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth, type UserRole } from '@/lib/auth-context'
import { getRoleLabel } from '@/lib/auth'
import { useStore } from '@/lib/store-context'

const adminMenuItems: Array<{
  href: string
  label: string
  icon: typeof LayoutDashboard
  roles: UserRole[]
}> = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['ADMIN', 'STAFF'] },
  { href: '/admin/pos', label: 'POS', icon: ReceiptText, roles: ['ADMIN', 'STAFF'] },
  { href: '/admin/inventory', label: 'Inventory', icon: Boxes, roles: ['ADMIN', 'STAFF'] },
  { href: '/admin/orders', label: 'Orders', icon: ShoppingCart, roles: ['ADMIN', 'STAFF'] },
  { href: '/admin/products', label: 'Products', icon: Package, roles: ['ADMIN', 'STAFF'] },
  { href: '/admin/customers', label: 'Accounts', icon: Users, roles: ['ADMIN'] },
  { href: '/admin/reports', label: 'Reports', icon: BarChart3, roles: ['ADMIN'] },
  { href: '/admin/promotions', label: 'Promotions', icon: TicketPercent, roles: ['ADMIN'] },
]

export function AdminSidebar() {
  const pathname = usePathname()
  const router = useRouter()
  const { logout, user } = useAuth()
  const { isRealtimeRefreshing, lastSyncedAt } = useStore()
  const roleLabel = getRoleLabel(user?.role)
  const visibleItems = adminMenuItems.filter((item) =>
    user ? item.roles.includes(user.role) : false,
  )
  const syncLabel = isRealtimeRefreshing ? 'Syncing' : 'Live'
  const syncTimeLabel = lastSyncedAt
    ? new Date(lastSyncedAt).toLocaleTimeString('en-PH', {
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Waiting'

  return (
    <aside className="hidden lg:flex w-72 bg-sidebar border-r border-sidebar-border flex-col shadow-[24px_0_50px_rgba(183,92,127,0.08)]">
      {/* Sidebar Header */}
      <div className="border-b border-sidebar-border bg-[linear-gradient(145deg,rgba(255,240,246,0.96),rgba(255,251,253,0.9))] p-6">
        <span className="inline-flex rounded-full bg-primary/12 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
          {user?.role === 'STAFF' ? 'Operations Console' : 'Admin Control'}
        </span>
        <h2 className="mt-4 font-serif text-xl text-sidebar-foreground">
          {user?.role === 'STAFF' ? 'Staff Operations' : 'Admin Control Center'}
        </h2>
        <p className="mt-2 text-sm text-sidebar-foreground/60">
          {user?.role === 'STAFF'
            ? 'Orders, inventory, and in-store sales for daily store operations.'
            : 'Catalog, reporting, promotions, and business controls.'}
        </p>
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-sidebar-foreground/50">
          {roleLabel}
        </p>
        <div className="mt-4 flex items-center justify-between rounded-2xl border border-sidebar-border bg-white/75 px-3 py-3">
          <div className="flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-full ${
                isRealtimeRefreshing ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'
              }`}
            />
            <span className="text-sm font-medium text-sidebar-foreground">Supabase {syncLabel}</span>
          </div>
          <span className="text-xs text-sidebar-foreground/55">{syncTimeLabel}</span>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        {visibleItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)
          
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 transition-all ${
                isActive
                  ? 'bg-primary text-primary-foreground shadow-[0_16px_30px_rgba(191,98,133,0.22)]'
                  : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'
              }`}
            >
              <Icon className="w-5 h-5" />
              <span className="font-medium">{item.label}</span>
            </Link>
          )
        })}
      </nav>

      {/* Logout Button */}
      <div className="p-4 border-t border-sidebar-border">
        <Button
          variant="outline"
          className="w-full justify-center gap-2 border-primary/20 bg-white/70 text-primary hover:bg-primary hover:text-primary-foreground"
          onClick={async () => {
            await logout()
            router.push('/admin/login')
          }}
        >
          <LogOut className="w-4 h-4" />
          Logout
        </Button>
      </div>
    </aside>
  )
}
