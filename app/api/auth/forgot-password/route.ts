import { NextResponse } from 'next/server'
import { buildPasswordResetUrl, createPasswordResetToken } from '@/lib/auth-email'
import { sendPasswordResetEmail } from '@/lib/mailer'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json().catch(() => ({}))) as { email?: unknown }
    const email = typeof payload.email === 'string' ? normalizeEmail(payload.email) : ''

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()

    // Query profiles to see if the user exists
    const { data: profile } = await supabase
      .from('profiles')
      .select('id, name, email')
      .eq('email', email)
      .maybeSingle()

    // For privacy and security, don't reveal if account doesn't exist, but if it exists, send the email
    if (profile) {
      try {
        const token = createPasswordResetToken(profile.id, profile.email)
        const resetUrl = buildPasswordResetUrl({
          token,
          requestOrigin: new URL(request.url).origin,
        })

        await sendPasswordResetEmail({
          email: profile.email,
          name: profile.name,
          resetUrl,
        })
      } catch (mailError) {
        console.error('Failed to dispatch password reset email via SMTP', mailError)
        return NextResponse.json(
          { error: 'Unable to send password reset email. Please check your SMTP mail server configuration.' },
          { status: 500 },
        )
      }
    }

    return NextResponse.json({
      message: 'If an account exists with this email, a password reset link has been sent.',
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to process password reset.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
