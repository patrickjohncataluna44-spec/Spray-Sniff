import { NextResponse } from 'next/server'
import { buildVerificationUrl, createVerificationToken } from '@/lib/auth-email'
import { sendAccountVerificationEmail } from '@/lib/mailer'
import { createSupabaseAdminClient } from '@/lib/supabase-server'

function normalizeEmail(value: string) {
  return value.trim().toLowerCase()
}

function normalizeName(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function isDuplicateUserError(message: string) {
  const normalized = message.toLowerCase()
  return normalized.includes('already been registered') || normalized.includes('already registered')
}

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      email?: unknown
      password?: unknown
      name?: unknown
    }

    const email = typeof payload.email === 'string' ? normalizeEmail(payload.email) : ''
    const password = typeof payload.password === 'string' ? payload.password : ''
    const name = typeof payload.name === 'string' ? normalizeName(payload.name) : ''

    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
    }

    if (!name) {
      return NextResponse.json({ error: 'Enter your full name.' }, { status: 400 })
    }

    const supabase = createSupabaseAdminClient()
    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: false,
      user_metadata: { name },
    })

    if (createUserError) {
      const message = createUserError.message || 'Unable to create your account.'
      return NextResponse.json(
        { error: isDuplicateUserError(message) ? 'That email address is already registered.' : message },
        { status: 400 },
      )
    }

    const userId = createdUser.user?.id

    if (!userId) {
      return NextResponse.json({ error: 'Supabase did not return the new user id.' }, { status: 500 })
    }

    const { error: profileError } = await supabase.from('profiles').upsert(
      {
        id: userId,
        email,
        name,
      },
      { onConflict: 'id' },
    )

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Unable to save your profile.' }, { status: 500 })
    }

    try {
      const token = createVerificationToken(userId, email)
      const verificationUrl = buildVerificationUrl({
        token,
        requestOrigin: new URL(request.url).origin,
      })

      await sendAccountVerificationEmail({ email, name, verificationUrl })
    } catch {
      await supabase.auth.admin.deleteUser(userId)
      return NextResponse.json({ error: 'Unable to send the verification email.' }, { status: 500 })
    }

    return NextResponse.json({
      email,
      requiresEmailVerification: true,
      message: 'Verification email sent.',
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create your account.' },
      { status: 500 },
    )
  }
}
