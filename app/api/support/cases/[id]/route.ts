import { NextRequest, NextResponse } from 'next/server'
import { getRequestActor } from '@/lib/server-auth'
import { updateSupportCase } from '@/lib/support'
import type { SupportStatus } from '@/lib/support-types'

function isSupportStatus(value: string): value is SupportStatus {
  return ['open', 'waiting_on_staff', 'waiting_on_customer', 'resolved', 'closed'].includes(value)
}

export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await getRequestActor(request)

    if (!actor || (actor.role !== 'ADMIN' && actor.role !== 'STAFF')) {
      return NextResponse.json({ error: 'Only support staff can update support cases.' }, { status: 401 })
    }

    const { id } = await context.params
    const body = (await request.json().catch(() => null)) as
      | {
          status?: string
          assignedTo?: string | null
        }
      | null

    const nextStatus = typeof body?.status === 'string' && isSupportStatus(body.status) ? body.status : undefined
    const assignedTo =
      body && Object.prototype.hasOwnProperty.call(body, 'assignedTo')
        ? body.assignedTo ?? null
        : undefined

    const supportCase = await updateSupportCase(actor, id, {
      status: nextStatus,
      assignedTo,
    })

    return NextResponse.json({ case: supportCase })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to update the support case.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

