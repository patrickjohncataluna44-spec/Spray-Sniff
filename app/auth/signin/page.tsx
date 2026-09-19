'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { AuthPageShell } from '@/components/auth-page-shell'
import { Button } from '@/components/ui/button'
import { Spinner } from '@/components/ui/spinner'
import { useAuth } from '@/lib/auth-context'
import { getSafeRedirectPath } from '@/lib/auth'
import { SITE_NAME } from '@/lib/site'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { KeyRound, Mail, CheckCircle2 } from 'lucide-react'

function SignInPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { login, resendVerificationEmail, isAuthenticated, canAccessBackoffice, isLoading: authLoading } =
    useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [error, setError] = useState('')
  const [infoMessage, setInfoMessage] = useState('')
  const [needsVerification, setNeedsVerification] = useState(false)

  // Forgot password modal state
  const [isForgotOpen, setIsForgotOpen] = useState(false)
  const [forgotEmail, setForgotEmail] = useState('')
  const [forgotLoading, setForgotLoading] = useState(false)
  const [forgotSuccess, setForgotSuccess] = useState('')
  const [forgotError, setForgotError] = useState('')
  const redirectTo = getSafeRedirectPath(searchParams.get('redirectTo'))
  const reason = searchParams.get('reason')
  const verified = searchParams.get('verified')
  const verificationError = searchParams.get('error')
  const isCheckoutRedirect = reason === 'checkout'
  const isProductRedirect = redirectTo?.startsWith('/products/') ?? false
  const authQuery = new URLSearchParams()

  if (redirectTo) {
    authQuery.set('redirectTo', redirectTo)
  }

  if (reason) {
    authQuery.set('reason', reason)
  }

  const signupHref = authQuery.toString() ? `/auth/signup?${authQuery.toString()}` : '/auth/signup'
  const contextEyebrow = isCheckoutRedirect
    ? 'Secure Checkout'
    : isProductRedirect
      ? 'Member Purchase'
      : 'Welcome Back'
  const contextMessage = isCheckoutRedirect
    ? 'Sign in to continue to checkout and complete your perfume order.'
    : isProductRedirect
      ? 'Sign in to add this fragrance to your cart and continue shopping.'
      : 'Sign in to save favorites, review orders, and move through checkout faster.'

  useEffect(() => {
    if (verified === '1') {
      setInfoMessage('Your email has been verified. You can sign in now.')
    }
  }, [verified])

  useEffect(() => {
    if (verificationError === 'invalid-verification-link') {
      setError('That verification link is invalid or expired. Request a new verification email below.')
      setNeedsVerification(true)
    }
  }, [verificationError])

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      if (canAccessBackoffice) {
        router.push('/admin/dashboard')
      } else {
        router.push(redirectTo || '/shop')
      }
    }
  }, [authLoading, canAccessBackoffice, isAuthenticated, redirectTo, router])

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setInfoMessage('')
    setNeedsVerification(false)
    setLoading(true)

    try {
      await login(email, password)
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed'
      setError(message)
      setNeedsVerification(message.toLowerCase().includes('verify your email'))
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    setError('')
    setInfoMessage('')
    setResendLoading(true)

    try {
      await resendVerificationEmail(email)
      setInfoMessage('Verification email sent. Check your inbox and spam folder.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend verification email.')
    } finally {
      setResendLoading(false)
    }
  }

  const handleRequestPasswordReset = async (e: React.FormEvent) => {
    e.preventDefault()
    setForgotError('')
    setForgotSuccess('')
    setForgotLoading(true)

    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail }),
      })

      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(data.error || 'Unable to request password reset.')
      }

      setForgotSuccess(
        'A secure password reset link has been sent via email. Please check your inbox or spam folder.',
      )
    } catch (err) {
      setForgotError(err instanceof Error ? err.message : 'Failed to send reset email.')
    } finally {
      setForgotLoading(false)
    }
  }

  return (
    <AuthPageShell>
      <section className="w-full">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          <article className="storefront-panel rounded-[2.25rem] p-7 sm:p-10">
            <p className="storefront-eyebrow">{contextEyebrow}</p>
            <h1 className="mt-4 text-5xl leading-tight text-foreground sm:text-6xl">Welcome Back</h1>
            <p className="mt-4 text-base leading-8 text-foreground/68">{contextMessage}</p>

            <div className="mt-8 rounded-[1.75rem] bg-muted/30 p-5">
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/48">
                Account Access
              </p>
              <p className="mt-3 text-sm leading-7 text-foreground/64">
                Use the verified email and password connected to your {SITE_NAME} customer account.
              </p>
            </div>

            <div className="mt-8 space-y-4 rounded-[1.75rem] bg-[linear-gradient(180deg,rgba(255,179,153,0.1),rgba(255,240,190,0.24))] p-5">
              <p className="text-sm font-semibold text-foreground">Why sign in?</p>
              <ul className="space-y-3 text-sm leading-7 text-foreground/66">
                <li>Save your fragrance wishlist across devices.</li>
                <li>Track perfume orders from payment to delivery.</li>
                <li>Keep checkout and shipping details in one place.</li>
              </ul>
            </div>
          </article>

          <article className="storefront-panel rounded-[2.25rem] px-6 py-8 sm:px-10 sm:py-10">
            {error ? (
              <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            ) : null}

            {infoMessage ? (
              <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm text-emerald-700">{infoMessage}</p>
              </div>
            ) : null}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <label htmlFor="email" className="text-sm font-medium text-foreground">
                  Email Address
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  autoComplete="email"
                  suppressHydrationWarning
                  required
                  placeholder="you@example.com"
                  className="storefront-input h-12 w-full"
                />
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setForgotEmail(email)
                      setForgotError('')
                      setForgotSuccess('')
                      setIsForgotOpen(true)
                    }}
                    className="text-xs font-semibold text-primary hover:underline"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  suppressHydrationWarning
                  required
                  placeholder="********"
                  className="storefront-input h-12 w-full"
                />
              </div>

              <div className="flex items-center gap-4 text-sm text-foreground/60">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" suppressHydrationWarning className="h-4 w-4 rounded border-border text-primary focus:ring-primary" />
                  Remember me
                </label>
              </div>

              <Button
                type="submit"
                disabled={loading || authLoading}
                className="h-12 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-[#ff8a73]"
              >
                {loading ? (
                  <span className="inline-flex items-center gap-2">
                    <Spinner className="h-4 w-4" />
                    Signing In...
                  </span>
                ) : (
                  'Sign In'
                )}
              </Button>

              {needsVerification ? (
                <Button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  variant="outline"
                  className="h-12 w-full rounded-2xl border-border/70 bg-white/70"
                >
                  {resendLoading ? 'Sending verification...' : 'Resend Verification Email'}
                </Button>
              ) : null}
            </form>

            {/* Forgot Password Modal Dialog */}
            <Dialog open={isForgotOpen} onOpenChange={setIsForgotOpen}>
              <DialogContent className="max-w-md">
                <DialogHeader>
                  <div className="flex items-center gap-2 text-primary">
                    <KeyRound className="h-5 w-5" />
                    <DialogTitle className="text-xl">Reset Your Password</DialogTitle>
                  </div>
                  <DialogDescription className="text-xs text-foreground/60">
                    Enter the email connected to your account. We will send you a secure password reset link via SMTP.
                  </DialogDescription>
                </DialogHeader>

                {forgotSuccess ? (
                  <div className="space-y-4 py-3">
                    <div className="rounded-[1.5rem] bg-emerald-500/10 border border-emerald-500/20 p-4 text-sm text-emerald-800 dark:text-emerald-300 flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <p className="leading-relaxed">{forgotSuccess}</p>
                    </div>
                    <Button
                      type="button"
                      onClick={() => setIsForgotOpen(false)}
                      className="w-full h-11 rounded-2xl bg-primary text-primary-foreground hover:bg-[#ff8a73]"
                    >
                      Done
                    </Button>
                  </div>
                ) : (
                  <form onSubmit={handleRequestPasswordReset} className="space-y-4 py-2">
                    {forgotError ? (
                      <div className="rounded-[1.25rem] border border-red-200 bg-red-50 p-3 text-xs text-red-600">
                        {forgotError}
                      </div>
                    ) : null}

                    <div className="space-y-2">
                      <label htmlFor="forgot-email" className="text-xs font-medium text-foreground">
                        Account Email Address
                      </label>
                      <input
                        id="forgot-email"
                        type="email"
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        required
                        placeholder="you@example.com"
                        className="storefront-input h-11 w-full"
                      />
                    </div>

                    <DialogFooter className="flex-row items-center justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsForgotOpen(false)}
                        className="rounded-xl"
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        disabled={forgotLoading}
                        className="rounded-xl bg-primary text-primary-foreground hover:bg-[#ff8a73] gap-1.5"
                      >
                        {forgotLoading ? (
                          <>
                            <Spinner className="h-4 w-4" />
                            Sending...
                          </>
                        ) : (
                          <>
                            <Mail className="h-4 w-4" />
                            Send Reset Link
                          </>
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                )}
              </DialogContent>
            </Dialog>

            <div className="mt-8 border-t border-border/70 pt-6 text-center">
              <p className="text-sm text-foreground/60">
                New to {SITE_NAME}?{' '}
                <Link href={signupHref} className="font-semibold text-primary transition hover:text-[#ff8a73]">
                  Create your account
                </Link>
              </p>
            </div>
          </article>
        </div>
      </section>
    </AuthPageShell>
  )
}

function SignInPageFallback() {
  return (
    <AuthPageShell>
      <div className="flex min-h-[40vh] w-full items-center justify-center px-4">
        <div className="flex items-center gap-3 text-foreground/70">
          <Spinner className="h-5 w-5" />
          <p>Loading sign-in...</p>
        </div>
      </div>
    </AuthPageShell>
  )
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInPageFallback />}>
      <SignInPageContent />
    </Suspense>
  )
}
