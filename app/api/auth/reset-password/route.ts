import { NextResponse } from 'next/server'
import { readPasswordResetToken } from '@/lib/auth-email'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as {
      token?: unknown
      password?: unknown
    }

    const token = typeof payload.token === 'string' ? payload.token.trim() : ''
    const password = typeof payload.password === 'string' ? payload.password : ''

    if (!token) {
      return NextResponse.json({ error: 'Missing or invalid reset token.' }, { status: 400 })
    }

    if (!password || password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters long.' }, { status: 400 })
    }

    // Verify token validity and expiration
    const tokenPayload = readPasswordResetToken(token)
    const supabase = createSupabaseAdminClient()

    // Update user password in Supabase Auth Admin
    const { error: updateError } = await supabase.auth.admin.updateUserById(tokenPayload.userId, {
      password,
    })

    if (updateError) {
      throw updateError
    }

    return NextResponse.json({
      message: 'Password has been successfully updated. You can now sign in.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to reset password.'
    return NextResponse.json({ error: message }, { status: 400 })
  }
}
