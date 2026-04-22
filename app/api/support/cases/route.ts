import { NextRequest, NextResponse } from 'next/server'
import { getRequestActor } from '@/lib/server-auth'
import {
  getSupportCaseDetail,
  listAssignableSupportStaff,
  listSupportCases,
} from '@/lib/support'
import type { SupportCategory, SupportStatus } from '@/lib/support-types'

function isSupportStatus(value: string): value is SupportStatus {
  return ['open', 'waiting_on_staff', 'waiting_on_customer', 'resolved', 'closed'].includes(value)
}

function isSupportCategory(value: string): value is SupportCategory {
  return ['order_help', 'payment_issue', 'refund_request', 'general'].includes(value)
}

export async function GET(request: NextRequest) {
  try {
    const actor = await getRequestActor(request)

    if (!actor) {
      return NextResponse.json({ error: 'Sign in to view support cases.' }, { status: 401 })
    }

    const caseId = request.nextUrl.searchParams.get('id')
    if (caseId) {
      const supportCase = await getSupportCaseDetail(actor, caseId)

      if (!supportCase) {
        return NextResponse.json({ error: 'Support case not found.' }, { status: 404 })
      }

      return NextResponse.json({ case: supportCase })
    }

    const statusParam = request.nextUrl.searchParams.get('status')
    const categoryParam = request.nextUrl.searchParams.get('category')
    const limitParam = request.nextUrl.searchParams.get('limit')
    const filters = {
      status: statusParam && isSupportStatus(statusParam) ? statusParam : undefined,
      category: categoryParam && isSupportCategory(categoryParam) ? categoryParam : undefined,
      limit: limitParam ? Number(limitParam) : undefined,
    }

    const [cases, staffMembers] = await Promise.all([
      listSupportCases(actor, filters),
      actor.role === 'USER' ? Promise.resolve([]) : listAssignableSupportStaff(actor),
    ])

    return NextResponse.json({
      cases,
      staffMembers,
    })
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load support cases.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

