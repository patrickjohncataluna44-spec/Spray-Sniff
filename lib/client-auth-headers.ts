import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

export function getStoredSupabaseToken(): string | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('sb-') && key.endsWith('-auth-token')) {
        const raw = localStorage.getItem(key)
        if (raw) {
          const parsed = JSON.parse(raw)
          if (parsed?.access_token) {
            return parsed.access_token
          }
        }
      }
    }
  } catch {
    // Ignore parse error
  }

  return null
}

export async function getBrowserAuthHeaders(_fallbackUserId?: string, _fallbackUserEmail?: string) {
  const headers: Record<string, string> = {}

  try {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  } catch {
    // Ignore session retrieval error
  }

  if (!headers.Authorization) {
    const storedToken = getStoredSupabaseToken()
    if (storedToken) {
      headers.Authorization = `Bearer ${storedToken}`
    }
  }

  return headers
}
