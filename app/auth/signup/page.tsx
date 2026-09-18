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

import { calculateAge, validateCustomerInformation } from '@/lib/customer-validation'

function SignUpPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { signup, resendVerificationEmail, isAuthenticated, canAccessBackoffice, isLoading: authLoading } =
    useAuth()
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    birthdate: '',
    age: '',
    address: '',
    city: '',
    postalCode: '',
    password: '',
    confirmPassword: '',
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})
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

    if (name === 'birthdate') {
      const calculated = calculateAge(value)
      setFormData((current) => ({
        ...current,
        birthdate: value,
        age: calculated !== null ? String(calculated) : '',
      }))
      return
    }

    setFormData((current) => ({ ...current, [name]: value }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSuccessMessage('')
    setFieldErrors({})

    const validation = validateCustomerInformation({
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      birthdate: formData.birthdate,
      address: formData.address,
      city: formData.city,
      postalCode: formData.postalCode,
      requireBirthdate: true,
      requireAddress: true,
    })

    if (!validation.isValid) {
      setFieldErrors(validation.errors)
      const firstError = Object.values(validation.errors)[0]
      setError(firstError || 'Please correct the highlighted fields.')
      return
    }

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
      const numericAge = formData.age ? parseInt(formData.age, 10) : undefined

      const result = await signup(formData.email, formData.password, fullName, {
        phone: formData.phone,
        birthdate: formData.birthdate,
        age: numericAge,
        address: formData.address,
        city: formData.city,
        postalCode: formData.postalCode,
      })

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
                    Email Address / Gmail
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
                    placeholder="name@gmail.com"
                    className={`storefront-input h-12 w-full ${fieldErrors.email ? 'border-red-500' : ''}`}
                  />
                  {fieldErrors.email ? (
                    <p className="text-xs text-red-500">{fieldErrors.email}</p>
                  ) : null}
                </div>

                <div className="space-y-2">
                  <label htmlFor="phone" className="text-sm font-medium text-foreground">
                    Contact Number
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    name="phone"
                    value={formData.phone}
                    onChange={handleChange}
                    autoComplete="tel"
                    suppressHydrationWarning
                    required
                    placeholder="0917 123 4567 or +639171234567"
                    className={`storefront-input h-12 w-full ${fieldErrors.phone ? 'border-red-500' : ''}`}
                  />
                  {fieldErrors.phone ? (
                    <p className="text-xs text-red-500">{fieldErrors.phone}</p>
                  ) : (
                    <p className="text-[11px] text-foreground/50">Used for courier delivery notifications.</p>
                  )}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="birthdate" className="text-sm font-medium text-foreground">
                      Birthdate
                    </label>
                    <input
                      id="birthdate"
                      type="date"
                      name="birthdate"
                      max={new Date().toISOString().split('T')[0]}
                      value={formData.birthdate}
                      onChange={handleChange}
                      suppressHydrationWarning
                      required
                      className={`storefront-input h-12 w-full ${fieldErrors.birthdate ? 'border-red-500' : ''}`}
                    />
                    {fieldErrors.birthdate ? (
                      <p className="text-xs text-red-500">{fieldErrors.birthdate}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="age" className="text-sm font-medium text-foreground">
                      Calculated Age
                    </label>
                    <input
                      id="age"
                      type="text"
                      name="age"
                      value={formData.age ? `${formData.age} years old` : ''}
                      readOnly
                      placeholder="Auto-calculated"
                      className="storefront-input h-12 w-full bg-muted/40 text-foreground/75 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="address" className="text-sm font-medium text-foreground">
                    Delivery Address
                  </label>
                  <input
                    id="address"
                    type="text"
                    name="address"
                    value={formData.address}
                    onChange={handleChange}
                    autoComplete="street-address"
                    suppressHydrationWarning
                    required
                    placeholder="House/Unit #, Street, Barangay"
                    className={`storefront-input h-12 w-full ${fieldErrors.address ? 'border-red-500' : ''}`}
                  />
                  {fieldErrors.address ? (
                    <p className="text-xs text-red-500">{fieldErrors.address}</p>
                  ) : null}
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="city" className="text-sm font-medium text-foreground">
                      City / Municipality
                    </label>
                    <input
                      id="city"
                      type="text"
                      name="city"
                      value={formData.city}
                      onChange={handleChange}
                      autoComplete="address-level2"
                      suppressHydrationWarning
                      required
                      placeholder="e.g. Cebu City"
                      className={`storefront-input h-12 w-full ${fieldErrors.city ? 'border-red-500' : ''}`}
                    />
                    {fieldErrors.city ? (
                      <p className="text-xs text-red-500">{fieldErrors.city}</p>
                    ) : null}
                  </div>

                  <div className="space-y-2">
                    <label htmlFor="postalCode" className="text-sm font-medium text-foreground">
                      Postal / ZIP Code
                    </label>
                    <input
                      id="postalCode"
                      type="text"
                      name="postalCode"
                      value={formData.postalCode}
                      onChange={handleChange}
                      autoComplete="postal-code"
                      suppressHydrationWarning
                      required
                      placeholder="e.g. 6000"
                      className={`storefront-input h-12 w-full ${fieldErrors.postalCode ? 'border-red-500' : ''}`}
                    />
                    {fieldErrors.postalCode ? (
                      <p className="text-xs text-red-500">{fieldErrors.postalCode}</p>
                    ) : null}
                  </div>
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
