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

function SignUpPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signup, resendVerificationEmail, isAuthenticated, canAccessBackoffice, isLoading: authLoading } =
    useAuth()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const [resendLoading, setResendLoading] = useState(false)
  const [error, setError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [verificationEmail, setVerificationEmail] = useState('')
  const redirectTo = getSafeRedirectPath(searchParams.get('redirectTo'))
  const reason = searchParams.get('reason')
  const isCheckoutRedirect = reason === 'checkout'
  const isProductRedirect = redirectTo?.startsWith('/products/') ?? false
  const authQuery = new URLSearchParams()

  if (redirectTo) {
    authQuery.set('redirectTo', redirectTo)
  }

  if (reason) {
    authQuery.set('reason', reason)
  }

  const signinHref = authQuery.toString() ? `/auth/signin?${authQuery.toString()}` : '/auth/signin'
  const contextEyebrow = isCheckoutRedirect
    ? 'Secure Checkout'
    : isProductRedirect
      ? 'Member Purchase'
      : 'Create Your Account'
  const contextMessage = isCheckoutRedirect
    ? 'Create your account to continue to checkout and place your perfume order.'
    : isProductRedirect
      ? 'Create your account to add this fragrance to your cart and continue shopping.'
      : 'Create an account to save favorites, manage orders, and build your own perfume shortlist.'

  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      if (canAccessBackoffice) {
        router.push('/admin/dashboard')
      } else {
        router.push(redirectTo || '/shop')
      }
    }
  }, [isAuthenticated, authLoading, canAccessBackoffice, redirectTo, router])

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target
    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccessMessage('')

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }

    setLoading(true)
    try {
      const fullName = `${formData.firstName} ${formData.lastName}`.trim()
      const result = await signup(formData.email, formData.password, fullName)

      if (result.requiresEmailVerification) {
        setVerificationEmail(result.email)
        setSuccessMessage(`We sent a verification email to ${result.email}. Verify it first, then sign in.`)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Signup failed')
    } finally {
      setLoading(false)
    }
  }

  const handleResendVerification = async () => {
    setError('')
    setSuccessMessage('')
    setResendLoading(true)

    try {
      await resendVerificationEmail(verificationEmail || formData.email)
      setSuccessMessage('A fresh verification email has been sent. Check your inbox and spam folder.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to resend verification email.')
    } finally {
      setResendLoading(false)
    }
  }

  return (
    <AuthPageShell>
      <section className="w-full">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.92fr_1.08fr]">
          <article className="storefront-panel rounded-[2.25rem] p-7 sm:p-10">
            <p className="storefront-eyebrow">{contextEyebrow}</p>
            <h1 className="mt-4 text-5xl leading-tight text-foreground sm:text-6xl">Create Account</h1>
            <p className="mt-4 text-base leading-8 text-foreground/68">{contextMessage}</p>

            <div className="mt-8 space-y-4 rounded-[1.75rem] bg-[linear-gradient(180deg,rgba(255,179,153,0.1),rgba(255,240,190,0.24))] p-5">
              <p className="text-sm font-semibold text-foreground">What you unlock</p>
              <ul className="space-y-3 text-sm leading-7 text-foreground/66">
                <li>Save your fragrance wishlist across desktop and mobile.</li>
                <li>Track perfume orders and delivery updates in one place.</li>
                <li>Move from product page to checkout with less friction.</li>
              </ul>
            </div>
          </article>

          <article className="storefront-panel rounded-[2.25rem] px-6 py-8 sm:px-10 sm:py-10">
            {error ? (
              <div className="rounded-[1.5rem] border border-red-200 bg-red-50 p-4">
                <p className="text-sm text-red-600">{error}</p>
              </div>
            ) : null}

            {successMessage ? (
              <div className="rounded-[1.5rem] border border-emerald-200 bg-emerald-50 p-5">
                <p className="text-sm leading-6 text-emerald-700">{successMessage}</p>
              </div>
            ) : null}

            {verificationEmail ? (
              <div className="space-y-4">
                <div className="rounded-[1.75rem] bg-muted/30 p-5">
                  <p className="text-sm leading-7 text-foreground/68">
                    Open the verification email we sent to{' '}
                    <span className="font-semibold text-foreground">{verificationEmail}</span>. After clicking the
                    verify button, go to sign in and enter your account details.
                  </p>
                </div>

                <Button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={resendLoading}
                  variant="outline"
                  className="h-12 w-full rounded-2xl border-border/70 bg-white/70"
                >
                  {resendLoading ? 'Resending verification...' : 'Resend Verification Email'}
                </Button>

                <Button className="h-12 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-[#ff8a73]" asChild>
                  <Link href={signinHref}>Go To Sign In</Link>
                </Button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="firstName" className="text-sm font-medium text-foreground">
                      First Name
                    </label>
                    <input
                      id="firstName"
                      type="text"
                      name="firstName"
                      value={formData.firstName}
                      onChange={handleChange}
                      autoComplete="given-name"
                      suppressHydrationWarning
                      required
                      placeholder="John"
                      className="storefront-input h-12 w-full"
                    />
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="lastName" className="text-sm font-medium text-foreground">
                      Last Name
                    </label>
                    <input
                      id="lastName"
                      type="text"
                      name="lastName"
                      value={formData.lastName}
                      onChange={handleChange}
                      autoComplete="family-name"
                      suppressHydrationWarning
                      required
                      placeholder="Doe"
                      className="storefront-input h-12 w-full"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-foreground">
                    Email Address
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    autoComplete="email"
                    suppressHydrationWarning
                    required
                    placeholder="you@example.com"
                    className="storefront-input h-12 w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-foreground">
                    Password
                  </label>
                  <input
                    id="password"
                    type="password"
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    autoComplete="new-password"
                    suppressHydrationWarning
                    required
                    placeholder="********"
                    className="storefront-input h-12 w-full"
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
                    Confirm Password
                  </label>
                  <input
                    id="confirmPassword"
                    type="password"
                    name="confirmPassword"
                    value={formData.confirmPassword}
                    onChange={handleChange}
                    autoComplete="new-password"
                    suppressHydrationWarning
                    required
                    placeholder="********"
                    className="storefront-input h-12 w-full"
                  />
                </div>

                <label className="flex items-center gap-3 pt-1 text-sm text-foreground/68">
                  <input type="checkbox" required suppressHydrationWarning className="h-4 w-4 rounded border-border" />
                  I agree to the account terms and the fragrance store privacy policy.
                </label>

                <Button
                  type="submit"
                  disabled={loading || authLoading}
                  className="h-12 w-full rounded-2xl bg-primary text-primary-foreground hover:bg-[#ff8a73]"
                >
                  {loading ? (
                    <span className="inline-flex items-center gap-2">
                      <Spinner className="h-4 w-4" />
                      Creating account...
                    </span>
                  ) : (
                    'Create Account'
                  )}
                </Button>
              </form>
            )}

            <div className="mt-8 border-t border-border/70 pt-6 text-center">
              <p className="text-sm text-foreground/60">
                Already have an account?{' '}
                <Link href={signinHref} className="font-semibold text-primary transition hover:text-[#ff8a73]">
                  Sign in
                </Link>
              </p>
            </div>
          </article>
        </div>
      </section>
    </AuthPageShell>
  )
}

function SignUpPageFallback() {
  return (
    <AuthPageShell>
      <div className="flex min-h-[40vh] w-full items-center justify-center px-4">
        <div className="flex items-center gap-3 text-foreground/70">
          <Spinner className="h-5 w-5" />
          <p>Loading sign-up...</p>
        </div>
      </div>
    </AuthPageShell>
  )
}

export default function SignUpPage() {
  return (
    <Suspense fallback={<SignUpPageFallback />}>
      <SignUpPageContent />
    </Suspense>
  )
}
