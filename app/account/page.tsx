'use client'

import Link from 'next/link'
import { useState, useEffect } from 'react'
import { Check, Edit3, Loader2, MapPin, Phone, Calendar, User as UserIcon, ShieldCheck } from 'lucide-react'
import { ProtectedRoute } from '@/components/protected-route'
import { StorefrontPageHero } from '@/components/storefront-page-hero'
import { StorefrontShell } from '@/components/storefront-shell'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/auth-context'
import { useStore } from '@/lib/store-context'
import { calculateAge, validateCustomerInformation } from '@/lib/customer-validation'
import { toast } from '@/hooks/use-toast'

export default function AccountPage() {
  const { user, updateProfile } = useAuth()
  const { orders } = useStore()

  const [isEditing, setIsEditing] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    birthdate: '',
    age: '',
    address: '',
    city: '',
    postalCode: '',
  })
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (user) {
      setProfileForm({
        name: user.name ?? '',
        phone: user.phone ?? '',
        birthdate: user.birthdate ?? '',
        age: user.age ? String(user.age) : user.birthdate ? String(calculateAge(user.birthdate) ?? '') : '',
        address: user.address ?? '',
        city: user.city ?? '',
        postalCode: user.postalCode ?? '',
      })
    }
  }, [user])

  const userOrders = orders.filter(
    (order) =>
      order.source === 'ONLINE' &&
      order.customerEmail.toLowerCase() === (user?.email ?? '').toLowerCase(),
  )
  const activeOrders = userOrders.filter(
    (order) => order.status !== 'Delivered' && order.status !== 'Cancelled',
  )
  const cancelledOrders = userOrders.filter((order) => order.status === 'Cancelled')

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target

    if (name === 'birthdate') {
      const calculated = calculateAge(value)
      setProfileForm((curr) => ({
        ...curr,
        birthdate: value,
        age: calculated !== null ? String(calculated) : '',
      }))
      return
    }

    setProfileForm((curr) => ({ ...curr, [name]: value }))
  }

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})

    const [first = '', ...rest] = profileForm.name.trim().split(' ')
    const validation = validateCustomerInformation({
      firstName: first,
      lastName: rest.join(' ') || first,
      email: user?.email ?? '',
      phone: profileForm.phone,
      birthdate: profileForm.birthdate,
      address: profileForm.address,
      city: profileForm.city,
      postalCode: profileForm.postalCode,
      requireBirthdate: false,
      requireAddress: false,
    })

    if (!validation.isValid) {
      setFieldErrors(validation.errors)
      toast({
        title: 'Validation Error',
        description: Object.values(validation.errors)[0] || 'Please fix highlighted errors.',
        variant: 'destructive',
      })
      return
    }

    setIsSaving(true)
    try {
      const numericAge = profileForm.age ? parseInt(profileForm.age, 10) : undefined
      await updateProfile({
        name: profileForm.name,
        phone: profileForm.phone,
        birthdate: profileForm.birthdate,
        age: numericAge,
        address: profileForm.address,
        city: profileForm.city,
        postalCode: profileForm.postalCode,
      })

      toast({
        title: 'Profile Updated',
        description: 'Your personal information has been saved successfully.',
      })
      setIsEditing(false)
    } catch (err) {
      toast({
        title: 'Save Failed',
        description: err instanceof Error ? err.message : 'Unable to update profile.',
        variant: 'destructive',
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <ProtectedRoute requiredRole="USER">
      <StorefrontShell>
        <StorefrontPageHero
          eyebrow="My Account"
          title={user?.name ?? 'Customer Account'}
          description="Review your perfume orders, active shipments, and manage your personal verified customer details."
        />

        <section className="px-4 pb-16 pt-2 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl space-y-8">
            {/* Orders summary banner */}
            <article className="storefront-panel rounded-[2rem] p-7 sm:p-9">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <p className="storefront-eyebrow">Account Overview</p>
                  <p className="mt-2 text-xl font-semibold text-foreground">{user?.name}</p>
                  <p className="text-sm text-foreground/70">{user?.email}</p>
                </div>
                <div className="flex flex-wrap gap-3">
                  <Button className="h-11 rounded-2xl bg-primary px-6 text-primary-foreground hover:bg-[#ff8a73]" asChild>
                    <Link href="/orders">Manage Orders</Link>
                  </Button>
                  <Button variant="outline" className="h-11 rounded-2xl border-border/70 bg-white/70 px-6" asChild>
                    <Link href="/shop">Shop Fragrances</Link>
                  </Button>
                </div>
              </div>

              <div className="mt-8 grid gap-4 md:grid-cols-3">
                <div className="rounded-[1.5rem] bg-muted/30 p-5">
                  <p className="text-sm font-medium text-foreground/55">Total Orders</p>
                  <p className="mt-2 text-4xl text-foreground">{userOrders.length}</p>
                </div>
                <div className="rounded-[1.5rem] bg-muted/30 p-5">
                  <p className="text-sm font-medium text-foreground/55">Active Orders</p>
                  <p className="mt-2 text-4xl text-foreground">{activeOrders.length}</p>
                </div>
                <div className="rounded-[1.5rem] bg-muted/30 p-5">
                  <p className="text-sm font-medium text-foreground/55">Delivered / Cancelled</p>
                  <p className="mt-2 text-4xl text-foreground">
                    {userOrders.filter((order) => order.status === 'Delivered').length} / {cancelledOrders.length}
                  </p>
                </div>
              </div>
            </article>

            {/* Personal Information & Validation */}
            <article className="storefront-panel rounded-[2rem] p-7 sm:p-9">
              <div className="flex items-center justify-between">
                <div>
                  <p className="storefront-eyebrow">Personal Information</p>
                  <h2 className="mt-1 text-2xl font-serif text-foreground">Customer Profile & Address</h2>
                </div>
                {!isEditing ? (
                  <Button
                    variant="outline"
                    onClick={() => setIsEditing(true)}
                    className="rounded-2xl gap-2 border-border/70 bg-white/70"
                  >
                    <Edit3 className="h-4 w-4" />
                    Edit Details
                  </Button>
                ) : (
                  <Button
                    variant="ghost"
                    onClick={() => setIsEditing(false)}
                    className="rounded-2xl text-foreground/60"
                  >
                    Cancel
                  </Button>
                )}
              </div>

              {!isEditing ? (
                <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                  <div className="rounded-[1.5rem] bg-muted/20 border border-border/50 p-5 space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-foreground/50 flex items-center gap-1.5">
                      <UserIcon className="h-3.5 w-3.5 text-primary" /> Full Name
                    </p>
                    <p className="text-base font-semibold text-foreground pt-1">{user?.name || 'Not provided'}</p>
                  </div>

                  <div className="rounded-[1.5rem] bg-muted/20 border border-border/50 p-5 space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-foreground/50 flex items-center gap-1.5">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Email Address
                    </p>
                    <p className="text-base font-semibold text-foreground pt-1">{user?.email}</p>
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium">Verified Account</span>
                  </div>

                  <div className="rounded-[1.5rem] bg-muted/20 border border-border/50 p-5 space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-foreground/50 flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5 text-primary" /> Contact Number
                    </p>
                    <p className="text-base font-semibold text-foreground pt-1">
                      {user?.phone || <span className="text-foreground/40 italic font-normal">None added</span>}
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] bg-muted/20 border border-border/50 p-5 space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wider text-foreground/50 flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-primary" /> Birthdate & Age
                    </p>
                    <p className="text-base font-semibold text-foreground pt-1">
                      {user?.birthdate ? (
                        <>
                          {new Date(user.birthdate).toLocaleDateString('en-PH', { dateStyle: 'medium' })}
                          {user.age ? <span className="text-sm font-normal text-foreground/60 ml-2">({user.age} yrs old)</span> : null}
                        </>
                      ) : (
                        <span className="text-foreground/40 italic font-normal">None added</span>
                      )}
                    </p>
                  </div>

                  <div className="rounded-[1.5rem] bg-muted/20 border border-border/50 p-5 space-y-1 sm:col-span-2">
                    <p className="text-xs font-medium uppercase tracking-wider text-foreground/50 flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-primary" /> Delivery Address
                    </p>
                    <p className="text-base font-semibold text-foreground pt-1">
                      {user?.address ? (
                        `${user.address}${user.city ? `, ${user.city}` : ''}${user.postalCode ? ` ${user.postalCode}` : ''}`
                      ) : (
                        <span className="text-foreground/40 italic font-normal">No delivery address saved yet</span>
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <form onSubmit={handleSaveProfile} className="mt-6 space-y-5">
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Full Name</label>
                      <input
                        type="text"
                        name="name"
                        value={profileForm.name}
                        onChange={handleChange}
                        required
                        className="storefront-input h-12 w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Contact Number</label>
                      <input
                        type="tel"
                        name="phone"
                        value={profileForm.phone}
                        onChange={handleChange}
                        placeholder="0917 123 4567 or +639171234567"
                        className={`storefront-input h-12 w-full ${fieldErrors.phone ? 'border-red-500' : ''}`}
                      />
                      {fieldErrors.phone ? <p className="text-xs text-red-500">{fieldErrors.phone}</p> : null}
                    </div>
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Birthdate</label>
                      <input
                        type="date"
                        name="birthdate"
                        max={new Date().toISOString().split('T')[0]}
                        value={profileForm.birthdate}
                        onChange={handleChange}
                        className={`storefront-input h-12 w-full ${fieldErrors.birthdate ? 'border-red-500' : ''}`}
                      />
                      {fieldErrors.birthdate ? <p className="text-xs text-red-500">{fieldErrors.birthdate}</p> : null}
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Calculated Age</label>
                      <input
                        type="text"
                        name="age"
                        value={profileForm.age ? `${profileForm.age} years old` : ''}
                        readOnly
                        placeholder="Auto-calculated"
                        className="storefront-input h-12 w-full bg-muted/40 text-foreground/75 cursor-not-allowed"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-foreground">Street / Delivery Address</label>
                    <input
                      type="text"
                      name="address"
                      value={profileForm.address}
                      onChange={handleChange}
                      placeholder="House/Unit #, Street, Barangay"
                      className="storefront-input h-12 w-full"
                    />
                  </div>

                  <div className="grid gap-5 sm:grid-cols-2">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">City / Municipality</label>
                      <input
                        type="text"
                        name="city"
                        value={profileForm.city}
                        onChange={handleChange}
                        placeholder="e.g. Cebu City"
                        className="storefront-input h-12 w-full"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-medium text-foreground">Postal / ZIP Code</label>
                      <input
                        type="text"
                        name="postalCode"
                        value={profileForm.postalCode}
                        onChange={handleChange}
                        placeholder="e.g. 6000"
                        className="storefront-input h-12 w-full"
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      className="rounded-2xl"
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSaving}
                      className="rounded-2xl bg-primary text-primary-foreground hover:bg-[#ff8a73]"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Saving...
                        </>
                      ) : (
                        <>
                          <Check className="mr-2 h-4 w-4" />
                          Save Changes
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              )}
            </article>
          </div>
        </section>
      </StorefrontShell>
    </ProtectedRoute>
  )
}

