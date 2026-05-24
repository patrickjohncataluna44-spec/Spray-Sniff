import type { NextRequest } from 'next/server'
import type { StoreActor } from '@/lib/store-engine'
import { ADMIN_EMAIL } from '@/lib/site'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization')?.trim()

  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return null
  }

  return authorization.slice(7).trim() || null
}

function normalizeEmail(value: string | null | undefined) {
  return value?.trim().toLowerCase() ?? ''
}

function normalizeRole(value: unknown): StoreActor['role'] | null {
  if (value === 'ADMIN' || value === 'STAFF' || value === 'USER') {
    return value
  }

  return null
}

export async function getRequestActor(request: NextRequest): Promise<StoreActor | null> {
  const token = getBearerToken(request)

  if (!token) {
    return null
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase.auth.getUser(token)

  if (error || !data.user) {
    return null
  }

  const normalizedUserEmail = normalizeEmail(data.user.email)
  const normalizedAdminEmail = normalizeEmail(ADMIN_EMAIL)

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, name, role')
    .eq('id', data.user.id)
    .maybeSingle()

  const normalizedProfileRole = normalizeRole(profile?.role)

  if (profile && normalizedProfileRole) {
    return {
      id: profile.id,
      email: profile.email,
      name: profile.name,
      role: normalizedProfileRole,
    }
  }

  if (normalizedUserEmail && normalizedUserEmail === normalizedAdminEmail) {
    const fallbackName =
      typeof data.user.user_metadata?.name === 'string' && data.user.user_metadata.name.trim()
        ? data.user.user_metadata.name.trim()
        : 'Spray & Sniff Admin'

    await supabase.from('profiles').upsert(
      {
        id: data.user.id,
        email: normalizedUserEmail,
        name: profile?.name?.trim() || fallbackName,
        role: 'ADMIN',
      },
      { onConflict: 'id' },
    )

    return {
      id: data.user.id,
      email: normalizedUserEmail,
      name: profile?.name?.trim() || fallbackName,
      role: 'ADMIN',
    }
  }

  if (!profile) {
    return null
  }

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: 'USER',
  }
}
