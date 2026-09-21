import { NextRequest, NextResponse } from 'next/server'
import { syncPaymongoOrdersToDatabase } from '@/lib/paymongo-sync'

export async function POST(_request: NextRequest) {
  try {
    const result = await syncPaymongoOrdersToDatabase()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error syncing PayMongo orders:', error)
    return NextResponse.json(
      {
        ok: false,
        syncedCount: 0,
        recoveredOrders: [],
        message: error instanceof Error ? error.message : 'Unknown sync error',
      },
      { status: 500 },
    )
  }
}

export async function GET(_request: NextRequest) {
  try {
    const result = await syncPaymongoOrdersToDatabase()
    return NextResponse.json(result)
  } catch (error) {
    console.error('Error syncing PayMongo orders:', error)
    return NextResponse.json(
      {
        ok: false,
        syncedCount: 0,
        recoveredOrders: [],
        message: error instanceof Error ? error.message : 'Unknown sync error',
      },
      { status: 500 },
    )
  }
}
