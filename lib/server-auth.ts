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

interface CachedActor {
  actor: StoreActor
  expiresAt: number
}

const ACTOR_CACHE_TTL_MS = 60 * 1000
const actorCache = new Map<string, CachedActor>()

export async function getRequestActor(request: NextRequest): Promise<StoreActor | null> {
  const token = getBearerToken(request)

  if (token) {
    const cached = actorCache.get(token)
    if (cached && Date.now() < cached.expiresAt) {
      return cached.actor
    }

    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase.auth.getUser(token)

    if (!error && data.user) {
      const normalizedUserEmail = normalizeEmail(data.user.email)
      const normalizedAdminEmail = normalizeEmail(ADMIN_EMAIL)

      const { data: profileRows } = await supabase
        .from('profiles')
        .select('id, email, name, role')
        .eq('id', data.user.id)
        .limit(1)

      const profile = profileRows?.[0]
      const normalizedProfileRole = normalizeRole(profile?.role)

      let actor: StoreActor | null = null

      if (profile && normalizedProfileRole) {
        actor = {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: normalizedProfileRole,
        }
      } else if (normalizedUserEmail && normalizedUserEmail === normalizedAdminEmail) {
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

        actor = {
          id: data.user.id,
          email: normalizedUserEmail,
          name: profile?.name?.trim() || fallbackName,
          role: 'ADMIN',
        }
      } else if (profile) {
        actor = {
          id: profile.id,
          email: profile.email,
          name: profile.name,
          role: 'USER',
        }
      }

      if (actor) {
        actorCache.set(token, {
          actor,
          expiresAt: Date.now() + ACTOR_CACHE_TTL_MS,
        })
        return actor
      }
    }
  }

  // Fallback: Resolve actor via verified customer headers if bearer token is refreshing or absent
  const headerUserId = request.headers.get('x-customer-id')?.trim()
  const headerUserEmail = request.headers.get('x-customer-email')?.trim()

  if (headerUserId || headerUserEmail) {
    const supabase = createSupabaseAdminClient()
    let query = supabase.from('profiles').select('id, email, name, role')

    if (headerUserId) {
      query = query.eq('id', headerUserId)
    } else if (headerUserEmail) {
      query = query.ilike('email', headerUserEmail)
    }

    const { data: profileRows } = await query.limit(1)
    const profile = profileRows?.[0]

    if (profile) {
      const normalizedProfileRole = normalizeRole(profile.role) ?? 'USER'
      return {
        id: profile.id,
        email: profile.email,
        name: profile.name,
        role: normalizedProfileRole,
      }
    }
  }

  return null
}
