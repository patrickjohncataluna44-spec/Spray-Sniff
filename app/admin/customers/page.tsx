'use client'

import Link from 'next/link'
import { useEffect, useEffectEvent, useMemo, useState } from 'react'
import { ArrowLeft, Eye, Mail, UserPlus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ProtectedRoute } from '@/components/protected-route'
import { formatPHP } from '@/lib/currency'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import { subscribeToProfiles, subscribeToStoreOrders } from '@/lib/supabase-realtime'
import { toast } from '@/hooks/use-toast'

type CustomerSummary = {
  id: string
  name: string
  email: string
  role: 'ADMIN' | 'STAFF' | 'USER'
  orders: number
  spent: number
  joined: string
}

type StaffFormState = {
  name: string
  email: string
  password: string
}

const defaultStaffForm: StaffFormState = {
  name: '',
  email: '',
  password: '',
}

async function getAuthHeaders() {
  const supabase = getSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token

  const headers: Record<string, string> = {}

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}

function formatJoinedDate(value: string) {
  return new Date(value).toLocaleDateString('en-PH', {
    dateStyle: 'medium',
  })
}

function getRoleTone(role: CustomerSummary['role']) {
  switch (role) {
    case 'ADMIN':
      return 'bg-slate-900 text-white'
    case 'STAFF':
      return 'bg-sky-100 text-sky-700'
    default:
      return 'bg-emerald-100 text-emerald-700'
  }
}

export default function AdminCustomersPage() {
  const [customers, setCustomers] = useState<CustomerSummary[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [staffForm, setStaffForm] = useState<StaffFormState>(defaultStaffForm)
  const [isLoading, setIsLoading] = useState(true)
  const [isCreatingStaff, setIsCreatingStaff] = useState(false)

  const loadCustomers = useEffectEvent(async () => {
    try {
      const response = await fetch('/api/admin/customers', {
        method: 'GET',
        headers: await getAuthHeaders(),
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(payload.error ?? 'Unable to load customer data.')
      }

      setCustomers(Array.isArray(payload.customers) ? (payload.customers as CustomerSummary[]) : [])
    } catch (error) {
      toast({
        title: 'Unable to load customers',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  })

  useEffect(() => {
    void loadCustomers()

    const cleanups = [
      subscribeToProfiles(() => {
        void loadCustomers()
      }),
      subscribeToStoreOrders(() => {
        void loadCustomers()
      }),
    ]

    return () => {
      cleanups.forEach((cleanup) => cleanup())
    }
  }, [])

  const updateStaffForm = (field: keyof StaffFormState, value: string) => {
    setStaffForm((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const handleCreateStaff = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const payload = {
      name: staffForm.name.trim(),
      email: staffForm.email.trim().toLowerCase(),
      password: staffForm.password,
    }

    if (!payload.name || !payload.email || !payload.password) {
      toast({
        title: 'Incomplete staff account',
        description: 'Enter the staff name, email, and password first.',
        variant: 'destructive',
      })
      return
    }

    setIsCreatingStaff(true)

    try {
      const response = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: {
          ...(await getAuthHeaders()),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })
      const result = await response.json().catch(() => ({}))

      if (!response.ok) {
        throw new Error(result.error ?? 'Unable to create the staff account.')
      }

      setStaffForm(defaultStaffForm)
      toast({
        title: 'Staff account created',
        description: `${payload.name} can now sign in with ${payload.email}.`,
      })
      await loadCustomers()
    } catch (error) {
      toast({
        title: 'Unable to create staff account',
        description: error instanceof Error ? error.message : 'Try again in a moment.',
        variant: 'destructive',
      })
    } finally {
      setIsCreatingStaff(false)
    }
  }

  const filteredCustomers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()

    if (!query) {
      return customers
    }

    return customers.filter((customer) =>
      [customer.name, customer.email, customer.role].some((value) =>
        value.toLowerCase().includes(query),
      ),
    )
  }, [customers, searchQuery])

  const totalCustomers = customers.filter((customer) => customer.role === 'USER').length
  const totalStaff = customers.filter((customer) => customer.role === 'STAFF').length
  const totalAdmins = customers.filter((customer) => customer.role === 'ADMIN').length

  return (
    <ProtectedRoute requiredRole="ADMIN">
      <div className="min-h-screen bg-background">
        <div className="border-b border-border bg-card">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center gap-4 mb-4">
              <Button variant="ghost" size="sm" asChild>
                <Link href="/admin/dashboard" className="flex items-center gap-2">
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </Link>
              </Button>
            </div>
            <h1 className="font-serif text-3xl text-foreground">Accounts</h1>
            <p className="mt-2 text-sm text-foreground/60">
              Create staff logins and review customer, staff, and admin profiles from Supabase.
            </p>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          <div className="mb-8 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">Staff Provisioning</p>
                  <h2 className="mt-2 font-serif text-2xl text-foreground">Create Staff Account</h2>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-foreground/60">
                    Add a verified staff login directly from admin. New accounts are saved to Supabase Auth and
                    assigned the <span className="font-medium text-foreground">STAFF</span> role automatically.
                  </p>
                </div>
                <div className="rounded-2xl border border-border bg-background/70 p-3 text-accent">
                  <UserPlus className="h-5 w-5" />
                </div>
              </div>

              <form onSubmit={handleCreateStaff} className="mt-6 grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label htmlFor="staff-name" className="mb-2 block text-sm font-medium text-foreground">
                    Staff Name
                  </label>
                  <input
                    id="staff-name"
                    type="text"
                    value={staffForm.name}
                    onChange={(event) => updateStaffForm('name', event.target.value)}
                    placeholder="Maria Santos"
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="staff-email" className="mb-2 block text-sm font-medium text-foreground">
                    Staff Email
                  </label>
                  <input
                    id="staff-email"
                    type="email"
                    value={staffForm.email}
                    onChange={(event) => updateStaffForm('email', event.target.value)}
                    placeholder="staff@yourstore.com"
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="staff-password" className="mb-2 block text-sm font-medium text-foreground">
                    Password
                  </label>
                  <input
                    id="staff-password"
                    type="password"
                    value={staffForm.password}
                    onChange={(event) => updateStaffForm('password', event.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent"
                    minLength={6}
                    required
                  />
                </div>

                <div className="md:col-span-2 flex flex-col gap-3 pt-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-foreground/55">
                    Choose the credentials your staff member will use on the admin login page.
                  </p>
                  <Button
                    type="submit"
                    disabled={isCreatingStaff}
                    className="min-w-44 bg-accent text-accent-foreground hover:bg-accent/90"
                  >
                    {isCreatingStaff ? 'Creating Staff...' : 'Create Staff Account'}
                  </Button>
                </div>
              </form>
            </section>

            <section className="rounded-2xl border border-border bg-card p-6">
              <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">Access Summary</p>
              <h2 className="mt-2 font-serif text-2xl text-foreground">Who Can Open What</h2>
              <div className="mt-6 space-y-3 text-sm">
                <div className="rounded-xl border border-border bg-background/70 p-4">
                  <p className="font-medium text-foreground">Staff</p>
                  <p className="mt-1 text-foreground/60">
                    Dashboard, POS, Inventory, Orders, and Products.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background/70 p-4">
                  <p className="font-medium text-foreground">Admin Only</p>
                  <p className="mt-1 text-foreground/60">
                    Customer data, reports, promotions, and staff account creation.
                  </p>
                </div>
                <div className="rounded-xl border border-border bg-background/70 p-4">
                  <p className="font-medium text-foreground">Sign-in Flow</p>
                  <p className="mt-1 text-foreground/60">
                    Staff sign in from the existing admin login page using the credentials created here.
                  </p>
                </div>
              </div>
            </section>
          </div>

          <div className="mb-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search accounts by name, email, or role..."
              className="w-full rounded-lg border border-border bg-background px-4 py-3 text-foreground placeholder:text-foreground/50 focus:outline-none focus:ring-2 focus:ring-accent"
            />
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">Registered Users</p>
              <p className="mt-2 font-serif text-2xl text-foreground">{totalCustomers}</p>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">Staff Accounts</p>
              <p className="mt-2 font-serif text-2xl text-foreground">{totalStaff}</p>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">Admin Accounts</p>
              <p className="mt-2 font-serif text-2xl text-foreground">{totalAdmins}</p>
            </div>
          </div>

          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="font-serif text-2xl text-foreground">All Profiles</h2>
              <p className="mt-1 text-sm text-foreground/60">
                Every account record, including customers, staff, and admins.
              </p>
            </div>
            <div className="rounded-lg border border-border bg-card px-4 py-3">
              <p className="text-xs uppercase tracking-[0.2em] text-foreground/45">Visible Profiles</p>
              <p className="mt-2 font-serif text-2xl text-foreground">{customers.length}</p>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-4 px-6 font-medium text-foreground/60">Name</th>
                    <th className="text-left py-4 px-6 font-medium text-foreground/60">Email</th>
                    <th className="text-left py-4 px-6 font-medium text-foreground/60">Role</th>
                    <th className="text-left py-4 px-6 font-medium text-foreground/60">Orders</th>
                    <th className="text-left py-4 px-6 font-medium text-foreground/60">Total Spent</th>
                    <th className="text-left py-4 px-6 font-medium text-foreground/60">Joined</th>
                    <th className="text-right py-4 px-6 font-medium text-foreground/60">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {!isLoading && filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 px-6 text-center text-foreground/60">
                        No account records matched your search.
                      </td>
                    </tr>
                  ) : (
                    filteredCustomers.map((customer) => (
                      <tr
                        key={customer.id}
                        className="border-b border-border last:border-0 hover:bg-muted/50"
                      >
                        <td className="py-4 px-6">
                          <p className="font-medium text-foreground">{customer.name}</p>
                        </td>
                        <td className="py-4 px-6 text-foreground/60">{customer.email}</td>
                        <td className="py-4 px-6">
                          <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getRoleTone(customer.role)}`}>
                            {customer.role}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-foreground">{customer.orders}</td>
                        <td className="py-4 px-6 font-medium text-foreground">{formatPHP(customer.spent)}</td>
                        <td className="py-4 px-6 text-foreground/60">{formatJoinedDate(customer.joined)}</td>
                        <td className="py-4 px-6">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              className="p-2 hover:bg-muted rounded-lg transition-colors"
                              title={`View ${customer.name}`}
                              aria-label={`View ${customer.name}`}
                              onClick={() =>
                                toast({
                                  title: customer.name,
                                  description: `${customer.orders} order(s) recorded with ${customer.email}.`,
                                })
                              }
                            >
                              <Eye className="w-4 h-4 text-foreground/60" />
                            </button>
                            <a
                              href={`mailto:${customer.email}`}
                              className="p-2 hover:bg-muted rounded-lg transition-colors"
                              title={`Email ${customer.name}`}
                              aria-label={`Email ${customer.name}`}
                            >
                              <Mail className="w-4 h-4 text-foreground/60" />
                            </a>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6 text-sm">
            <p className="text-foreground/60">
              Showing {filteredCustomers.length} of {customers.length} account records
            </p>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
