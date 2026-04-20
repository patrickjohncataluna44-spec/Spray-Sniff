'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { Spinner } from '@/components/ui/spinner'
import { SITE_NAME } from '@/lib/site'

export default function AdminLoginPage() {
  const router = useRouter()
  const { login, isAuthenticated, canAccessBackoffice, isLoading: authLoading } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Redirect if already logged in
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      if (canAccessBackoffice) {
        router.push('/admin/dashboard')
      } else {
        router.push('/')
      }
    }
  }, [authLoading, canAccessBackoffice, isAuthenticated, router])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    setLoading(true)
    try {
      await login(email, password)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 sm:px-6 lg:px-8">
      <div className="w-full max-w-md space-y-8">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="font-serif text-4xl text-foreground">
            {SITE_NAME} Operations
          </h1>
          <p className="text-foreground/60">
            Sign in to manage your store operations
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}

        {/* Access Guidance */}
        <div className="p-4 bg-muted rounded-lg">
          <p className="text-sm font-medium text-foreground mb-2">Store Access:</p>
          <p className="text-xs text-foreground/70">
            Sign in with a Supabase Auth account whose profile role is set to `ADMIN` or `STAFF`.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 bg-card rounded-lg p-8 border border-border">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-foreground mb-2">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              suppressHydrationWarning
              required
              placeholder="staff@yourstore.com"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-foreground mb-2">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              suppressHydrationWarning
              required
              placeholder="••••••••"
              className="w-full px-4 py-3 bg-background border border-border rounded-lg text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent"
            />
          </div>

          <Button
            type="submit"
            disabled={loading || authLoading}
            className="w-full bg-accent hover:bg-accent/90 text-accent-foreground flex items-center justify-center gap-2"
            size="lg"
          >
            {loading && <Spinner className="w-4 h-4" />}
            {loading ? 'Signing in...' : 'Sign In to Operations'}
          </Button>
        </form>

        {/* Role Note */}
        <div className="bg-muted rounded-lg p-4 space-y-2">
          <p className="text-xs font-medium text-foreground/60 uppercase">Role Note</p>
          <p className="text-sm text-foreground/70">
            Customer accounts can sign in on the storefront, but only `ADMIN` and `STAFF` profiles can open operations tools.
          </p>
        </div>
      </div>
    </div>
  )
}
