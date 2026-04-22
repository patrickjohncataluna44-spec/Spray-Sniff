import 'server-only'

import { randomUUID } from 'crypto'
import {
  getVisibleStoreState,
  loadStoreStateForActor,
  saveStoreSnapshot,
} from '@/lib/store-persistence'
import {
  orderBelongsToActor,
  performStoreAction,
  type OrderRecord,
  type StoreActor,
} from '@/lib/store-engine'
import { createSupabaseAdminClient } from '@/lib/supabase-server'
import {
  buildCaseHandoffSummary,
  buildCaseSummaryMessage,
  buildOrderDetailMessage,
  buildOrdersOverviewMessage,
  buildPaymentDetailMessage,
  buildSupportWelcomeMessage,
} from '@/lib/support-ai'
import type {
  SupportActionRequest,
  SupportActionResult,
  SupportAuthorType,
  SupportBootstrapPayload,
  SupportCase,
  SupportCategory,
  SupportFaq,
  SupportMessage,
  SupportPaymentSnapshot,
  SupportPriority,
  SupportQuickAction,
  SupportStatus,
} from '@/lib/support-types'

type SupportCaseRow = {
  id: string
  customer_id: string | null
  customer_email: string
  category: SupportCategory
  status: SupportStatus
  priority: SupportPriority
  source: 'chatbot'
  order_id: string | null
  payment_record_id: string | null
  payment_reference: string | null
  latest_summary: string | null
  assigned_to: string | null
  created_at: string
  updated_at: string
}

type SupportMessageRow = {
  id: string
  case_id: string
  author_type: SupportAuthorType
  author_id: string | null
  message: string
  metadata: Record<string, unknown> | null
  created_at: string
}

type PaymentRecordRow = {
  id: string
  order_id: string
  payment_gateway: string | null
  payment_channel: string | null
  reference: string | null
  checkout_session_id: string | null
  paid_at: string
}

type ProfileRow = {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'STAFF' | 'USER'
}

type SupportCaseFilters = {
  category?: SupportCategory
  status?: SupportStatus
  limit?: number
}

const DEFAULT_FAQS: SupportFaq[] = [
  {
    id: 'faq-track',
    question: 'How do I track my order?',
    answer:
      'You can track your order anytime through the My Orders page or by using the "Track my order" option in this support chat. You\'ll see a live timeline showing your order\'s current status and the next expected steps.',
  },
  {
    id: 'faq-cancel',
    question: 'When can I cancel my order?',
    answer:
      'You can cancel your order yourself as long as it is still in Pending or Processing status. Once it moves to Ready for Dispatch or Out for Delivery, cancellation is no longer available through self-service — please contact our support team as soon as possible.',
  },
  {
    id: 'faq-refund',
    question: 'How are refunds handled?',
    answer:
      'Refunds depend on your payment method. If you paid by card, GrabPay, or Maya, refunds can be processed automatically. If you paid via QR Ph (QR code / InstaPay), refunds must be processed manually by our team — please see the QR Ph refund FAQ below for details.',
  },
  {
    id: 'faq-refund-qrph',
    question: 'How long does a QR Ph (QR code) refund take?',
    answer:
      'Because QR Ph (InstaPay / QR code) payments are real-time bank transfers, PayMongo does not support automatic API refunds for this payment method. If your order was paid via QR Ph and you are eligible for a refund, our team will process it manually within 3–5 business days by sending the amount back to your bank account or e-wallet directly. You will be notified via email once the refund has been sent. If you have not received it after 5 business days, please open a support case and our team will follow up immediately.',
  },
  {
    id: 'faq-refund-eligibility',
    question: 'Am I eligible for a refund?',
    answer:
      'You may be eligible for a refund if: (1) your order was cancelled after payment was already collected, (2) you received a wrong or damaged item, or (3) your order was lost during delivery. To request a refund, use the "Request refund/help" option in this chat and our team will review your case within 1–2 business days.',
  },
  {
    id: 'faq-payment-methods',
    question: 'What payment methods do you accept?',
    answer:
      'We currently accept QR Ph (scan-to-pay via any banking app that supports InstaPay) and GCash through our PayMongo checkout. Cash on Delivery (COD) is also available for eligible orders. All online payments are secured and processed through PayMongo.',
  },
]

const CUSTOMER_QUICK_ACTIONS: SupportQuickAction[] = [
  {
    id: 'track_order',
    label: 'Track my order',
    description: 'See timeline updates and available account actions.',
  },
  {
    id: 'check_payment',
    label: 'Check payment',
    description: 'Review payment status, reference, and PayMongo details.',
  },
  {
    id: 'cancel_order',
    label: 'Cancel my order',
    description: 'Cancel only eligible Pending or Processing orders.',
  },
  {
    id: 'confirm_received',
    label: 'Confirm received',
    description: 'Mark an Out for Delivery parcel as received.',
  },
  {
    id: 'request_refund',
    label: 'Request refund/help',
    description: 'Open a case for refund review or order follow-up.',
  },
  {
    id: 'talk_to_support',
    label: 'Talk to support',
    description: 'Create a support case for the store team.',
  },
  {
    id: 'view_cases',
    label: 'View my cases',
    description: 'See your recent support requests and replies.',
  },
]

const GUEST_QUICK_ACTIONS: SupportQuickAction[] = [
  {
    id: 'browse_faqs',
    label: 'Browse FAQs',
    description: 'Read quick answers for delivery, payments, and refunds.',
  },
  {
    id: 'sign_in',
    label: 'Sign in',
    description: 'Sign in to access order-aware customer support.',
  },
]

function isBackofficeActor(
  actor?: StoreActor | null,
): actor is StoreActor & { role: 'ADMIN' | 'STAFF' } {
  return actor?.role === 'ADMIN' || actor?.role === 'STAFF'
}

function isCustomerActor(
  actor?: StoreActor | null,
): actor is StoreActor & { role: 'USER' } {
  return actor?.role === 'USER'
}

function normalizeText(value: string) {
  return value.trim().replace(/\s+/g, ' ')
}

function createSupportCaseId() {
  return `SUP-${Date.now().toString(36).toUpperCase()}-${randomUUID().slice(0, 6).toUpperCase()}`
}

function createSupportMessageId() {
  return `SUPMSG-${randomUUID().slice(0, 10).toUpperCase()}`
}

function getAuthorName(
  authorType: SupportAuthorType,
  profilesById: Map<string, ProfileRow>,
  message: Pick<SupportMessageRow, 'author_id'>,
  fallbackCustomerName?: string,
) {
  if (authorType === 'bot') {
    return 'Support Assistant'
  }

  if (authorType === 'system') {
    return 'System'
  }

  if (message.author_id && profilesById.has(message.author_id)) {
    return profilesById.get(message.author_id)?.name ?? 'Team Member'
  }

  return authorType === 'customer' ? fallbackCustomerName ?? 'Customer' : 'Support Team'
}

function mapLinkedPayment(order?: OrderRecord): SupportPaymentSnapshot | undefined {
  if (!order) {
    return undefined
  }

  return {
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
    paymentGateway: order.paymentSummary?.paymentGateway,
    paymentChannel: order.paymentSummary?.paymentChannel,
    reference: order.paymentSummary?.reference,
    checkoutSessionId: order.paymentSummary?.checkoutSessionId,
    paidAt: order.paymentSummary?.paidAt,
  }
}

function getDefaultCaseMessage(category: SupportCategory, order?: OrderRecord) {
  switch (category) {
    case 'refund_request':
      return order
        ? `Please help review the refund or payment follow-up for ${order.id}.`
        : 'Please help review my refund-related concern.'
    case 'payment_issue':
      return order
        ? `I need help checking the payment details for ${order.id}.`
        : 'I need help with a payment issue.'
    case 'order_help':
      return order
        ? `I need help with order ${order.id}.`
        : 'I need help with one of my orders.'
    default:
      return order
        ? `I need support for ${order.id}.`
        : 'I need help from the support team.'
  }
}

function getCasePriority(category: SupportCategory) {
  switch (category) {
    case 'refund_request':
    case 'payment_issue':
      return 'high' as const
    default:
      return 'normal' as const
  }
}

async function loadVisibleOrdersForActor(actor: StoreActor) {
  const snapshot = await loadStoreStateForActor(actor)
  const visibleState = await getVisibleStoreState(snapshot, actor, [])
  return visibleState.orders.filter((order) => order.source === 'ONLINE')
}

async function loadAccessibleOrder(actor: StoreActor, orderId: string) {
  const visibleOrders = await loadVisibleOrdersForActor(actor)
  return visibleOrders.find((order) => order.id === orderId)
}

async function loadProfilesByIds(profileIds: string[]) {
  const uniqueIds = [...new Set(profileIds.filter(Boolean))]
  if (uniqueIds.length === 0) {
    return new Map<string, ProfileRow>()
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role')
    .in('id', uniqueIds)

  if (error) {
    throw error
  }

  return new Map(((data ?? []) as ProfileRow[]).map((profile) => [profile.id, profile]))
}

async function loadPaymentRecordsByOrderIds(orderIds: string[]) {
  const uniqueOrderIds = [...new Set(orderIds.filter(Boolean))]
  if (uniqueOrderIds.length === 0) {
    return new Map<string, PaymentRecordRow>()
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('payment_records')
    .select('id, order_id, payment_gateway, payment_channel, reference, checkout_session_id, paid_at')
    .in('order_id', uniqueOrderIds)

  if (error) {
    throw error
  }

  return new Map(((data ?? []) as PaymentRecordRow[]).map((record) => [record.order_id, record]))
}

async function loadSupportMessagesByCaseIds(caseIds: string[]) {
  const uniqueCaseIds = [...new Set(caseIds.filter(Boolean))]
  if (uniqueCaseIds.length === 0) {
    return new Map<string, SupportMessageRow[]>()
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('support_messages')
    .select('id, case_id, author_type, author_id, message, metadata, created_at')
    .in('case_id', uniqueCaseIds)
    .order('created_at', { ascending: true })

  if (error) {
    throw error
  }

  const rows = (data ?? []) as SupportMessageRow[]
  const messagesByCaseId = new Map<string, SupportMessageRow[]>()

  rows.forEach((row) => {
    const bucket = messagesByCaseId.get(row.case_id) ?? []
    bucket.push(row)
    messagesByCaseId.set(row.case_id, bucket)
  })

  return messagesByCaseId
}

async function hydrateSupportCases(
  actor: StoreActor,
  rows: SupportCaseRow[],
  options: { includeMessages?: boolean } = {},
) {
  if (rows.length === 0) {
    return [] as SupportCase[]
  }

  const accessibleOrders = await loadVisibleOrdersForActor(actor)
  const orderById = new Map(accessibleOrders.map((order) => [order.id, order]))
  const paymentRecordsByOrderId = await loadPaymentRecordsByOrderIds(
    rows.map((row) => row.order_id ?? '').filter(Boolean),
  )
  const profilesById = await loadProfilesByIds(
    rows.flatMap((row) => [row.customer_id ?? '', row.assigned_to ?? '']),
  )
  const messagesByCaseId = options.includeMessages
    ? await loadSupportMessagesByCaseIds(rows.map((row) => row.id))
    : new Map<string, SupportMessageRow[]>()

  return rows.map((row) => {
    const linkedOrder = row.order_id ? orderById.get(row.order_id) : undefined
    const paymentRecord = row.order_id ? paymentRecordsByOrderId.get(row.order_id) : undefined
    const linkedPayment =
      linkedOrder || paymentRecord
        ? {
            paymentMethod: linkedOrder?.paymentMethod,
            paymentStatus: linkedOrder?.paymentStatus,
            paymentGateway: linkedOrder?.paymentSummary?.paymentGateway ?? paymentRecord?.payment_gateway ?? undefined,
            paymentChannel: linkedOrder?.paymentSummary?.paymentChannel ?? paymentRecord?.payment_channel ?? undefined,
            reference: row.payment_reference ?? linkedOrder?.paymentSummary?.reference ?? paymentRecord?.reference ?? undefined,
            checkoutSessionId:
              linkedOrder?.paymentSummary?.checkoutSessionId ?? paymentRecord?.checkout_session_id ?? undefined,
            paidAt: linkedOrder?.paymentSummary?.paidAt ?? paymentRecord?.paid_at ?? undefined,
          }
        : undefined

    const customerName = row.customer_id
      ? profilesById.get(row.customer_id)?.name ?? undefined
      : linkedOrder?.customerName
    const assignedToName = row.assigned_to ? profilesById.get(row.assigned_to)?.name ?? null : null
    const messages = (messagesByCaseId.get(row.id) ?? []).map<SupportMessage>((message) => ({
      id: message.id,
      caseId: message.case_id,
      authorType: message.author_type,
      authorId: message.author_id,
      authorName: getAuthorName(message.author_type, profilesById, message, customerName),
      message: message.message,
      metadata: message.metadata,
      createdAt: message.created_at,
    }))

    return {
      id: row.id,
      customerId: row.customer_id,
      customerEmail: row.customer_email,
      customerName,
      category: row.category,
      status: row.status,
      priority: row.priority,
      source: row.source,
      orderId: row.order_id,
      paymentRecordId: row.payment_record_id,
      paymentReference: row.payment_reference,
      latestSummary: row.latest_summary,
      assignedTo: row.assigned_to,
      assignedToName,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      linkedOrder,
      linkedPayment,
      messages: options.includeMessages ? messages : undefined,
    } satisfies SupportCase
  })
}

async function fetchSupportCaseRows(actor: StoreActor, filters: SupportCaseFilters = {}) {
  const supabase = createSupabaseAdminClient()
  let query = supabase
    .from('support_cases')
    .select(
      'id, customer_id, customer_email, category, status, priority, source, order_id, payment_record_id, payment_reference, latest_summary, assigned_to, created_at, updated_at',
    )
    .order('updated_at', { ascending: false })

  if (isCustomerActor(actor)) {
    query = query.eq('customer_id', actor.id)
  }

  if (filters.category) {
    query = query.eq('category', filters.category)
  }

  if (filters.status) {
    query = query.eq('status', filters.status)
  }

  if (typeof filters.limit === 'number') {
    query = query.limit(filters.limit)
  }

  const { data, error } = await query

  if (error) {
    throw error
  }

  return (data ?? []) as SupportCaseRow[]
}

async function getSupportCaseRowById(caseId: string) {
  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('support_cases')
    .select(
      'id, customer_id, customer_email, category, status, priority, source, order_id, payment_record_id, payment_reference, latest_summary, assigned_to, created_at, updated_at',
    )
    .eq('id', caseId)
    .maybeSingle()

  if (error) {
    throw error
  }

  return (data as SupportCaseRow | null) ?? null
}

async function assertCaseAccess(actor: StoreActor, caseId: string) {
  const row = await getSupportCaseRowById(caseId)

  if (!row) {
    throw new Error('Support case not found.')
  }

  if (isBackofficeActor(actor)) {
    return row
  }

  if (row.customer_id !== actor.id) {
    throw new Error('You do not have access to this support case.')
  }

  return row
}

async function refreshSupportCaseSummary(caseRow: SupportCaseRow, requestMessage: string, actor: StoreActor) {
  const linkedOrder = caseRow.order_id ? await loadAccessibleOrder(actor, caseRow.order_id) : undefined
  return buildCaseHandoffSummary({
    category: caseRow.category,
    order: linkedOrder,
    requestMessage,
    supportCase: {
      id: caseRow.id,
      status: caseRow.status,
      priority: caseRow.priority,
    },
  })
}

async function createSupportCaseRecord(actor: StoreActor, input: {
  category: SupportCategory
  order?: OrderRecord
  message?: string
}) {
  const supabase = createSupabaseAdminClient()
  const timestamp = new Date().toISOString()
  const supportCaseId = createSupportCaseId()
  const initialMessage = normalizeText(
    input.message && input.message.trim().length > 0
      ? input.message
      : getDefaultCaseMessage(input.category, input.order),
  )

  const paymentRecordId = input.order?.id ? `${input.order.id}::payment` : null
  const paymentReference = input.order?.paymentSummary?.reference ?? null
  const latestSummary = await buildCaseHandoffSummary({
    category: input.category,
    order: input.order,
    requestMessage: initialMessage,
    supportCase: {
      id: supportCaseId,
      status: 'open',
      priority: getCasePriority(input.category),
    },
  })

  const caseRow = {
    id: supportCaseId,
    customer_id: actor.id,
    customer_email: actor.email,
    category: input.category,
    status: 'open' as const,
    priority: getCasePriority(input.category),
    source: 'chatbot' as const,
    order_id: input.order?.id ?? null,
    payment_record_id: paymentRecordId,
    payment_reference: paymentReference,
    latest_summary: latestSummary,
    assigned_to: null,
    created_at: timestamp,
    updated_at: timestamp,
  }

  const { error: insertCaseError } = await supabase.from('support_cases').insert(caseRow)
  if (insertCaseError) {
    throw insertCaseError
  }

  const initialMessages = [
    {
      id: createSupportMessageId(),
      case_id: supportCaseId,
      author_type: 'bot' as const,
      author_id: null,
      message: input.order
        ? `Guided support captured ${input.order.id} and its payment context for the team.`
        : 'Guided support created this case from the customer chatbot.',
      metadata: input.order
        ? {
            orderId: input.order.id,
            orderStatus: input.order.status,
            paymentStatus: input.order.paymentStatus,
          }
        : { source: 'chatbot' },
      created_at: timestamp,
    },
    {
      id: createSupportMessageId(),
      case_id: supportCaseId,
      author_type: 'customer' as const,
      author_id: actor.id,
      message: initialMessage,
      metadata: input.order
        ? {
            orderId: input.order.id,
            paymentReference: input.order.paymentSummary?.reference ?? null,
          }
        : null,
      created_at: timestamp,
    },
  ]

  const { error: insertMessagesError } = await supabase.from('support_messages').insert(initialMessages)
  if (insertMessagesError) {
    throw insertMessagesError
  }

  const createdCase = await getSupportCaseDetail(actor, supportCaseId)
  if (!createdCase) {
    throw new Error('Support case created, but the detail could not be loaded.')
  }

  return createdCase
}

export async function getSupportBootstrapPayload(
  actor?: StoreActor | null,
): Promise<SupportBootstrapPayload> {
  const payload: SupportBootstrapPayload = {
    isAuthenticated: false,
    customer: null,
    welcomeMessage: '',
    quickActions: GUEST_QUICK_ACTIONS,
    faqs: DEFAULT_FAQS,
    recentOrders: [],
    recentCases: [],
  }

  if (!isCustomerActor(actor)) {
    payload.welcomeMessage = await buildSupportWelcomeMessage(payload)
    return payload
  }

  const [recentOrders, recentCases] = await Promise.all([
    loadVisibleOrdersForActor(actor),
    listSupportCases(actor, { limit: 5 }),
  ])

  const nextPayload: SupportBootstrapPayload = {
    isAuthenticated: true,
    customer: {
      id: actor.id,
      email: actor.email,
      name: actor.name,
      role: actor.role,
    },
    welcomeMessage: '',
    quickActions: CUSTOMER_QUICK_ACTIONS,
    faqs: DEFAULT_FAQS,
    recentOrders,
    recentCases,
  }

  nextPayload.welcomeMessage = await buildSupportWelcomeMessage(nextPayload)
  return nextPayload
}

export async function runSupportAction(
  actor: StoreActor | null,
  request: SupportActionRequest,
): Promise<SupportActionResult> {
  if (!isCustomerActor(actor)) {
    return {
      ok: false,
      message: 'Sign in with your customer account to use order-aware support.',
    }
  }

  switch (request.action) {
    case 'listOwnOrders': {
      const orders = await loadVisibleOrdersForActor(actor)
      return {
        ok: true,
        message: await buildOrdersOverviewMessage(orders),
        orders,
      }
    }

    case 'getOrderDetails': {
      const order = await loadAccessibleOrder(actor, request.orderId)
      if (!order || !orderBelongsToActor(order, actor)) {
        return {
          ok: false,
          message: 'I could not find that order on your account.',
        }
      }

      return {
        ok: true,
        message: await buildOrderDetailMessage(order),
        order,
      }
    }

    case 'getPaymentDetails': {
      const order = await loadAccessibleOrder(actor, request.orderId)
      if (!order || !orderBelongsToActor(order, actor)) {
        return {
          ok: false,
          message: 'I could not find payment details for that order.',
        }
      }

      return {
        ok: true,
        message: await buildPaymentDetailMessage(order, mapLinkedPayment(order)),
        order,
      }
    }

    case 'cancelOwnOrder':
    case 'confirmOwnDelivery': {
      const snapshot = await loadStoreStateForActor(actor)
      const storeAction =
        request.action === 'cancelOwnOrder'
          ? { type: 'cancelOwnOrder' as const, orderId: request.orderId }
          : { type: 'confirmOwnDelivery' as const, orderId: request.orderId }

      const { nextState, result } = performStoreAction(snapshot, storeAction, actor)
      if (!result.ok) {
        return {
          ok: false,
          message: result.message,
        }
      }

      const persistedState = await saveStoreSnapshot({
        ...nextState,
        cart: [],
      })
      const visibleState = await getVisibleStoreState(persistedState, actor, [])
      const updatedOrder = visibleState.orders.find((order) => order.id === request.orderId)

      return {
        ok: true,
        message: result.message,
        order: updatedOrder,
        orders: visibleState.orders.filter((order) => order.source === 'ONLINE'),
      }
    }

    case 'createRefundRequest': {
      const order = await loadAccessibleOrder(actor, request.orderId)
      if (!order || !orderBelongsToActor(order, actor)) {
        return {
          ok: false,
          message: 'I could not open a refund request for that order.',
        }
      }

      const supportCase = await createSupportCaseRecord(actor, {
        category: 'refund_request',
        order,
        message: request.message,
      })

      return {
        ok: true,
        message: await buildCaseSummaryMessage({
          category: 'refund_request',
          caseId: supportCase.id,
          order,
          requestMessage:
            request.message && request.message.trim().length > 0
              ? normalizeText(request.message)
              : getDefaultCaseMessage('refund_request', order),
        }),
        case: supportCase,
      }
    }

    case 'createSupportCase': {
      const order = request.orderId ? await loadAccessibleOrder(actor, request.orderId) : undefined
      if (request.orderId && !order) {
        return {
          ok: false,
          message: 'I could not link that order to a new support request.',
        }
      }

      const category =
        request.category ??
        (order ? 'order_help' : 'general')
      const supportCase = await createSupportCaseRecord(actor, {
        category,
        order,
        message: request.message,
      })

      return {
        ok: true,
        message: await buildCaseSummaryMessage({
          category,
          caseId: supportCase.id,
          order,
          requestMessage:
            request.message && request.message.trim().length > 0
              ? normalizeText(request.message)
              : getDefaultCaseMessage(category, order),
        }),
        case: supportCase,
      }
    }
  }
}

export async function listSupportCases(actor: StoreActor, filters: SupportCaseFilters = {}) {
  const rows = await fetchSupportCaseRows(actor, filters)
  return hydrateSupportCases(actor, rows)
}

export async function getSupportCaseDetail(actor: StoreActor, caseId: string) {
  const row = await assertCaseAccess(actor, caseId)
  const hydratedCases = await hydrateSupportCases(actor, [row], { includeMessages: true })
  return hydratedCases[0] ?? null
}

export async function addSupportCaseMessage(
  actor: StoreActor,
  caseId: string,
  message: string,
) {
  const trimmedMessage = normalizeText(message)
  if (!trimmedMessage) {
    throw new Error('Enter a message before sending it.')
  }

  const caseRow = await assertCaseAccess(actor, caseId)
  const supabase = createSupabaseAdminClient()
  const timestamp = new Date().toISOString()
  const authorType: SupportAuthorType = actor.role === 'USER' ? 'customer' : 'staff'
  const nextStatus: SupportStatus =
    actor.role === 'USER'
      ? 'waiting_on_staff'
      : caseRow.status === 'resolved' || caseRow.status === 'closed'
        ? caseRow.status
        : 'waiting_on_customer'

  const { error: messageError } = await supabase.from('support_messages').insert({
    id: createSupportMessageId(),
    case_id: caseId,
    author_type: authorType,
    author_id: actor.id,
    message: trimmedMessage,
    metadata: null,
    created_at: timestamp,
  })

  if (messageError) {
    throw messageError
  }

  const nextSummary = await refreshSupportCaseSummary(
    {
      ...caseRow,
      status: nextStatus,
      updated_at: timestamp,
    },
    trimmedMessage,
    actor,
  )

  const { error: updateError } = await supabase
    .from('support_cases')
    .update({
      status: nextStatus,
      latest_summary: nextSummary,
      updated_at: timestamp,
    })
    .eq('id', caseId)

  if (updateError) {
    throw updateError
  }

  return getSupportCaseDetail(actor, caseId)
}

export async function updateSupportCase(
  actor: StoreActor,
  caseId: string,
  updates: {
    status?: SupportStatus
    assignedTo?: string | null
  },
) {
  if (!isBackofficeActor(actor)) {
    throw new Error('Only support staff can update support cases.')
  }

  const caseRow = await assertCaseAccess(actor, caseId)
  const supabase = createSupabaseAdminClient()
  const timestamp = new Date().toISOString()
  const nextUpdate: Record<string, unknown> = {
    updated_at: timestamp,
  }
  const systemMessages: Array<Record<string, unknown>> = []

  if (typeof updates.status === 'string' && updates.status !== caseRow.status) {
    nextUpdate.status = updates.status
    systemMessages.push({
      id: createSupportMessageId(),
      case_id: caseId,
      author_type: 'system',
      author_id: actor.id,
      message: `${actor.name} changed the case status to ${updates.status.replace(/_/g, ' ')}.`,
      metadata: {
        previousStatus: caseRow.status,
        nextStatus: updates.status,
      },
      created_at: timestamp,
    })
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'assignedTo') && updates.assignedTo !== caseRow.assigned_to) {
    if (updates.assignedTo) {
      const profileMap = await loadProfilesByIds([updates.assignedTo])
      const assignee = profileMap.get(updates.assignedTo)

      if (!assignee || (assignee.role !== 'ADMIN' && assignee.role !== 'STAFF')) {
        throw new Error('Choose a valid staff or admin assignee.')
      }
    }

    nextUpdate.assigned_to = updates.assignedTo ?? null
    systemMessages.push({
      id: createSupportMessageId(),
      case_id: caseId,
      author_type: 'system',
      author_id: actor.id,
      message: updates.assignedTo
        ? `${actor.name} assigned this case to the support team.`
        : `${actor.name} cleared the current assignee.`,
      metadata: {
        previousAssignedTo: caseRow.assigned_to,
        nextAssignedTo: updates.assignedTo ?? null,
      },
      created_at: timestamp,
    })
  }

  if (Object.keys(nextUpdate).length === 1) {
    return getSupportCaseDetail(actor, caseId)
  }

  const { error: updateError } = await supabase
    .from('support_cases')
    .update(nextUpdate)
    .eq('id', caseId)

  if (updateError) {
    throw updateError
  }

  if (systemMessages.length > 0) {
    const { error: messageError } = await supabase.from('support_messages').insert(systemMessages)
    if (messageError) {
      throw messageError
    }
  }

  return getSupportCaseDetail(actor, caseId)
}

export async function listAssignableSupportStaff(actor: StoreActor) {
  if (!isBackofficeActor(actor)) {
    return []
  }

  const supabase = createSupabaseAdminClient()
  const { data, error } = await supabase
    .from('profiles')
    .select('id, email, name, role')
    .in('role', ['ADMIN', 'STAFF'])
    .order('role', { ascending: true })
    .order('name', { ascending: true })

  if (error) {
    throw error
  }

  return (data ?? []) as ProfileRow[]
}
