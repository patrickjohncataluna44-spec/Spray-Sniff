import { createClient } from '@supabase/supabase-js'
import { getRequiredServerEnv } from '@/lib/server-runtime-env'

function getRequiredEnv(
  name:
    | 'NEXT_PUBLIC_SUPABASE_URL'
    | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    | 'SUPABASE_SERVICE_ROLE_KEY',
) {
  return getRequiredServerEnv(name)
}

export function createSupabaseAdminClient() {
  return createClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}

export function createSupabaseAnonServerClient() {
  return createClient(
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_URL'),
    getRequiredEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  )
}
