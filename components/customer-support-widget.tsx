'use client'

import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import {
  Bot,
  ChevronRight,
  CircleHelp,
  CreditCard,
  LifeBuoy,
  LoaderCircle,
  LogIn,
  MessageCircle,
  Package,
  Paperclip,
  SendHorizonal,
  ShieldCheck,
  Sparkles,
  Truck,
  UserRound,
  X,
  RefreshCw,
} from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/lib/auth-context'
import { getBrowserAuthHeaders } from '@/lib/client-auth-headers'
import { formatPHP } from '@/lib/currency'
import { useStore } from '@/lib/store-context'
import type { OrderRecord } from '@/lib/store-context'
import type {
  SupportBootstrapPayload,
  SupportCase,
  SupportFaq,
  SupportQuickAction,
} from '@/lib/support-types'
import { cn } from '@/lib/utils'
import { toast } from '@/hooks/use-toast'

type OrderSelectionMode = 'details' | 'payment' | 'cancel' | 'confirm' | 'refund'

type BaseChatMessage = {
  id: string
  role: 'bot' | 'customer' | 'staff' | 'system'
  text: string
  createdAt: string
  authorName?: string | null
}

type ChatMessage =
  | (BaseChatMessage & {
      kind: 'text'
    })
  | (BaseChatMessage & {
      kind: 'orders'
      orders: OrderRecord[]
      selectionMode: OrderSelectionMode
    })
  | (BaseChatMessage & {
      kind: 'order-detail'
      order: OrderRecord
    })
  | (BaseChatMessage & {
      kind: 'cases'
      cases: SupportCase[]
    })
  | (BaseChatMessage & {
      kind: 'case-detail'
      supportCase: SupportCase
    })
  | (BaseChatMessage & {
      kind: 'faqs'
      faqs: SupportFaq[]
    })

type PromptChip = {
  id: string
  label: string
  text?: string
  actionId?: SupportQuickAction['id']
}

function createMessageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

function isSupportBootstrapPayload(payload: unknown): payload is SupportBootstrapPayload {
  if (!payload || typeof payload !== 'object') {
    return false
  }

  return (
    'isAuthenticated' in payload &&
    'quickActions' in payload &&
    'faqs' in payload &&
    'recentOrders' in payload &&
    'recentCases' in payload &&
    'welcomeMessage' in payload
  )
}

function formatBubbleTime(value: string) {
  return new Date(value).toLocaleTimeString('en-PH', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function getCustomerInitial(name?: string | null) {
  return name?.trim().charAt(0).toUpperCase() || 'Y'
}

function getStatusTone(status: string) {
  switch (status) {
    case 'Pending':
      return 'border-[#f1c8b6] bg-[#fff2ec] text-[#a65a44]'
    case 'Processing':
      return 'border-[#e9d08f] bg-[#fff7db] text-[#86631e]'
    case 'Shipped':
      return 'border-[#eacdb7] bg-[#fff2e8] text-[#8f5f4b]'
    case 'Out for Delivery':
      return 'border-[#e9c18a] bg-[#fff0db] text-[#7b5920]'
    case 'Delivered':
      return 'border-[#bfd9c4] bg-[#eef8f0] text-[#2e744a]'
    case 'Cancelled':
      return 'border-slate-300 bg-slate-100 text-slate-700'
    default:
      return 'border-border bg-white text-foreground'
  }
}

function getCaseTone(status: SupportCase['status']) {
  switch (status) {
    case 'resolved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-800'
    case 'closed':
      return 'border-slate-300 bg-slate-100 text-slate-700'
    case 'waiting_on_customer':
      return 'border-sky-200 bg-sky-50 text-sky-800'
    case 'waiting_on_staff':
      return 'border-amber-200 bg-amber-50 text-amber-800'
    default:
      return 'border-rose-200 bg-rose-50 text-rose-800'
  }
}

function getActionLabel(mode: OrderSelectionMode) {
  switch (mode) {
    case 'details':
      return 'View tracking'
    case 'payment':
      return 'Check payment'
    case 'cancel':
      return 'Cancel order'
    case 'confirm':
      return 'Confirm received'
    case 'refund':
      return 'Request help'
  }
}

function getQuickActionIcon(actionId: SupportQuickAction['id']) {
  switch (actionId) {
    case 'track_order':
      return <Truck className="h-3.5 w-3.5" />
    case 'check_payment':
      return <CreditCard className="h-3.5 w-3.5" />
    case 'cancel_order':
      return <Package className="h-3.5 w-3.5" />
    case 'confirm_received':
      return <Truck className="h-3.5 w-3.5" />
    case 'request_refund':
    case 'view_cases':
      return <LifeBuoy className="h-3.5 w-3.5" />
    case 'talk_to_support':
      return <MessageCircle className="h-3.5 w-3.5" />
    case 'browse_faqs':
      return <CircleHelp className="h-3.5 w-3.5" />
    case 'sign_in':
      return <LogIn className="h-3.5 w-3.5" />
  }
}

function MessageAvatar({
  role,
  customerName,
  authorName,
}: {
  role: 'bot' | 'customer' | 'staff' | 'system'
  customerName?: string | null
  authorName?: string | null
}) {
  if (role === 'system') return null

  if (role === 'staff') {
    return (
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-100 overflow-hidden shadow-sm">
        <img 
          src="https://images.unsplash.com/photo-1560250097-0b93528c311a?w=100&h=100&fit=crop" 
          alt={authorName || 'Admin'} 
          className="h-full w-full object-cover"
        />
      </span>
    )
  }

  if (role === 'bot') {
    return (
      <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF758C] to-[#FF7EB3] text-white shadow-[0_4px_10px_rgba(255,117,140,0.3)]">
        <Bot className="h-4 w-4" />
      </span>
    )
  }

  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#f4f4f5] to-[#e4e4e7] text-[11px] font-semibold text-[#3f3f46] shadow-sm">
      {getCustomerInitial(customerName)}
    </span>
  )
}

export function CustomerSupportWidget() {
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading } = useAuth()
  const { cancelOwnOrder, confirmOwnDelivery } = useStore()
  const [open, setOpen] = useState(false)
  const [bootstrap, setBootstrap] = useState<SupportBootstrapPayload | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [loadingBootstrap, setLoadingBootstrap] = useState(false)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [composerMode, setComposerMode] = useState<'case' | 'reply' | null>(null)
  const [composerOrderId, setComposerOrderId] = useState<string | null>(null)
  const [activeCaseId, setActiveCaseId] = useState<string | null>(null)
  const [draftMessage, setDraftMessage] = useState('')
  const [showPrompts, setShowPrompts] = useState(false)

  const hidden = pathname.startsWith('/admin')
  const recentOrders = bootstrap?.recentOrders ?? []
  const recentCases = bootstrap?.recentCases ?? []
  const canShowWidget = !hidden && !isLoading && isAuthenticated
  const quickActionButtons = useMemo(() => bootstrap?.quickActions ?? [], [bootstrap])

  const promptChips = useMemo<PromptChip[]>(() => {
    if (!bootstrap?.isAuthenticated) {
      return [
        { id: 'guest-sign-in', label: 'Sign in', actionId: 'sign_in' },
        { id: 'guest-faqs', label: 'Refund FAQ', actionId: 'browse_faqs' },
      ]
    }

    if (activeCaseId) {
      return [
        { id: 'reply-update', label: 'Add update', text: 'I have an update for this support case.' },
        { id: 'reply-follow', label: 'Follow up', text: 'Can you please follow up on this request?' },
        { id: 'reply-payment', label: 'Payment check', text: 'Please review the payment details attached to this case.' },
      ]
    }

    return [
      { id: 'prompt-track', label: 'Track order', actionId: 'track_order' },
      { id: 'prompt-payment', label: 'Check payment', actionId: 'check_payment' },
      { id: 'prompt-refund', label: 'Request refund', actionId: 'request_refund' },
      { id: 'prompt-support', label: 'Talk to support', actionId: 'talk_to_support' },
    ]
  }, [activeCaseId, bootstrap?.isAuthenticated])

  const composerLocked = !bootstrap?.isAuthenticated
  const composerPlaceholder = composerLocked
    ? 'Sign in to ask about your order...'
    : activeCaseId
      ? 'Reply to this support case...'
      : 'Ask anything about your order...'
  const composerCaption = composerLocked
    ? 'Guest preview mode'
    : activeCaseId
      ? `Replying to ${activeCaseId}`
      : composerOrderId
        ? `Linking ${composerOrderId}`
        : 'New guided support request'

  const appendMessage = (message: ChatMessage) => {
    setMessages((currentMessages) => [...currentMessages, message])
  }

  const appendTextMessage = (role: 'bot' | 'customer' | 'staff' | 'system', text: string, authorName?: string | null) => {
    appendMessage({
      id: createMessageId(),
      role,
      text,
      kind: 'text',
      createdAt: new Date().toISOString(),
      authorName,
    })
  }

  const appendFaqMessage = (text: string, faqs: SupportFaq[]) => {
    appendMessage({
      id: createMessageId(),
      role: 'bot',
      text,
      kind: 'faqs',
      faqs,
      createdAt: new Date().toISOString(),
    })
  }

  const appendOrdersMessage = (
    text: string,
    orders: OrderRecord[],
    selectionMode: OrderSelectionMode,
  ) => {
    appendMessage({
      id: createMessageId(),
      role: 'bot',
      text,
      kind: 'orders',
      orders,
      selectionMode,
      createdAt: new Date().toISOString(),
    })
  }

  const appendOrderDetailMessage = (text: string, order: OrderRecord) => {
    appendMessage({
      id: createMessageId(),
      role: 'bot',
      text,
      kind: 'order-detail',
      order,
      createdAt: new Date().toISOString(),
    })
  }

  const appendCasesMessage = (text: string, cases: SupportCase[]) => {
    appendMessage({
      id: createMessageId(),
      role: 'bot',
      text,
      kind: 'cases',
      cases,
      createdAt: new Date().toISOString(),
    })
  }

  const appendCaseDetailMessage = (text: string, supportCase: SupportCase) => {
    appendMessage({
      id: createMessageId(),
      role: 'bot',
      text,
      kind: 'case-detail',
      supportCase,
      createdAt: new Date().toISOString(),
    })
  }

  const resetConversation = (payload: SupportBootstrapPayload) => {
    const nextMessages: ChatMessage[] = [
      {
        id: createMessageId(),
        role: 'bot',
        text: payload.welcomeMessage,
        kind: 'text',
        createdAt: new Date().toISOString(),
      },
    ]

    if (payload.isAuthenticated && payload.recentCases.length > 0) {
      nextMessages.push({
        id: createMessageId(),
        role: 'bot',
        text: 'I also found recent support cases if you want to continue one of them.',
        kind: 'cases',
        cases: payload.recentCases,
        createdAt: new Date().toISOString(),
      })
    }

    setMessages(nextMessages)
  }

  const loadBootstrap = async (
    options: {
      reset?: boolean
    } = {},
  ): Promise<SupportBootstrapPayload | null> => {
    setLoadingBootstrap(true)

    try {
      const response = await fetch('/api/support/bootstrap', {
        method: 'GET',
        headers: await getBrowserAuthHeaders(),
        cache: 'no-store',
      })
      const payload = await response.json().catch(() => null)

      if (!response.ok || !isSupportBootstrapPayload(payload)) {
        throw new Error(
          payload && typeof payload === 'object' && 'error' in payload
            ? String(payload.error)
            : 'Unable to load support.',
        )
      }

      setBootstrap(payload)

      if (options.reset || messages.length === 0) {
        resetConversation(payload)
      }

      return payload
    } catch (error) {
      toast({
        title: 'Support unavailable',
        description: error instanceof Error ? error.message : 'Unable to load support right now.',
        variant: 'destructive',
      })
      return null
    } finally {
      setLoadingBootstrap(false)
    }
  }

  useEffect(() => {
    if (!open || hidden || isLoading) {
      return
    }

    const needsRefresh =
      !bootstrap ||
      bootstrap.isAuthenticated !== isAuthenticated ||
      bootstrap.customer?.id !== user?.id

    if (needsRefresh) {
      void loadBootstrap({ reset: true })
    }
  }, [bootstrap, hidden, isAuthenticated, isLoading, open, user?.id])

  const callSupportAction = async (action: Record<string, unknown>) => {
    const response = await fetch('/api/support/action', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(await getBrowserAuthHeaders()),
      },
      body: JSON.stringify({ action }),
    })

    const payload = await response.json().catch(() => null)

    if (!response.ok || !payload) {
      throw new Error(
        payload && typeof payload === 'object' && 'message' in payload
          ? String(payload.message)
          : payload && typeof payload === 'object' && 'error' in payload
            ? String(payload.error)
            : 'Unable to complete that support action.',
      )
    }

    return payload as {
      ok: boolean
      message: string
      orders?: OrderRecord[]
      order?: OrderRecord
      case?: SupportCase
    }
  }

  const loadCaseDetail = async (caseId: string) => {
    setPendingAction(caseId)

    try {
      const response = await fetch(`/api/support/cases?id=${encodeURIComponent(caseId)}`, {
        method: 'GET',
        headers: await getBrowserAuthHeaders(),
        cache: 'no-store',
      })
      const payload = (await response.json().catch(() => null)) as
        | {
            case?: SupportCase
            error?: string
          }
        | null

      if (!response.ok || !payload?.case) {
        throw new Error(payload?.error ?? 'Unable to load that support case.')
      }

      setActiveCaseId(payload.case.id)
      setComposerMode('reply')
      
      if (activeCaseId !== payload.case.id) {
        appendTextMessage(
          'system',
          `Opened case ${payload.case.id}. You can review the thread below and reply when you're ready.`
        )
      }

      const caseMessages = payload.case.messages
      if (caseMessages && caseMessages.length > 0) {
        setMessages((currentMessages) => {
          const newMessages = [...currentMessages]
          const existingIds = new Set(newMessages.map(m => m.id))
          
          caseMessages.forEach(msg => {
            if (!existingIds.has(msg.id)) {
              newMessages.push({
                id: msg.id,
                role: msg.authorType === 'bot' ? 'bot' : msg.authorType === 'staff' ? 'staff' : 'customer',
                text: msg.message,
                kind: 'text',
                createdAt: msg.createdAt,
                authorName: msg.authorName
              })
            }
          })
          return newMessages
        })
      }
    } catch (error) {
      toast({
        title: 'Unable to open case',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setPendingAction(null)
    }
  }

  const handleQuickAction = async (actionId: SupportQuickAction['id']) => {
    if (!bootstrap) {
      return
    }

    const actionLabel =
      bootstrap.quickActions.find((quickAction) => quickAction.id === actionId)?.label ?? 'Support'
    appendTextMessage('customer', actionLabel)
    setShowPrompts(false)

    if (actionId === 'browse_faqs') {
      appendFaqMessage('Here are the most common support topics.', bootstrap.faqs)
      return
    }

    if (actionId === 'sign_in') {
      appendTextMessage(
        'bot',
        'Sign in to unlock order-aware support, payment lookups, and guided self-service actions.',
      )
      setOpen(false)
      window.location.href = '/auth/signin'
      return
    }

    if (!bootstrap.isAuthenticated) {
      appendTextMessage(
        'bot',
        'Please sign in first so I can securely read your orders and payment records.',
      )
      return
    }

    if (actionId === 'track_order') {
      setPendingAction(actionId)
      try {
        const result = await callSupportAction({ action: 'listOwnOrders' })
        appendOrdersMessage(result.message, result.orders ?? [], 'details')
      } catch (error) {
        appendTextMessage(
          'bot',
          error instanceof Error ? error.message : 'Unable to load your orders.',
        )
      } finally {
        setPendingAction(null)
      }
      return
    }

    if (actionId === 'check_payment') {
      if (recentOrders.length === 0) {
        appendTextMessage('bot', "I couldn't find any online orders on this account yet.")
      } else {
        appendOrdersMessage(
          "Choose an order and I'll show the payment method, status, references, and PayMongo details.",
          recentOrders,
          'payment',
        )
      }
      return
    }

    if (actionId === 'cancel_order') {
      const cancellableOrders = recentOrders.filter((order) => order.actionAvailability?.canCancel)
      if (cancellableOrders.length === 0) {
        appendTextMessage(
          'bot',
          'There are no customer-cancellable orders right now. Only Pending or Processing online orders can be cancelled here.',
        )
      } else {
        appendOrdersMessage(
          'These orders are still eligible for self-service cancellation. Pick one to cancel it safely.',
          cancellableOrders,
          'cancel',
        )
      }
      return
    }

    if (actionId === 'confirm_received') {
      const confirmableOrders = recentOrders.filter(
        (order) => order.actionAvailability?.canConfirmReceived,
      )
      if (confirmableOrders.length === 0) {
        appendTextMessage('bot', 'There are no deliveries waiting for customer confirmation right now.')
      } else {
        appendOrdersMessage(
          "Pick the parcel you already received and I'll mark it as delivered for your account.",
          confirmableOrders,
          'confirm',
        )
      }
      return
    }

    if (actionId === 'request_refund') {
      // Always show refund policy first so customers know what to expect
      appendTextMessage(
        'bot',
        '📋 Before we proceed, here is our Refund Policy:\n\n' +
        '• If you paid via QR Ph (QR code / InstaPay), refunds are processed manually by our team within 3–5 business days. We will send the amount back to your bank or e-wallet and notify you by email.\n\n' +
        '• If you paid via card, GrabPay, or Maya, refunds are processed automatically and usually reflect within 3–7 banking days.\n\n' +
        'Please select the order you would like to request a refund for:',
      )

      if (recentOrders.length === 0) {
        appendTextMessage(
          'bot',
          'I could not find any online orders on your account. You can still open a general support case — tap "Talk to support" to get started.',
        )
      } else {
        appendOrdersMessage(
          'Choose the order you want to attach to your refund request:',
          recentOrders,
          'refund',
        )
      }
      return
    }

    if (actionId === 'view_cases') {
      if (recentCases.length === 0) {
        appendTextMessage('bot', 'You do not have any support cases yet.')
      } else {
        appendCasesMessage(
          'Here are your recent support requests. Open one to view the full thread.',
          recentCases,
        )
      }
      return
    }

    if (actionId === 'talk_to_support') {
      setComposerMode('case')
      setActiveCaseId(null)
      appendTextMessage(
        'bot',
        composerOrderId
          ? `Tell me what you need help with and I'll attach ${composerOrderId} to the support request.`
          : "Tell me what you need help with and I'll open a new support case for the team.",
      )
    }
  }

  const handleOrderSelection = async (mode: OrderSelectionMode, order: OrderRecord) => {
    setComposerOrderId(order.id)
    setPendingAction(`${mode}:${order.id}`)

    try {
      if (mode === 'details') {
        const result = await callSupportAction({ action: 'getOrderDetails', orderId: order.id })
        if (result.order) {
          appendOrderDetailMessage(result.message, result.order)
        }
        return
      }

      if (mode === 'payment') {
        const result = await callSupportAction({ action: 'getPaymentDetails', orderId: order.id })
        if (result.order) {
          appendOrderDetailMessage(result.message, result.order)
        }
        return
      }

      if (mode === 'cancel') {
        const result = await cancelOwnOrder(order.id)
        if (!result.ok) {
          throw new Error(result.message)
        }

        const refreshed = await loadBootstrap()
        const refreshedOrder = refreshed?.recentOrders.find((currentOrder) => currentOrder.id === order.id)
        if (refreshedOrder) {
          appendOrderDetailMessage(result.message, refreshedOrder)
        } else {
          appendTextMessage('bot', result.message)
        }
        return
      }

      if (mode === 'confirm') {
        const result = await confirmOwnDelivery(order.id)
        if (!result.ok) {
          throw new Error(result.message)
        }

        const refreshed = await loadBootstrap()
        const refreshedOrder = refreshed?.recentOrders.find((currentOrder) => currentOrder.id === order.id)
        if (refreshedOrder) {
          appendOrderDetailMessage(result.message, refreshedOrder)
        } else {
          appendTextMessage('bot', result.message)
        }
        return
      }

      const result = await callSupportAction({ action: 'createRefundRequest', orderId: order.id })
      if (result.case) {
        setActiveCaseId(result.case.id)
        setComposerMode('reply')
        await loadBootstrap()
        appendTextMessage('bot', result.message)

        // Show refund timeline reminder after case is created
        const isQrPh =
          order.paymentMethod === 'PayMongo' &&
          (order.paymentSummary?.paymentChannel === 'qrph' ||
            order.paymentSummary?.paymentGateway === 'qrph')

        appendTextMessage(
          'bot',
          isQrPh
            ? '⏱️ Since you paid via QR Ph (QR code), your refund will be processed manually by our team within 3–5 business days. You will receive an email notification once the money has been sent back to your bank or e-wallet. If you have any updates to share, you can reply to this support case.'
            : '✅ Your refund request has been submitted. Our team will review it within 1–2 business days and update you via email. You can reply to this case anytime to add more details.',
        )
      }
    } catch (error) {
      appendTextMessage(
        'bot',
        error instanceof Error ? error.message : 'Unable to complete that request.',
      )
    } finally {
      setPendingAction(null)
    }
  }

  const handlePromptChip = async (chip: PromptChip) => {
    if (chip.actionId) {
      await handleQuickAction(chip.actionId)
      return
    }

    if (chip.text) {
      if (composerMode !== 'reply') {
        setComposerMode('case')
      }
      setDraftMessage(chip.text)
    }
  }

  const handleComposerSubmit = async () => {
    const trimmedMessage = draftMessage.trim()
    if (!trimmedMessage) {
      return
    }

    if (composerLocked) {
      appendTextMessage(
        'bot',
        'Sign in first so I can securely create a case and attach the right order details.',
      )
      return
    }

    appendTextMessage('customer', trimmedMessage)
    setDraftMessage('')
    setPendingAction('composer')

    try {
      if (composerMode === 'reply' && activeCaseId) {
        const response = await fetch(
          `/api/support/cases/${encodeURIComponent(activeCaseId)}/messages`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(await getBrowserAuthHeaders()),
            },
            body: JSON.stringify({ message: trimmedMessage }),
          },
        )
        const payload = (await response.json().catch(() => null)) as
          | {
              case?: SupportCase
              error?: string
            }
          | null

        if (!response.ok || !payload?.case) {
          throw new Error(payload?.error ?? 'Unable to send your reply.')
        }

        setActiveCaseId(payload.case.id)
        appendTextMessage('system', 'Your reply has been added to the support thread.')
      } else {
        const result = await callSupportAction({
          action: 'createSupportCase',
          category: composerOrderId ? 'order_help' : 'general',
          orderId: composerOrderId ?? undefined,
          message: trimmedMessage,
        })

        if (!result.case) {
          throw new Error(result.message)
        }

        setActiveCaseId(result.case.id)
        setComposerMode('reply')
        await loadBootstrap()
        appendTextMessage('bot', result.message)
      }
    } catch (error) {
      appendTextMessage(
        'bot',
        error instanceof Error ? error.message : 'Unable to send that support request.',
      )
    } finally {
      setPendingAction(null)
    }
  }

  if (!canShowWidget) {
    return null
  }

  return (
    <>
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 flex items-center justify-center h-14 w-14 rounded-full bg-gradient-to-br from-[#FF758C] to-[#FF7EB3] text-white shadow-xl transition hover:-translate-y-1 hover:shadow-2xl"
        >
          <MessageCircle className="h-6 w-6" />
        </button>
      ) : null}

      {open ? (
        <div className="fixed inset-0 z-50">
          <button
            type="button"
            aria-label="Close support chat backdrop"
            className="absolute inset-0 bg-black/10 backdrop-blur-[1px] md:bg-transparent"
            onClick={() => setOpen(false)}
          />

          <div className="absolute bottom-3 left-3 right-3 top-20 overflow-hidden rounded-[1.5rem] bg-[#fafafa] shadow-[0_10px_40px_rgba(0,0,0,0.15)] md:bottom-5 md:left-auto md:right-5 md:top-auto md:h-[42rem] md:w-[24rem] flex flex-col border border-slate-200">
            <div className="bg-gradient-to-r from-[#FF758C] to-[#FF7EB3] px-5 py-4 text-white shrink-0 relative">
              <div className="absolute inset-0 bg-white/10 opacity-50 bg-[radial-gradient(circle_at_top_right,rgba(255,255,255,0.4),transparent)]" />
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white text-[#FF758C] shadow-sm overflow-hidden p-1.5">
                    <Bot className="h-full w-full" />
                  </span>
                  <div>
                    <h2 className="text-[16px] font-bold tracking-tight text-white">Spray & Sniff</h2>
                    <p className="text-[12px] text-white/90 font-medium mt-0.5">You can ask me anything</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={async () => {
                      if (activeCaseId) {
                        await loadCaseDetail(activeCaseId)
                      } else {
                        await loadBootstrap()
                      }
                    }}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
                    aria-label="Refresh chat"
                  >
                    <RefreshCw className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-white transition hover:bg-white/30"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>

              <div className="relative mt-3 flex items-center gap-2 text-[11px] text-white/80 font-medium">
                <ShieldCheck className="h-3.5 w-3.5" />
                <span>
                  {bootstrap?.isAuthenticated
                    ? `Secure mode / ${recentOrders.length} online order${recentOrders.length === 1 ? '' : 's'}`
                    : 'Guest mode'}
                </span>
              </div>
            </div>

              <ScrollArea className="min-h-0 flex-1 px-3 py-4">
                <div className="space-y-4 pb-2">
                  {loadingBootstrap && messages.length === 0 ? (
                    <div className="flex items-end gap-2">
                      <MessageAvatar role="bot" customerName={user?.name} />
                      <div className="rounded-[1.15rem] rounded-bl-sm bg-white px-3 py-2.5 text-sm text-[#2e2a28] shadow-[0_10px_22px_rgba(63,52,49,0.12)]">
                        <div className="flex items-center gap-2">
                          <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                          <span>Loading support...</span>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {messages.map((message) => {
                    const isBotOrStaff = message.role === 'bot' || message.role === 'staff'
                    const isSystem = message.role === 'system'

                    if (isSystem) {
                      return (
                        <div key={message.id} className="flex justify-center my-4">
                          <span className="text-[11px] font-medium text-slate-400 bg-slate-100/60 px-4 py-1.5 rounded-full shadow-sm">
                            {message.text}
                          </span>
                        </div>
                      )
                    }

                    return (
                      <div
                        key={message.id}
                        className={cn('flex items-end gap-2.5 mb-2', isBotOrStaff ? 'justify-start pr-8' : 'justify-end pl-8')}
                      >
                        {isBotOrStaff ? <MessageAvatar role={message.role} customerName={user?.name} authorName={message.authorName} /> : null}

                        <div className={cn('min-w-0 max-w-[85%]', !isBotOrStaff && 'items-end flex flex-col')}>
                          {isBotOrStaff && message.authorName && message.role === 'staff' ? (
                             <p className="text-[10px] font-medium text-slate-500 mb-1 ml-1">{message.authorName}</p>
                          ) : null}
                          <div
                            className={cn(
                              'px-4 py-3 text-[14px] leading-relaxed shadow-sm',
                              isBotOrStaff 
                                ? 'rounded-[1.25rem] rounded-bl-[0.25rem] bg-white text-slate-800 border border-slate-100' 
                                : 'rounded-[1.25rem] rounded-br-[0.25rem] bg-[#FF758C] text-white'
                            )}
                          >
                            <p className="whitespace-pre-line">{message.text}</p>

                            {message.kind === 'faqs' ? (
                              <div className="mt-3 space-y-2.5">
                                {message.faqs.map((faq) => (
                                  <article key={faq.id} className="rounded-[0.95rem] bg-[#f8f4f0] px-3 py-3">
                                    <p className="text-sm font-semibold text-[#2d2a27]">{faq.question}</p>
                                    <p className="mt-1.5 text-[12px] leading-5 text-[#6d615e]">{faq.answer}</p>
                                  </article>
                                ))}
                              </div>
                            ) : null}

                            {message.kind === 'orders' ? (
                              <div className="mt-3 space-y-2.5">
                                {message.orders.map((order) => (
                                  <article key={order.id} className="rounded-[1rem] bg-[#f8f4f0] px-3 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7b75]">
                                          {order.id}
                                        </p>
                                        <p className="mt-1.5 text-sm font-semibold text-[#2d2a27]">{order.status}</p>
                                        <p className="mt-1 text-[12px] text-[#736764]">
                                          {formatPHP(order.total)} / {order.paymentStatus}
                                        </p>
                                      </div>
                                      <span
                                        className={cn(
                                          'rounded-full border px-2.5 py-1 text-[10px] font-semibold',
                                          getStatusTone(order.status),
                                        )}
                                      >
                                        {order.status}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => void handleOrderSelection(message.selectionMode, order)}
                                      disabled={pendingAction === `${message.selectionMode}:${order.id}`}
                                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#263845] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#304755] disabled:opacity-60"
                                    >
                                      {pendingAction === `${message.selectionMode}:${order.id}` ? (
                                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      )}
                                      {getActionLabel(message.selectionMode)}
                                    </button>
                                  </article>
                                ))}
                              </div>
                            ) : null}

                            {message.kind === 'order-detail' ? (
                              <div className="mt-3 rounded-[1rem] bg-[#f8f4f0] px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7b75]">
                                      {message.order.id}
                                    </p>
                                    <p className="mt-1.5 text-sm font-semibold text-[#2d2a27]">{message.order.status}</p>
                                    <p className="mt-1 text-[12px] text-[#736764]">
                                      {message.order.paymentMethod} / {message.order.paymentStatus}
                                    </p>
                                  </div>
                                  <span
                                    className={cn(
                                      'rounded-full border px-2.5 py-1 text-[10px] font-semibold',
                                      getStatusTone(message.order.status),
                                    )}
                                  >
                                    {message.order.status}
                                  </span>
                                </div>

                                {message.order.paymentSummary?.reference ? (
                                  <div className="mt-3 rounded-[0.9rem] bg-white px-3 py-2 text-[12px] text-[#655b57]">
                                    Ref: <span className="font-semibold text-[#2d2a27]">{message.order.paymentSummary.reference}</span>
                                  </div>
                                ) : null}

                                <div className="mt-3 space-y-2">
                                  {message.order.timeline.slice(-2).map((entry) => (
                                    <div key={`${entry.status}-${entry.createdAt}`} className="rounded-[0.9rem] bg-white px-3 py-2.5">
                                      <div className="flex items-center justify-between gap-3">
                                        <p className="text-[12px] font-semibold text-[#2d2a27]">{entry.status}</p>
                                        <p className="text-[10px] text-[#8a7d78]">
                                          {new Date(entry.createdAt).toLocaleDateString()}
                                        </p>
                                      </div>
                                      <p className="mt-1 text-[12px] leading-5 text-[#6d615e]">{entry.note}</p>
                                    </div>
                                  ))}
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void handleOrderSelection('payment', message.order)}
                                    className="rounded-full border border-[#d9cec7] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#3b4448]"
                                  >
                                    Payment details
                                  </button>
                                  {message.order.actionAvailability?.canCancel ? (
                                    <button
                                      type="button"
                                      onClick={() => void handleOrderSelection('cancel', message.order)}
                                      className="rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[11px] font-semibold text-rose-700"
                                    >
                                      Cancel order
                                    </button>
                                  ) : null}
                                  {message.order.actionAvailability?.canConfirmReceived ? (
                                    <button
                                      type="button"
                                      onClick={() => void handleOrderSelection('confirm', message.order)}
                                      className="rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-semibold text-emerald-700"
                                    >
                                      Confirm received
                                    </button>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => void handleOrderSelection('refund', message.order)}
                                    className="rounded-full border border-[#d9cec7] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#3b4448]"
                                  >
                                    Request help
                                  </button>
                                </div>
                              </div>
                            ) : null}

                            {message.kind === 'cases' ? (
                              <div className="mt-3 space-y-2.5">
                                {message.cases.map((supportCase) => (
                                  <article key={supportCase.id} className="rounded-[1rem] bg-[#f8f4f0] px-3 py-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div>
                                        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7b75]">
                                          {supportCase.id}
                                        </p>
                                        <p className="mt-1.5 text-sm font-semibold capitalize text-[#2d2a27]">
                                          {supportCase.category.replace(/_/g, ' ')}
                                        </p>
                                        <p className="mt-1 text-[12px] leading-5 text-[#6d615e]">
                                          {supportCase.latestSummary ?? 'Support thread ready for review.'}
                                        </p>
                                      </div>
                                      <span
                                        className={cn(
                                          'rounded-full border px-2.5 py-1 text-[10px] font-semibold',
                                          getCaseTone(supportCase.status),
                                        )}
                                      >
                                        {supportCase.status.replace(/_/g, ' ')}
                                      </span>
                                    </div>

                                    <button
                                      type="button"
                                      onClick={() => void loadCaseDetail(supportCase.id)}
                                      disabled={pendingAction === supportCase.id}
                                      className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-[#263845] px-3 py-1.5 text-[11px] font-semibold text-white transition hover:bg-[#304755] disabled:opacity-60"
                                    >
                                      {pendingAction === supportCase.id ? (
                                        <LoaderCircle className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <ChevronRight className="h-3.5 w-3.5" />
                                      )}
                                      Open thread
                                    </button>
                                  </article>
                                ))}
                              </div>
                            ) : null}

                            {message.kind === 'case-detail' ? (
                              <div className="mt-3 rounded-[1rem] bg-[#f8f4f0] px-3 py-3">
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#8c7b75]">
                                      {message.supportCase.id}
                                    </p>
                                    <p className="mt-1.5 text-sm font-semibold capitalize text-[#2d2a27]">
                                      {message.supportCase.category.replace(/_/g, ' ')}
                                    </p>
                                    {message.supportCase.linkedOrder ? (
                                      <p className="mt-1 text-[12px] text-[#6d615e]">
                                        Linked order: {message.supportCase.linkedOrder.id}
                                      </p>
                                    ) : null}
                                  </div>
                                  <span
                                    className={cn(
                                      'rounded-full border px-2.5 py-1 text-[10px] font-semibold',
                                      getCaseTone(message.supportCase.status),
                                    )}
                                  >
                                    {message.supportCase.status.replace(/_/g, ' ')}
                                  </span>
                                </div>

                                {message.supportCase.latestSummary ? (
                                  <div className="mt-3 rounded-[0.9rem] bg-white px-3 py-2.5 text-[12px] leading-5 text-[#655b57]">
                                    {message.supportCase.latestSummary}
                                  </div>
                                ) : null}

                              </div>
                            ) : null}
                          </div>

                          <p className={cn('mt-1 text-[10px] text-slate-400', isBotOrStaff ? 'pl-1' : 'pr-1 text-right')}>
                            {formatBubbleTime(message.createdAt)}
                          </p>
                        </div>

                        {!isBotOrStaff && message.role === 'customer' ? <MessageAvatar role="customer" customerName={user?.name} /> : null}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>

              <div className="border-t border-slate-200 bg-white px-4 pb-4 pt-3 shrink-0">
                {showPrompts ? (
                  <div className="mb-3 flex flex-wrap gap-2">
                    {promptChips.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => void handlePromptChip(chip)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#FF758C]/30 bg-white px-3 py-1.5 text-[12px] font-medium text-[#FF758C] transition hover:bg-[#FF758C]/5"
                      >
                        {chip.actionId ? getQuickActionIcon(chip.actionId) : <Sparkles className="h-3.5 w-3.5" />}
                        {chip.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="flex items-center gap-2">
                  <div className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 shadow-inner flex items-center transition-colors focus-within:bg-white focus-within:border-[#FF758C]/50 focus-within:ring-1 focus-within:ring-[#FF758C]/50">
                    <button
                      type="button"
                      onClick={() => setShowPrompts((currentValue) => !currentValue)}
                      className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-200/50 hover:text-slate-600"
                      aria-label="Toggle support shortcuts"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>

                    <div className="min-w-0 flex-1 px-1">
                      <input
                        type="text"
                        value={draftMessage}
                        onChange={(event) => setDraftMessage(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') {
                            event.preventDefault()
                            void handleComposerSubmit()
                          }
                        }}
                        placeholder={composerPlaceholder}
                        disabled={composerLocked}
                        className="w-full bg-transparent border-0 text-[14px] leading-relaxed shadow-none focus-visible:ring-0 px-1 py-1.5 outline-none disabled:opacity-50"
                      />
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void handleComposerSubmit()}
                    disabled={
                      composerLocked ||
                      pendingAction === 'composer' ||
                      draftMessage.trim().length === 0
                    }
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#FF758C] to-[#FF7EB3] text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg disabled:opacity-50 disabled:hover:translate-y-0"
                    aria-label="Send support message"
                  >
                    {pendingAction === 'composer' ? (
                      <LoaderCircle className="h-5 w-5 animate-spin" />
                    ) : (
                      <SendHorizonal className="h-5 w-5" />
                    )}
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between px-1 text-[11px] text-slate-400">
                  <span>{composerCaption}</span>
                  <span>
                    {bootstrap?.isAuthenticated
                      ? `${recentCases.length} case${recentCases.length === 1 ? '' : 's'}`
                      : 'Tap clip for shortcuts'}
                  </span>
                </div>
              </div>
          </div>
        </div>
      ) : null}
    </>
  )
}
