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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ShieldCheck, BookOpen, Check } from 'lucide-react'

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
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [hasReadPrivacy, setHasReadPrivacy] = useState(false)
  const [isPrivacyOpen, setIsPrivacyOpen] = useState(false)
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

    if (!hasReadPrivacy || !agreedToTerms) {
      setError('Please read and accept the Data Privacy Notice (RA 10173) and terms before creating your account.')
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

                {/* Data Privacy Act & Agreement */}
                <div className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 text-foreground font-medium text-sm">
                      <ShieldCheck className="h-4 w-4 text-primary shrink-0" />
                      <span>Data Privacy Act of 2012 (RA 10173)</span>
                    </div>
                    {hasReadPrivacy ? (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full shrink-0">
                        <Check className="h-3 w-3" /> Read & Verified
                      </span>
                    ) : (
                      <span className="text-[11px] font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full shrink-0">
                        Reading Required
                      </span>
                    )}
                  </div>

                  <p className="text-xs leading-relaxed text-foreground/65">
                    To safeguard your personal information (name, address, email, contact number, birthdate), we comply with the Philippine Data Privacy Act. You must open and read our privacy policy before checking the agreement.
                  </p>

                  <div className="flex items-center justify-between pt-1">
                    <button
                      type="button"
                      onClick={() => setIsPrivacyOpen(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
                    >
                      <BookOpen className="h-3.5 w-3.5" />
                      {hasReadPrivacy ? 'Review Privacy Policy Again' : 'Read Data Privacy Policy Now'}
                    </button>
                  </div>

                  <div className="pt-2 border-t border-border/50">
                    <label
                      className={`flex items-start gap-3 text-xs leading-relaxed transition-opacity ${
                        hasReadPrivacy ? 'cursor-pointer text-foreground/80' : 'cursor-not-allowed opacity-50 text-foreground/50'
                      }`}
                    >
                      <input
                        type="checkbox"
                        disabled={!hasReadPrivacy}
                        checked={agreedToTerms}
                        onChange={(e) => setAgreedToTerms(e.target.checked)}
                        className="mt-0.5 h-4 w-4 rounded border-border text-primary focus:ring-primary disabled:cursor-not-allowed"
                      />
                      <span>
                        I confirm that I have read, understood, and agree to the <strong>Data Privacy Policy (RA 10173)</strong> and account terms.
                      </span>
                    </label>
                    {!hasReadPrivacy && (
                      <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 pl-7">
                        * Please click &ldquo;Read Data Privacy Policy Now&rdquo; above to enable this checkbox.
                      </p>
                    )}
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={loading || authLoading || !agreedToTerms || !hasReadPrivacy}
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

                {/* Privacy Policy Dialog Modal */}
                <Dialog open={isPrivacyOpen} onOpenChange={setIsPrivacyOpen}>
                  <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
                    <DialogHeader>
                      <div className="flex items-center gap-2 text-primary">
                        <ShieldCheck className="h-5 w-5" />
                        <DialogTitle className="text-xl">Data Privacy Statement</DialogTitle>
                      </div>
                      <DialogDescription className="text-xs text-foreground/60">
                        In Compliance with Republic Act No. 10173 (Philippine Data Privacy Act of 2012)
                      </DialogDescription>
                    </DialogHeader>

                    <div className="overflow-y-auto pr-2 space-y-4 text-xs leading-relaxed text-foreground/75 border-y border-border/60 py-4 my-2">
                      <div>
                        <h4 className="font-semibold text-foreground text-sm mb-1">1. Collection of Personal Information</h4>
                        <p>
                          We collect your personal details including your <strong>Full Name</strong>, <strong>Email Address / Gmail</strong>, <strong>Contact Number</strong>, <strong>Birthdate / Age</strong>, and <strong>Delivery Address</strong> when you register an account or place an order.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-foreground text-sm mb-1">2. Purpose of Processing</h4>
                        <p>
                          Your information is processed strictly for:
                        </p>
                        <ul className="list-disc pl-5 mt-1 space-y-1">
                          <li>Fulfilling and delivering your fragrance orders through authorized couriers.</li>
                          <li>Sending order confirmations, tracking numbers, and delivery status SMS/email notices.</li>
                          <li>Age verification to ensure eligibility for purchase and fragrance promotions.</li>
                          <li>Preventing fraud and securing your customer account.</li>
                        </ul>
                      </div>

                      <div>
                        <h4 className="font-semibold text-foreground text-sm mb-1">3. Data Protection & Confidentiality</h4>
                        <p>
                          We implement strict organizational, technical, and physical security measures to protect your personal data against unauthorized access, loss, or disclosure. We do not sell or trade your personal information to any third parties.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-foreground text-sm mb-1">4. Your Rights as a Data Subject</h4>
                        <p>
                          Under the Data Privacy Act of 2012, you have the right to be informed, to access, to rectify inaccuracies in your data, and to request erasure or blocking of your personal details at any time through your Account page or customer support.
                        </p>
                      </div>

                      <div className="rounded-xl bg-primary/10 border border-primary/20 p-3 text-foreground/90">
                        <p className="font-medium text-xs">
                          By clicking &ldquo;I have read and agree&rdquo;, you grant consent for {SITE_NAME} to process your information according to this policy.
                        </p>
                      </div>
                    </div>

                    <DialogFooter className="flex-row items-center justify-between sm:justify-between gap-3 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => setIsPrivacyOpen(false)}
                        className="rounded-xl text-xs"
                      >
                        Close
                      </Button>
                      <Button
                        type="button"
                        onClick={() => {
                          setHasReadPrivacy(true)
                          setAgreedToTerms(true)
                          setIsPrivacyOpen(false)
                        }}
                        className="rounded-xl bg-primary text-primary-foreground hover:bg-[#ff8a73] text-xs font-semibold gap-1.5"
                      >
                        <Check className="h-4 w-4" />
                        I Have Read & Agree to Privacy Policy
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
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
