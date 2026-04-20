'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { LogOut, User, LayoutDashboard } from 'lucide-react'
import { useAuth } from '@/lib/auth-context'
import { getRoleLabel } from '@/lib/auth'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function AuthMenu() {
  const router = useRouter()
  const { user, isAuthenticated, isAdmin, canAccessBackoffice, isLoading, logout } = useAuth()
  const roleLabel = getRoleLabel(user?.role)

  if (isLoading) {
    return null
  }

  if (!isAuthenticated) {
    return (
      <div className="flex gap-1.5 xl:gap-2">
        <Button variant="outline" className="h-11 rounded-2xl border-border/70 bg-white/70 px-4 xl:px-5" asChild>
          <Link href="/auth/signin">Sign In</Link>
        </Button>
        <Button className="h-11 rounded-2xl bg-primary px-4 xl:px-5 text-primary-foreground shadow-[0_12px_28px_rgba(255,154,134,0.34)] hover:bg-[#ff8a73]" asChild>
          <Link href="/auth/signup">Create Account</Link>
        </Button>
      </div>
    )
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-11 rounded-2xl border border-border/70 bg-white/75 px-4 text-foreground shadow-[0_12px_28px_rgba(145,84,73,0.08)] hover:bg-muted">
          <User className="h-4 w-4" />
          <span className="hidden sm:inline text-sm">{user?.name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 rounded-2xl border-border/70 bg-white/95 p-2 shadow-[0_20px_40px_rgba(145,84,73,0.14)]">
        <div className="px-2 py-1.5 text-sm">
          <div className="font-medium">{user?.name}</div>
          <div className="text-xs text-foreground/60">{user?.email}</div>
          <div className="mt-1 text-xs font-semibold text-primary">
            {roleLabel}
          </div>
        </div>
        <DropdownMenuSeparator />

        {!canAccessBackoffice && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/account" className="cursor-pointer">
                <User className="w-4 h-4 mr-2" />
                My Account
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link href="/orders" className="cursor-pointer">
                <User className="w-4 h-4 mr-2" />
                My Orders
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        {canAccessBackoffice && (
          <>
            <DropdownMenuItem asChild>
              <Link href="/admin/dashboard" className="cursor-pointer">
                <LayoutDashboard className="w-4 h-4 mr-2" />
                {isAdmin ? 'Admin Dashboard' : 'Staff Dashboard'}
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
          </>
        )}

        <DropdownMenuItem
          onClick={async () => {
            await logout()
            router.push('/')
          }}
          className="cursor-pointer text-red-600"
        >
          <LogOut className="w-4 h-4 mr-2" />
          Sign Out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
