import type { UserRole } from './auth-context'

export interface AuthUser {
  id: string
  email: string
  name: string
  role: UserRole
}

/**
 * Allow only internal app redirects such as "/checkout".
 */
export function getSafeRedirectPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) {
    return null
  }

  return value
}

export function getRoleLabel(role: UserRole | null | undefined): string {
  if (role === 'ADMIN') {
    return 'Admin'
  }

  if (role === 'STAFF') {
    return 'Staff'
  }

  return 'Customer'
}

/**
 * Get auth user from localStorage
 */
export function getAuthUser(): AuthUser | null {
  if (typeof window === 'undefined') return null

  const stored = localStorage.getItem('auth-user')
  if (!stored) return null

  try {
    return JSON.parse(stored)
  } catch {
    return null
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return getAuthUser() !== null
}

/**
 * Check if user is admin
 */
export function isAdmin(): boolean {
  const user = getAuthUser()
  return user?.role === 'ADMIN'
}

/**
 * Check if user is staff
 */
export function isStaff(): boolean {
  const user = getAuthUser()
  return user?.role === 'STAFF'
}

/**
 * Check if user can access backoffice tools
 */
export function canAccessBackoffice(): boolean {
  const user = getAuthUser()
  return user?.role === 'ADMIN' || user?.role === 'STAFF'
}

/**
 * Check if user has required role
 */
export function hasRole(role: UserRole): boolean {
  const user = getAuthUser()
  return user?.role === role
}

/**
 * Get current user email
 */
export function getCurrentEmail(): string | null {
  return getAuthUser()?.email || null
}

/**
 * Clear auth session
 */
export function clearAuth(): void {
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth-user')
  }
}
