import { NextResponse } from 'next/server'
import { buildVerificationUrl, createVerificationToken } from '@/lib/auth-email'
import { sendAccountVerificationEmail } from '@/lib/mailer'
import { ADMIN_EMAIL } from '@/lib/site'
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

function getSignupErrorResponse(message: string) {
  const normalized = message.toLowerCase()

  if (isDuplicateUserError(message)) {
    return {
      body: { error: 'That email address is already registered.' },
      status: 400,
    }
  }

  if (
    normalized.includes('database error') ||
    normalized.includes('relation') ||
    normalized.includes('schema') ||
    normalized.includes('trigger')
  ) {
    return {
      body: {
        error:
          'Your new Supabase project is missing the app database schema. Run supabase/schema.sql or `supabase db push`, then try signing up again.',
      },
      status: 500,
    }
  }

  return {
    body: { error: message || 'Unable to create your account.' },
    status: 400,
  }
}

import { validateContactNumber, validateBirthdate, validateEmailAddress } from '@/lib/customer-validation'

export async function POST(request: Request) {
  try {
    const payload = (await request.json()) as {
      email?: unknown
      password?: unknown
      name?: unknown
      phone?: unknown
      birthdate?: unknown
      age?: unknown
      address?: unknown
      city?: unknown
      postalCode?: unknown
    }

    const email = typeof payload.email === 'string' ? normalizeEmail(payload.email) : ''
    const password = typeof payload.password === 'string' ? payload.password : ''
    const name = typeof payload.name === 'string' ? normalizeName(payload.name) : ''
    const phone = typeof payload.phone === 'string' ? payload.phone.trim() : ''
    const birthdate = typeof payload.birthdate === 'string' ? payload.birthdate.trim() : ''
    const address = typeof payload.address === 'string' ? payload.address.trim() : ''
    const city = typeof payload.city === 'string' ? payload.city.trim() : ''
    const postalCode = typeof payload.postalCode === 'string' ? payload.postalCode.trim() : ''

    const emailValidation = validateEmailAddress(email)
    if (!emailValidation.isValid) {
      return NextResponse.json({ error: emailValidation.error || 'Enter a valid email address.' }, { status: 400 })
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 })
    }

    if (!name || name.length < 2) {
      return NextResponse.json({ error: 'Enter your full name.' }, { status: 400 })
    }

    let normalizedPhone: string | null = null
    if (phone) {
      const phoneValidation = validateContactNumber(phone)
      if (!phoneValidation.isValid) {
        return NextResponse.json({ error: phoneValidation.error || 'Invalid contact number.' }, { status: 400 })
      }
      normalizedPhone = phoneValidation.normalized
    }

    let validAge: number | null = null
    if (birthdate) {
      const birthValidation = validateBirthdate(birthdate, 13)
      if (!birthValidation.isValid) {
        return NextResponse.json({ error: birthValidation.error || 'Invalid birthdate.' }, { status: 400 })
      }
      validAge = birthValidation.age
    }

    const isAdminSignup = email === ADMIN_EMAIL.trim().toLowerCase()
    const supabase = createSupabaseAdminClient()
    const { data: createdUser, error: createUserError } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: isAdminSignup,
      user_metadata: { name },
    })

    if (createUserError) {
      const message = createUserError.message || 'Unable to create your account.'
      const response = getSignupErrorResponse(message)
      return NextResponse.json(response.body, { status: response.status })
    }

    const userId = createdUser.user?.id

    if (!userId) {
      return NextResponse.json({ error: 'Supabase did not return the new user id.' }, { status: 500 })
    }

    const profileData: Record<string, unknown> = {
      id: userId,
      email,
      name,
      role: isAdminSignup ? 'ADMIN' : 'USER',
    }

    if (normalizedPhone) profileData.phone = normalizedPhone
    if (birthdate) profileData.birthdate = birthdate
    if (validAge !== null) profileData.age = validAge
    if (address) profileData.address = address
    if (city) profileData.city = city
    if (postalCode) profileData.postal_code = postalCode

    const { error: profileError } = await supabase.from('profiles').upsert(
      profileData,
      { onConflict: 'id' },
    )

    if (profileError) {
      await supabase.auth.admin.deleteUser(userId)
      const message = profileError.message?.toLowerCase() ?? ''
      const error = message.includes('relation') || message.includes('schema')
        ? 'Your new Supabase project is missing the app database schema. Run supabase/schema.sql or `supabase db push`, then try signing up again.'
        : 'Unable to save your profile.'
      return NextResponse.json({ error }, { status: 500 })
    }

    if (!isAdminSignup) {
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
    }

    return NextResponse.json({
      email,
      requiresEmailVerification: !isAdminSignup,
      message: isAdminSignup ? 'Admin account created.' : 'Verification email sent.',
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unable to create your account.' },
      { status: 500 },
    )
  }
}
