'use client'

import React, { createContext, useContext, useEffect, useEffectEvent, useState } from 'react'
import { subscribeToUserProfile } from '@/lib/supabase-realtime'
import { getOptionalPublicBrowserEnv, getSupabaseBrowserClient } from '@/lib/supabase-browser'

export type UserRole = 'ADMIN' | 'STAFF' | 'USER'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
}

export interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isAdmin: boolean
  isStaff: boolean
  canAccessBackoffice: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (email: string, password: string, name: string) => Promise<{
    requiresEmailVerification: boolean
    email: string
  }>
  resendVerificationEmail: (email: string) => Promise<void>
  logout: () => Promise<void>
}

const AUTH_STORAGE_KEY = 'auth-user'
const AuthContext = createContext<AuthContextType | undefined>(undefined)

function getEmailRedirectTo() {
  const configuredSiteUrl = getOptionalPublicBrowserEnv('NEXT_PUBLIC_SITE_URL')

  if (configuredSiteUrl) {
    try {
      return new URL('/auth/signin?verified=1', configuredSiteUrl).toString()
    } catch {
      // Ignore invalid configured URLs and fall back to the current origin.
    }
  }

  if (typeof window === 'undefined') {
    return undefined
  }

  return new URL('/auth/signin?verified=1', window.location.origin).toString()
}

function normalizeAuthErrorMessage(error: unknown, fallback: string) {
  if (!(error instanceof Error)) {
    return fallback
  }

  const message = error.message.trim()
  const lowerMessage = message.toLowerCase()

  if (
    lowerMessage.includes('email not confirmed') ||
    lowerMessage.includes('email_not_confirmed') ||
    lowerMessage.includes('not confirmed')
  ) {
    return 'Please verify your email before signing in.'
  }

  if (lowerMessage.includes('invalid login credentials')) {
    return 'Incorrect email or password.'
  }

  return message || fallback
}

async function ensureProfile(userId: string, email: string, name: string) {
  const supabase = getSupabaseBrowserClient()

  await supabase.from('profiles').upsert(
    {
      id: userId,
      email,
      name,
    },
    {
      onConflict: 'id',
    },
  )
}

async function readProfile(userId: string) {
  const supabase = getSupabaseBrowserClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role')
    .eq('id', userId)
    .single()

  if (error) {
    throw error
  }

  return data as User
}

function cacheUser(user: User | null) {
  if (typeof window === 'undefined') {
    return
  }

  if (!user) {
    localStorage.removeItem(AUTH_STORAGE_KEY)
    return
  }

  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const handleProfileRefresh = useEffectEvent(async (userId: string) => {
    try {
      const profile = await readProfile(userId)
      setUser(profile)
      cacheUser(profile)
    } catch {
      setUser(null)
      cacheUser(null)
    }
  })

  useEffect(() => {
    let mounted = true
    const supabase = getSupabaseBrowserClient()

    const syncFromSession = async () => {
      try {
        const { data, error } = await supabase.auth.getSession()

        if (error) {
          throw error
        }

        const sessionUser = data.session?.user

        if (!sessionUser) {
          if (mounted) {
            setUser(null)
          }
          cacheUser(null)
          return
        }

        const name =
          typeof sessionUser.user_metadata?.name === 'string'
            ? sessionUser.user_metadata.name
            : sessionUser.email?.split('@')[0] ?? 'Customer'

        await ensureProfile(sessionUser.id, sessionUser.email ?? '', name)
        const profile = await readProfile(sessionUser.id)

        if (mounted) {
          setUser(profile)
        }
        cacheUser(profile)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void syncFromSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      void (async () => {
        try {
          const sessionUser = session?.user

          if (!sessionUser) {
            setUser(null)
            cacheUser(null)
            return
          }

          const name =
            typeof sessionUser.user_metadata?.name === 'string'
              ? sessionUser.user_metadata.name
              : sessionUser.email?.split('@')[0] ?? 'Customer'

          await ensureProfile(sessionUser.id, sessionUser.email ?? '', name)
          const profile = await readProfile(sessionUser.id)
          setUser(profile)
          cacheUser(profile)
        } catch {
          setUser(null)
          cacheUser(null)
        }
      })()
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!user?.id) {
      return
    }

    return subscribeToUserProfile(user.id, () => {
      void handleProfileRefresh(user.id)
    })
  }, [user?.id])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.signInWithPassword({
        email: email.trim().toLowerCase(),
        password,
      })

      if (error) {
        throw new Error(normalizeAuthErrorMessage(error, 'Unable to sign in.'))
      }
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (email: string, password: string, name: string) => {
    setIsLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const normalizedEmail = email.trim().toLowerCase()
      const { data, error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: { name },
          emailRedirectTo: getEmailRedirectTo(),
        },
      })

      if (error) {
        throw new Error(normalizeAuthErrorMessage(error, 'Unable to create your account.'))
      }

      return {
        requiresEmailVerification: !data.session,
        email: normalizedEmail,
      }
    } finally {
      setIsLoading(false)
    }
  }

  const resendVerificationEmail = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      throw new Error('Enter your email address first.')
    }

    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: normalizedEmail,
      options: {
        emailRedirectTo: getEmailRedirectTo(),
      },
    })

    if (error) {
      throw new Error(normalizeAuthErrorMessage(error, 'Unable to resend the verification email.'))
    }
  }

  const logout = async () => {
    setIsLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const { error } = await supabase.auth.signOut()

      if (error) {
        throw error
      }

      setUser(null)
      cacheUser(null)
    } finally {
      setIsLoading(false)
    }
  }

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
    isAdmin: user?.role === 'ADMIN',
    isStaff: user?.role === 'STAFF',
    canAccessBackoffice: user?.role === 'ADMIN' || user?.role === 'STAFF',
    isLoading,
    login,
    signup,
    resendVerificationEmail,
    logout,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
