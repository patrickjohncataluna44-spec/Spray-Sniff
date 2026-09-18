import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import type { TrackingResult } from '@/lib/tracking-types'

async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {}

  try {
    const supabase = getSupabaseBrowserClient()
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }
  } catch (error) {
    console.warn('Unable to read the current session for tracking.', error)
  }

  return headers
}

/**
 * Fetches read-only delivery tracking for an order.
 * Tracking reflects the delivery progress saved by the store's admin team;
 * customers can only view progress for their own orders.
 */
export async function fetchTrackingInfo(trackingNumber: string): Promise<TrackingResult> {
  const trimmed = trackingNumber.trim()

  if (!trimmed) {
    throw new Error('Please enter a tracking number.')
  }

  const res = await fetch(`/api/track?number=${encodeURIComponent(trimmed)}`, {
    headers: await getAuthHeaders(),
    cache: 'no-store',
  })

  const payload = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(payload?.error || 'Unable to retrieve tracking information.')
  }

  return payload as TrackingResult
}
