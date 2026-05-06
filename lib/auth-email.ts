import 'server-only'

import crypto from 'crypto'
import { getOptionalServerEnv, getRequiredServerEnv } from '@/lib/server-runtime-env'

type VerificationPayload = {
  userId: string
  email: string
  exp: number
}

const VERIFY_TTL_MS = 1000 * 60 * 60 * 24

function getSecret() {
  return getOptionalServerEnv('AUTH_EMAIL_SECRET') ?? getRequiredServerEnv('SUPABASE_SERVICE_ROLE_KEY')
}

function toBase64Url(value: string) {
  return Buffer.from(value, 'utf8').toString('base64url')
}

function fromBase64Url(value: string) {
  return Buffer.from(value, 'base64url').toString('utf8')
}

function sign(encodedPayload: string) {
  return crypto.createHmac('sha256', getSecret()).update(encodedPayload).digest('base64url')
}

export function createVerificationToken(userId: string, email: string) {
  const payload: VerificationPayload = {
    userId,
    email: email.trim().toLowerCase(),
    exp: Date.now() + VERIFY_TTL_MS,
  }

  const encodedPayload = toBase64Url(JSON.stringify(payload))
  const signature = sign(encodedPayload)
  return `${encodedPayload}.${signature}`
}

export function readVerificationToken(token: string): VerificationPayload {
  const [encodedPayload, signature] = token.split('.')

  if (!encodedPayload || !signature) {
    throw new Error('Invalid verification token.')
  }

  const expectedSignature = sign(encodedPayload)

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))) {
    throw new Error('Invalid verification token.')
  }

  const payload = JSON.parse(fromBase64Url(encodedPayload)) as VerificationPayload

  if (!payload.userId || !payload.email || !payload.exp) {
    throw new Error('Invalid verification token.')
  }

  if (payload.exp < Date.now()) {
    throw new Error('This verification link has expired.')
  }

  return payload
}

export function buildVerificationUrl(options: { token: string; requestOrigin?: string }) {
  const configuredSiteUrl = getOptionalServerEnv('NEXT_PUBLIC_SITE_URL')
  const requestOrigin = options.requestOrigin?.trim()
  const baseUrl = requestOrigin || configuredSiteUrl

  if (!baseUrl) {
    throw new Error('NEXT_PUBLIC_SITE_URL is missing. Add it before sending verification emails.')
  }

  const url = new URL('/api/auth/verify-email', baseUrl)
  url.searchParams.set('token', options.token)
  return url.toString()
}
