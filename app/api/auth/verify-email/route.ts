import { NextResponse } from 'next/server'
import { readVerificationToken } from '@/lib/auth-email'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

export async function GET(request: Request) {
  const url = new URL(request.url)
  const token = url.searchParams.get('token')?.trim()

  if (!token) {
    return NextResponse.redirect(new URL('/auth/signin?error=missing-token', url.origin))
  }

  try {
    const payload = readVerificationToken(token)
    const supabase = createSupabaseAdminClient()
    const { error } = await supabase.auth.admin.updateUserById(payload.userId, {
      email_confirm: true,
    })

    if (error) {
      throw error
    }

    return NextResponse.redirect(new URL('/auth/signin?verified=1', url.origin))
  } catch {
    return NextResponse.redirect(new URL('/auth/signin?error=invalid-verification-link', url.origin))
  }
}
