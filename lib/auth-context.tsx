'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { useEffectEvent } from '@/hooks/use-effect-event'
import { subscribeToUserProfile } from '@/lib/supabase-realtime'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

export type UserRole = 'ADMIN' | 'STAFF' | 'USER'

export interface User {
  id: string
  email: string
  name: string
  role: UserRole
  phone?: string | null
  birthdate?: string | null
  age?: number | null
  address?: string | null
  city?: string | null
  postalCode?: string | null
}

export interface AuthContextType {
  user: User | null
  isAuthenticated: boolean
  isAdmin: boolean
  isStaff: boolean
  canAccessBackoffice: boolean
  isLoading: boolean
  login: (email: string, password: string) => Promise<void>
  signup: (
    email: string,
    password: string,
    name: string,
    extra?: {
      phone?: string
      birthdate?: string
      age?: number
      address?: string
      city?: string
      postalCode?: string
    },
  ) => Promise<{
    requiresEmailVerification: boolean
    email: string
  }>
  updateProfile: (data: {
    name?: string
    phone?: string
    birthdate?: string
    age?: number
    address?: string
    city?: string
    postalCode?: string
  }) => Promise<void>
  resendVerificationEmail: (email: string) => Promise<void>
  logout: () => Promise<void>
}

const AUTH_STORAGE_KEY = 'auth-user'
const AuthContext = createContext<AuthContextType | undefined>(undefined)

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
  try {
    // Sync via server route with service role to avoid client-side RLS 401 errors
    await fetch('/api/auth/profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email, name }),
    }).catch(() => {})
  } catch (err) {
    console.warn('ensureProfile non-blocking error:', err)
  }
}

async function readProfile(
  userId: string,
  fallbackUser?: { email?: string | null; name?: string | null },
): Promise<User> {
  const supabase = getSupabaseBrowserClient()

  // 1. Try with extended fields using limit(1) (never single or maybeSingle to guarantee zero 406 errors)
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, email, name, role, phone, birthdate, age, address, city, postal_code')
      .eq('id', userId)
      .limit(1)

    const row = data?.[0] as
      | {
          id: string
          email: string
          name: string
          role: UserRole
          phone?: string | null
          birthdate?: string | null
          age?: number | null
          address?: string | null
          city?: string | null
          postal_code?: string | null
        }
      | undefined

    if (!error && row) {
      return {
        id: row.id,
        email: row.email,
        name: row.name,
        role: row.role,
        phone: row.phone ?? null,
        birthdate: row.birthdate ?? null,
        age: row.age ?? null,
        address: row.address ?? null,
        city: row.city ?? null,
        postalCode: row.postal_code ?? null,
      }
    }
  } catch (err) {
    console.warn('Extended profile read warning:', err)
  }

  // 2. Try basic columns with limit(1) (never single or maybeSingle)
  try {
    const { data: basicData, error: basicError } = await supabase
      .from('profiles')
      .select('id, email, name, role')
      .eq('id', userId)
      .limit(1)

    const basicRow = basicData?.[0] as User | undefined
    if (!basicError && basicRow) {
      return basicRow
    }
  } catch (err) {
    console.warn('Basic profile read warning:', err)
  }

  // 3. Try fetching from server API route which runs with service role (bypasses RLS)
  try {
    const session = (await supabase.auth.getSession()).data.session
    const response = await fetch('/api/auth/profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
      },
      body: JSON.stringify({
        userId,
        email: fallbackUser?.email ?? undefined,
        name: fallbackUser?.name ?? undefined,
      }),
    })

    if (response.ok) {
      const payload = (await response.json().catch(() => ({}))) as { profile?: User }
      if (payload.profile) {
        return payload.profile
      }
    }
  } catch (err) {
    console.warn('Server profile fetch fallback warning:', err)
  }

  // 4. Safe fallback user object so valid sessions are never wiped to null
  const fallbackEmail = fallbackUser?.email ?? ''
  const fallbackName = fallbackUser?.name ?? fallbackEmail.split('@')[0] ?? 'Customer'

  return {
    id: userId,
    email: fallbackEmail,
    name: fallbackName,
    role: 'USER',
    phone: null,
    birthdate: null,
    age: null,
    address: null,
    city: null,
    postalCode: null,
  }
}

function cacheUser(user: User | null) {
  if (typeof window === 'undefined') {
    return
  }

  try {
    if (!user) {
      localStorage.removeItem(AUTH_STORAGE_KEY)
      return
    }

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user))
  } catch (err) {
    console.warn('Unable to access localStorage for user caching:', err)
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const handleProfileRefresh = useEffectEvent(async (userId: string) => {
    try {
      const profile = await readProfile(userId, { email: user?.email, name: user?.name })
      setUser(profile)
      cacheUser(profile)
    } catch (err) {
      console.warn('Profile refresh warning:', err)
      // Do not clear user to null on transient refresh errors
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
        const profile = await readProfile(sessionUser.id, {
          email: sessionUser.email,
          name,
        })

        if (mounted) {
          setUser(profile)
        }
        cacheUser(profile)
      } catch (err) {
        console.warn('syncFromSession warning:', err)
      } finally {
        if (mounted) {
          setIsLoading(false)
        }
      }
    }

    void syncFromSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      void (async () => {
        try {
          const sessionUser = session?.user

          if (!sessionUser) {
            setUser(null)
            cacheUser(null)
            return
          }

          // Skip redundant profile reads on token refresh to avoid 429 rate limits
          if (event === 'TOKEN_REFRESHED' && user?.id === sessionUser.id) {
            return
          }

          const name =
            typeof sessionUser.user_metadata?.name === 'string'
              ? sessionUser.user_metadata.name
              : sessionUser.email?.split('@')[0] ?? 'Customer'

          await ensureProfile(sessionUser.id, sessionUser.email ?? '', name)
          const profile = await readProfile(sessionUser.id, {
            email: sessionUser.email,
            name,
          })
          setUser(profile)
          cacheUser(profile)
        } catch (err) {
          console.warn('onAuthStateChange profile error:', err)
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
  }, [handleProfileRefresh, user?.id])

  const login = async (email: string, password: string) => {
    setIsLoading(true)
    try {
      const supabase = getSupabaseBrowserClient()
      const normalizedEmail = email.trim().toLowerCase()
      const { data, error } = await supabase.auth.signInWithPassword({
        email: normalizedEmail,
        password,
      })

      if (error) {
        throw new Error(normalizeAuthErrorMessage(error, 'Unable to sign in.'))
      }

      const sessionUser = data.session?.user ?? data.user
      if (sessionUser) {
        const name =
          typeof sessionUser.user_metadata?.name === 'string'
            ? sessionUser.user_metadata.name
            : sessionUser.email?.split('@')[0] ?? 'Customer'

        await ensureProfile(sessionUser.id, sessionUser.email ?? '', name)
        const profile = await readProfile(sessionUser.id, {
          email: sessionUser.email,
          name,
        })

        setUser(profile)
        cacheUser(profile)
      }
    } finally {
      setIsLoading(false)
    }
  }

  const signup = async (
    email: string,
    password: string,
    name: string,
    extra?: {
      phone?: string
      birthdate?: string
      age?: number
      address?: string
      city?: string
      postalCode?: string
    },
  ) => {
    setIsLoading(true)
    try {
      const normalizedEmail = email.trim().toLowerCase()
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: normalizedEmail,
          password,
          name,
          phone: extra?.phone,
          birthdate: extra?.birthdate,
          age: extra?.age,
          address: extra?.address,
          city: extra?.city,
          postalCode: extra?.postalCode,
        }),
      })

      const payload = (await response.json().catch(() => null)) as { error?: string } | null

      if (!response.ok) {
        throw new Error(payload?.error ?? 'Unable to create your account.')
      }

      return {
        requiresEmailVerification: true,
        email: normalizedEmail,
      }
    } finally {
      setIsLoading(false)
    }
  }

  const updateProfile = async (data: {
    name?: string
    phone?: string
    birthdate?: string
    age?: number
    address?: string
    city?: string
    postalCode?: string
  }) => {
    if (!user) {
      throw new Error('You must be signed in to update your profile.')
    }

    const supabase = getSupabaseBrowserClient()
    const updatePayload: Record<string, unknown> = {}

    if (data.name !== undefined) updatePayload.name = data.name.trim()
    if (data.phone !== undefined) updatePayload.phone = data.phone.trim() || null
    if (data.birthdate !== undefined) updatePayload.birthdate = data.birthdate || null
    if (data.age !== undefined) updatePayload.age = data.age ?? null
    if (data.address !== undefined) updatePayload.address = data.address.trim() || null
    if (data.city !== undefined) updatePayload.city = data.city.trim() || null
    if (data.postalCode !== undefined) updatePayload.postal_code = data.postalCode.trim() || null

    const { error } = await supabase
      .from('profiles')
      .update(updatePayload)
      .eq('id', user.id)

    if (error) {
      throw error
    }

    const updated = await readProfile(user.id)
    setUser(updated)
    cacheUser(updated)
  }

  const resendVerificationEmail = async (email: string) => {
    const normalizedEmail = email.trim().toLowerCase()

    if (!normalizedEmail) {
      throw new Error('Enter your email address first.')
    }

    const response = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email: normalizedEmail }),
    })

    const payload = (await response.json().catch(() => null)) as { error?: string } | null

    if (!response.ok) {
      throw new Error(payload?.error ?? 'Unable to resend the verification email.')
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
    updateProfile,
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
