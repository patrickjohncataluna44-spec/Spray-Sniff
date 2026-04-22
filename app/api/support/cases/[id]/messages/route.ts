import { NextRequest, NextResponse } from 'next/server'
import { addSupportCaseMessage } from '@/lib/support'
import { getRequestActor } from '@/lib/server-auth'

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getRequestActor(request)

    if (!actor) {
      return NextResponse.json({ error: 'Sign in to send support messages.' }, { status: 401 })
    }

    const { id } = await context.params
    const body = (await request.json().catch(() => null)) as
      | {
          message?: string
        }
      | null
    const message = typeof body?.message === 'string' ? body.message : ''

    const supportCase = await addSupportCaseMessage(actor, id, message)

    return NextResponse.json({ case: supportCase })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to send that support message.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}
