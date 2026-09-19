'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthPageShell } from '@/components/auth-page-shell'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { SITE_NAME } from '@/lib/site'
import { CheckCircle2, KeyRound, ArrowLeft } from 'lucide-react'

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  if (!token) {
    return (
      <div className="space-y-4 text-center">
        <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-6 text-sm text-red-700">
          <p className="font-semibold">Invalid or missing reset token.</p>
          <p className="mt-1">Please request a fresh password reset link from the sign-in page.</p>
        </div>
        <Button asChild className="rounded-2xl">
          <Link href="/auth/signin">Back to Sign In</Link>
        </Button>
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters long.')
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update password.')
      }

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update password.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="space-y-5 text-center py-4">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-2xl font-serif text-foreground">Password Reset Complete</h2>
        <p className="text-sm leading-relaxed text-foreground/70">
          Your password has been securely updated. You can now sign in with your new credentials.
        </p>
        <Button asChild className="w-full h-12 rounded-2xl bg-primary text-primary-foreground hover:bg-[#ff8a73]">
          <Link href="/auth/signin">Go to Sign In</Link>
        </Button>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {error ? (
        <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-4">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      ) : null}

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-foreground">
          New Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
          placeholder="At least 6 characters"
          className="storefront-input h-12 w-full"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
          Confirm New Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
          autoComplete="new-password"
          placeholder="Re-type new password"
          className="storefront-input h-12 w-full"
        />
      </div>

      <Button
        type="submit"
        disabled={loading}
        className="h-12 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-[#ff8a73]"
      >
        {loading ? (
          <span className="inline-flex items-center gap-2">
            <Spinner className="h-4 w-4" />
            Updating Password...
          </span>
        ) : (
          'Update Password'
        )}
      </Button>

      <div className="pt-2 text-center">
        <Link
          href="/auth/signin"
          className="inline-flex items-center gap-1.5 text-xs text-foreground/60 hover:text-primary"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Sign In
        </Link>
      </div>
    </form>
  )
}

export default function ResetPasswordPage() {
  return (
    <AuthPageShell>
      <section className="w-full">
        <div className="mx-auto max-w-md">
          <article className="storefront-panel rounded-[2.25rem] px-6 py-8 sm:px-10 sm:py-10 space-y-6">
            <div className="text-center space-y-2">
              <div className="mx-auto inline-flex p-3 rounded-2xl bg-primary/10 text-primary">
                <KeyRound className="h-6 w-6" />
              </div>
              <h1 className="text-3xl font-serif text-foreground">Set New Password</h1>
              <p className="text-sm text-foreground/60">
                Choose a strong password with at least 6 characters to secure your account.
              </p>
            </div>

            <Suspense
              fallback={
                <div className="py-8 text-center text-sm text-foreground/60">
                  <Spinner className="h-5 w-5 mx-auto mb-2" />
                  Loading...
                </div>
              }
            >
              <ResetPasswordForm />
            </Suspense>
          </article>
        </div>
      </section>
    </AuthPageShell>
  )
}
