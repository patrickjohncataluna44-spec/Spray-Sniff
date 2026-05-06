import { NextResponse } from 'next/server'
import { buildVerificationUrl, createVerificationToken } from '@/lib/auth-email'
import { sendAccountVerificationEmail } from '@/lib/mailer'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as { email?: unknown }
    const email = typeof payload.email === 'string' ? normalizeEmail(payload.email) : ''

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const { data, error } = await supabase.auth.admin.listUsers()

    if (error) {
      throw error
    }

    const matchedUser = (data.users ?? []).find((user) => user.email?.trim().toLowerCase() === email)

    if (!matchedUser || !matchedUser.id) {
      return NextResponse.json({ error: 'No account was found for that email address.' }, { status: 404 })
    }

    if (matchedUser.email_confirmed_at) {
      return NextResponse.json({ error: 'That account is already verified. Please sign in.' }, { status: 400 })
    }

    const name =
      typeof matchedUser.user_metadata?.name === 'string'
        ? matchedUser.user_metadata.name
        : matchedUser.email?.split('@')[0] ?? 'Customer'

    const token = createVerificationToken(matchedUser.id, email)
    const verificationUrl = buildVerificationUrl({
      token,
      requestOrigin: new URL(request.url).origin,
    })

    await sendAccountVerificationEmail({ email, name, verificationUrl })

    return NextResponse.json({ message: 'Verification email sent.' })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to resend verification email.' },
      { status: 500 },
    )
  }
}
