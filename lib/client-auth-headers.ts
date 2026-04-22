import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

export async function getBrowserAuthHeaders() {
  const supabase = getSupabaseBrowserClient()
  const { data } = await supabase.auth.getSession()
  const token = data.session?.access_token
  const headers: Record<string, string> = {}

  if (token) {
    headers.Authorization = `Bearer ${token}`
  }

  return headers
}
