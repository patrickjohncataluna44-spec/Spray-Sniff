'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth, type UserRole } from '@/lib/auth-context'
import { Spinner } from '@/components/ui/spinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  requiredRole?: UserRole | UserRole[]
  fallbackPath?: string
}

export function ProtectedRoute({
  children,
  requiredRole,
  fallbackPath = '/auth/signin',
}: ProtectedRouteProps) {
  const router = useRouter()
  const { isAuthenticated, canAccessBackoffice, isLoading, user } = useAuth()
  const requiredRoles = Array.isArray(requiredRole)
    ? requiredRole
    : requiredRole
      ? [requiredRole]
      : undefined

  useEffect(() => {
    if (isLoading) return

    if (!isAuthenticated) {
      router.push(fallbackPath)
      return
    }

    if (requiredRoles && user && !requiredRoles.includes(user.role)) {
      router.push(
        user.role === 'USER' ? '/' : canAccessBackoffice ? '/admin/dashboard' : '/',
      )
      return
    }
  }, [canAccessBackoffice, fallbackPath, isAuthenticated, isLoading, requiredRoles, router, user])

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return null
  }

  return <>{children}</>
}
