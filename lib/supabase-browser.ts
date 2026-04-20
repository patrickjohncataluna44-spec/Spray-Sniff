import { createClient, type SupabaseClient } from '@supabase/supabase-js'

let browserClient: SupabaseClient | null = null
type PublicBrowserEnvName =
  | 'NEXT_PUBLIC_SUPABASE_URL'
  | 'NEXT_PUBLIC_SUPABASE_ANON_KEY'
  | 'NEXT_PUBLIC_SITE_URL'

declare global {
  interface Window {
    __APP_PUBLIC_ENV__?: Partial<Record<PublicBrowserEnvName, string>>
  }
}

function getWindowEnv(name: PublicBrowserEnvName) {
  if (typeof window === 'undefined') {
    return undefined
  }

  return window.__APP_PUBLIC_ENV__?.[name]?.trim()
}

export function getOptionalPublicBrowserEnv(name: PublicBrowserEnvName) {
  return process.env[name]?.trim() || getWindowEnv(name)
}

function getEnv(name: 'NEXT_PUBLIC_SUPABASE_URL' | 'NEXT_PUBLIC_SUPABASE_ANON_KEY') {
  const value = getOptionalPublicBrowserEnv(name)

  if (!value) {
    throw new Error(`${name} is missing. Add it to your environment before using Supabase.`)
  }

  return value
}

export function getSupabaseBrowserClient() {
  if (!browserClient) {
    browserClient = createClient(getEnv('NEXT_PUBLIC_SUPABASE_URL'), getEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'))
  }

  return browserClient
}
