import 'server-only'

import { existsSync, readFileSync } from 'fs'
import path from 'path'

const REQUIRED_PUBLIC_ENV_NAMES = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const
const OPTIONAL_PUBLIC_ENV_NAMES = ['NEXT_PUBLIC_SITE_URL'] as const
const SERVER_ENV_NAMES = [
  ...REQUIRED_PUBLIC_ENV_NAMES,
  ...OPTIONAL_PUBLIC_ENV_NAMES,
  'SUPABASE_SERVICE_ROLE_KEY',
] as const

type RequiredPublicEnvName = (typeof REQUIRED_PUBLIC_ENV_NAMES)[number]
type OptionalPublicEnvName = (typeof OPTIONAL_PUBLIC_ENV_NAMES)[number]
type PublicEnvName = RequiredPublicEnvName | OptionalPublicEnvName
type ServerEnvName = (typeof SERVER_ENV_NAMES)[number]

let fileEnvCache: Partial<Record<ServerEnvName, string>> | null = null

function parseEnvContent(content: string) {
  const values: Partial<Record<ServerEnvName, string>> = {}

  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim()

    if (!trimmed || trimmed.startsWith('#')) {
      continue
    }

    const separatorIndex = trimmed.indexOf('=')
    if (separatorIndex <= 0) {
      continue
    }

    const key = trimmed.slice(0, separatorIndex).trim() as ServerEnvName
    const rawValue = trimmed.slice(separatorIndex + 1).trim()

    if (!SERVER_ENV_NAMES.includes(key)) {
      continue
    }

    const value =
      rawValue.startsWith('"') && rawValue.endsWith('"')
        ? rawValue.slice(1, -1)
        : rawValue.startsWith("'") && rawValue.endsWith("'")
          ? rawValue.slice(1, -1)
          : rawValue

    values[key] = value
  }

  return values
}

function loadFileEnvValues() {
  if (fileEnvCache) {
    return fileEnvCache
  }

  const env: Partial<Record<ServerEnvName, string>> = {}
  const envPaths = [path.join(process.cwd(), '.env'), path.join(process.cwd(), '.env.local')]

  for (const envPath of envPaths) {
    if (!existsSync(envPath)) {
      continue
    }

    Object.assign(env, parseEnvContent(readFileSync(envPath, 'utf8')))
  }

  fileEnvCache = env
  return env
}

export function getRequiredServerEnv(name: ServerEnvName) {
  const value = process.env[name]?.trim() || loadFileEnvValues()[name]?.trim()

  if (!value) {
    throw new Error(`${name} is missing. Add it to your environment before using Supabase.`)
  }

  return value
}

export function getOptionalServerEnv(name: ServerEnvName) {
  const value = process.env[name]?.trim() || loadFileEnvValues()[name]?.trim()

  return value || undefined
}

export function getPublicRuntimeEnv() {
  const publicEnv = {
    NEXT_PUBLIC_SUPABASE_URL: getRequiredServerEnv('NEXT_PUBLIC_SUPABASE_URL'),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: getRequiredServerEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
  } satisfies Record<RequiredPublicEnvName, string>

  const siteUrl = getOptionalServerEnv('NEXT_PUBLIC_SITE_URL')

  if (!siteUrl) {
    return publicEnv
  }

  return {
    ...publicEnv,
    NEXT_PUBLIC_SITE_URL: siteUrl,
  } satisfies Record<PublicEnvName, string>
}
