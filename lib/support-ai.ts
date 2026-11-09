import '@/lib/server-only'

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

  // Check standard OpenAI / Ollama choices format
  const choices = (payload as { choices?: unknown }).choices
  if (Array.isArray(choices) && choices.length > 0) {
    const firstChoice = choices[0] as { message?: { content?: unknown } }
    if (typeof firstChoice?.message?.content === 'string' && firstChoice.message.content.trim()) {
      return firstChoice.message.content.trim()
    }
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

export interface ConciergeChatInput {
  userMessage: string
  customerName?: string
  category?: string
  orderContext?: {
    id: string
    status: string
    paymentStatus?: string
    total?: number
  } | null
  conversationHistory?: Array<{
    role: 'user' | 'assistant'
    content: string
  }>
}

export function isHumanEscalationRequest(text: string): boolean {
  const normalized = text.toLowerCase()
  return (
    normalized.includes('admin') ||
    normalized.includes('human') ||
    normalized.includes('agent') ||
    normalized.includes('staff') ||
    normalized.includes('live support') ||
    normalized.includes('tao') ||
    normalized.includes('tawo') ||
    normalized.includes('istorya sa tao') ||
    normalized.includes('makigstorya') ||
    normalized.includes('kaistorya') ||
    normalized.includes('ka-istorya') ||
    normalized.includes('reklamo') ||
    normalized.includes('complaint') ||
    normalized.includes('ticket') ||
    normalized.includes('representative') ||
    normalized.includes('dili kasabot') ||
    normalized.includes('dili makaya') ||
    normalized.includes('guba') ||
    normalized.includes('damaged') ||
    normalized.includes('wrong item') ||
    normalized.includes('dispute')
  )
}

export function cleanBotResponseText(rawText: string): string {
  if (!rawText) return ''

  return (
    rawText
      // Remove double asterisks (bold) and single asterisks (italics)
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\*([^*]+)\*/g, '$1')
      .replace(/\*/g, '')
      // Remove double em-dashes (—— or --- or --)
      .replace(/——+/g, ', ')
      .replace(/--+/g, ' - ')
      // Clean up strange quotation marks around single words like "best"
      .replace(/"([^"]{1,20})"/g, '$1')
      // Clean up markdown bullet points at start of lines
      .replace(/^\s*[-•]\s+/gm, '')
      // Clean up multiple spaces
      .replace(/[ \t]+/g, ' ')
      .trim()
  )
}

export async function generateConciergeChatReply(input: ConciergeChatInput): Promise<string | null> {
  const ollamaKey = getOptionalServerEnv('OLLAMA_API_KEY')
  if (!ollamaKey) {
    return null
  }

  const host = getOptionalServerEnv('OLLAMA_HOST') ?? 'https://ollama.com'
  const model = getOptionalServerEnv('OLLAMA_MODEL') ?? 'gemma4:31b-cloud'

  const systemPrompt = `You are the Senior Fragrance Consultant & Concierge at Spray & Sniff, an artisanal luxury perfume atelier in Mabini, Manila.

STYLE & FORMATTING REQUIREMENTS (VERY STRICT):
1. NEVER use asterisks (* or **), hashtags (#), bullet points, or any markdown formatting.
2. NEVER use double dashes (—— or --). Use natural punctuation like commas or periods.
3. NEVER place quotation marks around common words (e.g. write best scent, not "best" scent).
4. Address the client respectfully and warmly. Speak with the poise, understated elegance, and sophistication of a high-end luxury maison.
5. Keep answers concise, polished, and helpful (typically 2 to 3 sentences).

ATELIER SIGNATURES:
- Midnight Elegance: Dark plum, amber, nocturnal musk, rich bourbon vanilla. Perfect for evening affairs, dates, and celebrations.
- Azure Bloom: Crisp bergamot, mandarin, white florals, subtle mineral sea salt. Ideal for radiant, fresh daytime wear.
- Velvet Santal: Mysore sandalwood, cardamom, violet iris, dry cedar. Distinguished unisex composition.
- Solar Neroli: Orange blossom, neroli, petitgrain, bright citrus. Vibrant and uplifting.
- Fragrance Match Quiz: Available at /discovery to help clients find their personal signature scent.
- Delivery: 2 to 3 business days within Metro Manila, 3 to 5 business days for provincial addresses.
- Returns & Assistance: Sealed bottles can be returned within 7 days. If a client needs human intervention or staff help, reassure them that an administrator will assist them promptly.

LANGUAGE:
If addressed in Cebuano/Bisaya or Tagalog, reply fluently and naturally in that language with the same warm luxury boutique grace. Never invent fake tracking numbers or personal order data.`

  const messages: Array<{ role: string; content: string }> = [
    { role: 'system', content: systemPrompt },
  ]

  if (input.conversationHistory && input.conversationHistory.length > 0) {
    for (const msg of input.conversationHistory.slice(-4)) {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content,
      })
    }
  }

  const userPromptParts: string[] = []
  if (input.customerName) {
    userPromptParts.push(`Customer: ${input.customerName}`)
  }
  if (input.orderContext) {
    userPromptParts.push(`Order Context: ${input.orderContext.id} (${input.orderContext.status}, payment: ${input.orderContext.paymentStatus ?? 'pending'})`)
  }
  userPromptParts.push(`Message: ${input.userMessage}`)

  messages.push({
    role: 'user',
    content: userPromptParts.join('\n'),
  })

  try {
    const response = await fetch(`${host.replace(/\/$/, '')}/v1/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${ollamaKey}`,
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
      }),
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json().catch(() => null)
    const reply = data?.choices?.[0]?.message?.content
    return typeof reply === 'string' && reply.trim()
      ? cleanBotResponseText(compactText(reply))
      : null
  } catch {
    return null
  }
}

async function maybeGenerateAISummary({ fallback, intent, payload }: AISummaryRequest) {
  const ollamaKey = getOptionalServerEnv('OLLAMA_API_KEY')
  const openAiKey = getOptionalServerEnv('OPENAI_API_KEY')

  if (!ollamaKey && !openAiKey) {
    return fallback
  }

  if (ollamaKey) {
    const host = getOptionalServerEnv('OLLAMA_HOST') ?? 'https://ollama.com'
    const model = getOptionalServerEnv('OLLAMA_MODEL') ?? 'gemma4:31b-cloud'

    try {
      const response = await fetch(`${host.replace(/\/$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${ollamaKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            {
              role: 'system',
              content:
                'You are the concise Spray & Sniff perfume concierge in Mabini atelier. Use only the provided JSON facts. Never invent data or statuses. Keep the response to 2 short sentences.',
            },
            {
              role: 'user',
              content: `Intent: ${intent}\nFacts:\n${JSON.stringify(payload, null, 2)}`,
            },
          ],
          stream: false,
        }),
        cache: 'no-store',
      })

      if (response.ok) {
        const data = await response.json().catch(() => null)
        const text = extractOpenAIResponseText(data)
        if (text) return cleanBotResponseText(compactText(text))
      }
    } catch {
      // Fall through to OpenAI or fallback
    }
  }

  if (!openAiKey) {
    return fallback
  }

  const model = getOptionalServerEnv('OPENAI_MODEL') ?? 'gpt-5'

  try {
    const response = await fetch('https://api.openai.com/v1/responses', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openAiKey}`,
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
    return text ? cleanBotResponseText(compactText(text)) : fallback
  } catch {
    return fallback
  }
}

export async function buildSupportWelcomeMessage(
  payload: Pick<SupportBootstrapPayload, 'customer' | 'recentCases' | 'recentOrders'>,
) {
  const fallback = payload.customer
    ? `Hi ${payload.customer.name}. Welcome to Spray & Sniff Concierge! How can I assist you today? You can ask for fragrance recommendations, track an order, or submit a support inquiry.`
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
        courier: order.courier ?? null,
        trackingNumber: order.trackingNumber ?? null,
      })),
    },
  })
}

export async function buildOrderDetailMessage(order: OrderRecord) {
  const latestUpdate = order.timeline[order.timeline.length - 1]
  const trackingNote = order.trackingNumber
    ? `Courier waybill: ${order.trackingNumber} (${order.courier || 'Courier Partner'}). Real-time satellite tracking is active on your /track page.`
    : 'Tracking progress will appear once dispatched to the courier.'

  const fallback = compactText(
    `${order.id} is currently ${order.status}. ${latestUpdate ? latestUpdate.note : trackingNote} ${
      order.actionAvailability?.canCancel
        ? 'You can still cancel this order from support.'
        : order.actionAvailability?.cancelBlockedReason ??
          'Delivery progress updates automatically via our courier network.'
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
      courier: order.courier ?? null,
      trackingNumber: order.trackingNumber ?? null,
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
  if (isHumanEscalationRequest(input.requestMessage)) {
    return `Gipasa na nako ang imong concern sa among Live Admin Team.\n\nTicket Ref: ${input.caseId}\nPriority: High (Waiting on Staff)\n\nNaka-notify na ang among team sa Admin Inbox ug mo-reply sila dire sa chat thread. Mahimo nimong idugang ang ubang detalye samtang nagpaabot ka.`
  }

  const aiAnswer = await generateConciergeChatReply({
    userMessage: input.requestMessage,
    category: input.category,
    orderContext: input.order
      ? {
          id: input.order.id,
          status: input.order.status,
          paymentStatus: input.order.paymentStatus,
          total: input.order.total,
        }
      : null,
  })

  if (aiAnswer) {
    return `${aiAnswer}\n\n(Ticket ref: ${input.caseId})`
  }

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
