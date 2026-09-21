import { NextResponse } from 'next/server'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import type { User, UserRole } from '@/lib/auth-context'

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      userId?: string
      email?: string
      name?: string
    }

    const authHeader = request.headers.get('Authorization')
    let userId = payload.userId?.trim()
    let email = payload.email?.trim().toLowerCase()
    let name = payload.name?.trim()

    const admin = createSupabaseAdminClient()

    // If Authorization Bearer token is provided, verify it
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.replace('Bearer ', '').trim()
      const { data: userData, error: userError } = await admin.auth.getUser(token)

      if (!userError && userData?.user) {
        userId = userData.user.id
        email = userData.user.email ?? email
        name = (userData.user.user_metadata?.name as string) ?? name
      }
    }

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required.' }, { status: 400 })
    }

    // Read profile with admin client (bypasses RLS, no 406 error)
    const { data: existingProfile, error: readError } = await admin
      .from('profiles')
      .select('id, email, name, role, phone, birthdate, age, address, city, postal_code')
      .eq('id', userId)
      .maybeSingle()

    if (existingProfile) {
      const row = existingProfile as {
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

      const user: User = {
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

      return NextResponse.json({ profile: user })
    }

    // Profile doesn't exist yet: upsert it safely
    const fallbackEmail = email || `${userId}@example.com`
    const fallbackName = name || fallbackEmail.split('@')[0] || 'Customer'

    const { error: upsertError } = await admin.from('profiles').upsert(
      {
        id: userId,
        email: fallbackEmail,
        name: fallbackName,
        role: 'USER',
      },
      { onConflict: 'id' },
    )

    if (upsertError) {
      console.error('Server profile upsert error:', upsertError)
    }

    const { data: newProfile } = await admin
      .from('profiles')
      .select('id, email, name, role, phone, birthdate, age, address, city, postal_code')
      .eq('id', userId)
      .maybeSingle()

    if (newProfile) {
      return NextResponse.json({ profile: newProfile })
    }

    // Fallback response if DB write was transiently delayed
    return NextResponse.json({
      profile: {
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
      },
    })
  } catch (error) {
    console.error('API profile error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
