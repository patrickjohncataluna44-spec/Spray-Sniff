import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import { getRequestActor } from '@/lib/server-auth'

type ProfileRow = {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'STAFF' | 'USER'
  created_at: string
}

type OrderRow = {
  id: string
  customer_id: string | null
  customer_email: string
  payment_status: 'Paid' | 'Pending'
  total: number
  source: 'ONLINE' | 'POS'
}

type CreateStaffPayload = {
  email?: unknown
  name?: unknown
  password?: unknown
}

class StaffAccountError extends Error {
  status: number

  constructor(message: string, status: number) {
    super(message)
    this.status = status
  }
}

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function getCreateStaffErrorMessage(error: unknown) {
  if (!(error instanceof Error)) {
    return 'Unable to create the staff account.'
  }

  const message = error.message.trim()
  const lowerMessage = message.toLowerCase()

  if (lowerMessage.includes('already') || lowerMessage.includes('registered')) {
    return 'That email address already has an account.'
  }

  if (lowerMessage.includes('password')) {
    return 'Use a stronger password with at least 6 characters.'
  }

  return message || 'Unable to create the staff account.'
}

async function requireAdminActor(request: NextRequest) {
  const actor = await getRequestActor(request)

  if (!actor || actor.role !== 'ADMIN') {
    return null
  }

  return actor
}

async function loadCustomerSummaries() {
  const supabase = createSupabaseAdminClient()
  const [{ data: profiles, error: profilesError }, { data: orders, error: ordersError }] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('id, email, name, role, created_at')
        .order('created_at', { ascending: false }),
      supabase
        .from('store_orders')
        .select('id, customer_id, customer_email, payment_status, total, source'),
    ])

  if (ordersError) {
    throw ordersError
  }

  if (profilesError) {
    throw profilesError
  }

  const profileRows = (profiles ?? []) as ProfileRow[]
  const orderRows = (orders ?? []) as OrderRow[]

  return profileRows.map((profile) => {
    const matchingOrders = orderRows.filter((order) => {
      const normalizedOrderEmail = order.customer_email.trim().toLowerCase()
      const normalizedProfileEmail = profile.email.trim().toLowerCase()

      return (
        order.source === 'ONLINE' &&
        order.payment_status === 'Paid' &&
        (order.customer_id === profile.id || normalizedOrderEmail === normalizedProfileEmail)
      )
    })

    const totalSpent = matchingOrders.reduce((sum, order) => sum + Number(order.total), 0)

    return {
      id: profile.id,
      name: profile.name,
      email: profile.email,
      role: profile.role,
      orders: matchingOrders.length,
      spent: totalSpent,
      joined: profile.created_at,
    }
  })
}

export async function GET(request: NextRequest) {
  try {
    const actor = await requireAdminActor(request)

    if (!actor) {
      return NextResponse.json({ error: 'Only admins can view customer data.' }, { status: 401 })
    }

    const summaries = await loadCustomerSummaries()

    return NextResponse.json({ customers: summaries })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to load customer data.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const actor = await requireAdminActor(request)

    if (!actor) {
      return NextResponse.json({ error: 'Only admins can create staff accounts.' }, { status: 401 })
    }

    const payload = (await request.json().catch(() => null)) as CreateStaffPayload | null
    const name = typeof payload?.name === 'string' ? normalizeName(payload.name) : ''
    const email = typeof payload?.email === 'string' ? normalizeEmail(payload.email) : ''
    const password = typeof payload?.password === 'string' ? payload.password.trim() : ''

    if (!name) {
      return NextResponse.json({ error: 'Enter the staff member name.' }, { status: 400 })
    }

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid staff email address.' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        name,
        createdByAdminId: actor.id,
      },
    })

    if (createUserError) {
      throw new StaffAccountError(getCreateStaffErrorMessage(createUserError), 400)
    }

    const createdUserId = createdUser.user?.id

    if (!createdUserId) {
      throw new Error('Supabase did not return the created user id.')
    }

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: createdUserId,
          email,
          name,
          role: 'STAFF',
        },
        {
          onConflict: 'id',
        },
      )

    if (profileError) {
      await supabase.auth.admin.deleteUser(createdUserId)
      throw profileError
    }

    return NextResponse.json(
      {
        message: 'Staff account created successfully.',
        staff: {
          id: createdUserId,
          email,
          name,
          role: 'STAFF',
        },
      },
      { status: 201 },
    )
  } catch (error) {
    const message = getCreateStaffErrorMessage(error)
    const status = error instanceof StaffAccountError ? error.status : 500
    return NextResponse.json({ error: message }, { status })
  }
}
