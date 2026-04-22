import { NextRequest, NextResponse } from 'next/server'
import { getRequestActor } from '@/lib/server-auth'
import { runSupportAction } from '@/lib/support'
import type { SupportActionRequest } from '@/lib/support-types'

export async function POST(request: NextRequest) {
  try {
    const actor = await getRequestActor(request)
    const body = (await request.json().catch(() => null)) as
      | {
          action?: SupportActionRequest
        }
      | null
    const action = body?.action

    if (!action?.action) {
      return NextResponse.json({ error: 'A valid support action is required.' }, { status: 400 })
    }

    const result = await runSupportAction(actor, action)

    if (!result.ok) {
      return NextResponse.json(result, { status: 400 })
    }

    return NextResponse.json(result)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to complete that support request.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

