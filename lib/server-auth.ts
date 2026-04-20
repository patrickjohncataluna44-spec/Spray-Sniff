import type { NextRequest } from 'next/server'
import type { StoreActor } from '@/lib/store-engine'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get('authorization')?.trim()

  if (!authorization?.toLowerCase().startsWith('bearer ')) {
    return null
  }

  return authorization.slice(7).trim() || null
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

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, email, name, role')
    .eq('id', data.user.id)
    .maybeSingle()

  if (!profile) {
    return null
  }

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
  }
}
