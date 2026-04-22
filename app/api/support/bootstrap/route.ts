import { NextRequest, NextResponse } from 'next/server'
import { getRequestActor } from '@/lib/server-auth'
import { getSupportBootstrapPayload } from '@/lib/support'

export async function GET(request: NextRequest) {
  try {
    const actor = await getRequestActor(request)
    const payload = await getSupportBootstrapPayload(actor)

    return NextResponse.json(payload)
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to load guided support right now.'

    return NextResponse.json({ error: message }, { status: 500 })
  }
}

