import 'server-only'

import type { OrderRecord } from '@/lib/store-engine'
import type {
  SupportBootstrapPayload,
  SupportCase,
  SupportCategory,
  SupportPaymentSnapshot,
} from '@/lib/support-types'
import { getOptionalServerEnv } from '@/lib/server-runtime-env'

type AISummaryIntent = 'welcome' | 'orders' | 'order' | 'payment' | 'case'

interface AISummaryRequest {
  intent: AISummaryIntent
  fallback: string
  payload: Record<string, unknown>
}

function compactText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function extractOpenAIResponseText(payload: unknown) {
  if (!payload || typeof payload !== 'object') {
    return null
  }

  const outputText = (payload as { output_text?: unknown }).output_text
  if (typeof outputText === 'string' && outputText.trim()) {
    return outputText.trim()
  }

  const output = (payload as { output?: unknown }).output
  if (!Array.isArray(output)) {
    return null
  }

  const segments: string[] = []

  output.forEach((item) => {
    if (!item || typeof item !== 'object') {
      return
    }

    const content = (item as { content?: unknown }).content
    if (!Array.isArray(content)) {
      return
    }

    content.forEach((contentItem) => {
      if (!contentItem || typeof contentItem !== 'object') {
        return
      }

      const type = (contentItem as { type?: unknown }).type
      const text = (contentItem as { text?: unknown }).text

      if (type === 'output_text' && typeof text === 'string' && text.trim()) {
        segments.push(text.trim())
      }
    })
  })

  return segments.length > 0 ? segments.join('\n').trim() : null
}

async function maybeGenerateAISummary({ fallback, intent, payload }: AISummaryRequest) {
  const apiKey = getOptionalServerEnv('OPENAI_API_KEY')

  if (!apiKey) {
    return fallback
  }

  const model = getOptionalServerEnv('OPENAI_MODEL') ?? 'gpt-5'

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: 'developer',
            content:
              'You are a concise support-writing assistant. Use only the provided JSON facts. Never invent data, never change statuses, and keep the response to 2 short sentences.',
          },
          {
            role: 'user',
            content: `Intent: ${intent}\nFacts:\n${JSON.stringify(payload, null, 2)}`,
          },
        ],
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      return fallback
    }

    const data = await response.json().catch(() => null)
    const text = extractOpenAIResponseText(data)
    return text ? compactText(text) : fallback
  } catch {
    return fallback
  }
}

export async function buildSupportWelcomeMessage(
  payload: Pick<SupportBootstrapPayload, 'customer' | 'recentCases' | 'recentOrders'>,
) {
  const fallback = payload.customer
    ? payload.recentOrders.length > 0
      ? `Hi ${payload.customer.name}. I can see ${payload.recentOrders.length} online order${payload.recentOrders.length === 1 ? '' : 's'} on your account. Pick a quick action below and I'll guide you through tracking, payment details, delivery confirmation, or creating a support request.`
      : `Hi ${payload.customer.name}. I'm ready to help with orders, payments, and support requests. I don't see any online orders on this account yet, but you can still ask for help and I'll open a case for the team.`
    : 'Welcome to Spray & Sniff support. Sign in to view your orders and payment details, or use the quick help options below for general guidance.'

  return maybeGenerateAISummary({
    intent: 'welcome',
    fallback,
    payload,
  })
}

export async function buildOrdersOverviewMessage(orders: OrderRecord[]) {
  const fallback =
    orders.length === 0
      ? "I couldn't find any online orders linked to this account yet."
      : `I found ${orders.length} online order${orders.length === 1 ? '' : 's'} for this account. Tap an order card to review tracking, payment details, or the next available self-service action.`

  return maybeGenerateAISummary({
    intent: 'orders',
    fallback,
    payload: {
      orders: orders.map((order) => ({
        id: order.id,
        status: order.status,
        total: order.total,
        paymentStatus: order.paymentStatus,
        canCancel: order.actionAvailability?.canCancel ?? false,
        canConfirmReceived: order.actionAvailability?.canConfirmReceived ?? false,
      })),
    },
  })
}

export async function buildOrderDetailMessage(order: OrderRecord) {
  const latestUpdate = order.timeline[order.timeline.length - 1]
  const fallback = compactText(
    `${order.id} is currently ${order.status}. ${latestUpdate ? latestUpdate.note : 'Tracking details are available in your timeline.'} ${
      order.actionAvailability?.canCancel
        ? 'You can still cancel this order from support.'
        : order.actionAvailability?.canConfirmReceived
          ? 'You can confirm receipt once the parcel is in your hands.'
          : order.actionAvailability?.cancelBlockedReason ??
            order.actionAvailability?.confirmBlockedReason ??
            'There are no direct account actions available right now.'
    }`,
  )

  return maybeGenerateAISummary({
    intent: 'order',
    fallback,
    payload: {
      id: order.id,
      status: order.status,
      createdAt: order.createdAt,
      paymentStatus: order.paymentStatus,
      total: order.total,
      latestUpdate: latestUpdate?.note ?? null,
      actionAvailability: order.actionAvailability ?? null,
    },
  })
}

export async function buildPaymentDetailMessage(
  order: OrderRecord,
  payment: SupportPaymentSnapshot | undefined,
) {
  const reference = payment?.reference ?? 'No payment reference recorded yet'
  const fallback = compactText(
    `${order.id} uses ${payment?.paymentMethod ?? order.paymentMethod} and is currently marked ${payment?.paymentStatus ?? order.paymentStatus}. Reference: ${reference}. ${
      payment?.paidAt ? `Payment was recorded on ${new Date(payment.paidAt).toLocaleString()}.` : ''
    }`,
  )

  return maybeGenerateAISummary({
    intent: 'payment',
    fallback,
    payload: {
      orderId: order.id,
      status: order.status,
      payment,
    },
  })
}

export async function buildCaseSummaryMessage(input: {
  category: SupportCategory
  caseId: string
  order?: OrderRecord
  requestMessage: string
}) {
  const fallback = compactText(
    `${input.caseId} has been opened as a ${input.category.replace(/_/g, ' ')} request${
      input.order ? ` for ${input.order.id}` : ''
    }. The support team will see your request, order details, and payment context in the admin inbox.`,
  )

  return maybeGenerateAISummary({
    intent: 'case',
    fallback,
    payload: input,
  })
}

export async function buildCaseHandoffSummary(input: {
  category: SupportCategory
  order?: OrderRecord
  requestMessage: string
  supportCase?: Pick<SupportCase, 'id' | 'status' | 'priority'>
}) {
  const orderReference = input.order
    ? `${input.order.id} (${input.order.status}, ${input.order.paymentStatus})`
    : 'No linked order'
  const fallback = compactText(
    `${input.category.replace(/_/g, ' ')} request. Order: ${orderReference}. Customer note: ${input.requestMessage}`,
  )

  return maybeGenerateAISummary({
    intent: 'case',
    fallback,
    payload: input,
  })
}
