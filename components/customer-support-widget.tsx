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
  role: 'bot' | 'customer'
  text: string
  createdAt: string
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
}: {
  role: 'bot' | 'customer'
  customerName?: string | null
}) {
  if (role === 'bot') {
    return (
      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[#f5d469] bg-[#ffe266] text-[#3c332a] shadow-[0_8px_18px_rgba(164,130,53,0.18)]">
        <Bot className="h-3.5 w-3.5" />
      </span>
    )
  }

  return (
    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-white/65 bg-[linear-gradient(135deg,#ffbaab,#ff928f)] text-[11px] font-semibold text-white shadow-[0_8px_18px_rgba(202,108,109,0.18)]">
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

  const appendTextMessage = (role: 'bot' | 'customer', text: string) => {
    appendMessage({
      id: createMessageId(),
      role,
      text,
      kind: 'text',
      createdAt: new Date().toISOString(),
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
      appendCaseDetailMessage(
        `Opening ${payload.case.id}. You can review the thread below and reply when you're ready.`,
        payload.case,
      )
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
        appendCaseDetailMessage(result.message, result.case)

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
        appendCaseDetailMessage('Your reply has been added to the support thread.', payload.case)
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
        appendCaseDetailMessage(result.message, result.case)
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
          className="fixed bottom-5 right-5 z-40 flex items-center gap-3 rounded-full bg-[#3b3431] px-4 py-3 text-left text-white shadow-[0_24px_45px_rgba(63,48,45,0.28)] transition hover:-translate-y-0.5"
        >
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#ffe266] text-[#3b332c] shadow-[0_10px_20px_rgba(164,130,53,0.24)]">
            <MessageCircle className="h-5 w-5" />
          </span>
          <span className="hidden sm:block">
            <span className="block text-[11px] uppercase tracking-[0.24em] text-white/52">Customer Support</span>
            <span className="mt-1 block text-sm font-medium">Chat with Aria</span>
          </span>
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

          <div className="absolute bottom-3 left-3 right-3 top-20 overflow-hidden rounded-[2rem] border border-[#e9ddd4] bg-[linear-gradient(180deg,rgba(122,118,108,0.88),rgba(145,140,131,0.82))] shadow-[0_28px_70px_rgba(73,59,54,0.28)] backdrop-blur-2xl md:bottom-5 md:left-auto md:right-5 md:top-auto md:h-[38rem] md:w-[22rem]">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.15),transparent_28%),radial-gradient(circle_at_bottom,rgba(0,0,0,0.08),transparent_40%)]" />

            <div className="relative flex h-full flex-col">
              <div className="border-b border-white/12 bg-[rgba(78,75,67,0.88)] px-4 py-3 text-white">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[#ffe266] text-[#3b332c] shadow-[0_8px_16px_rgba(164,130,53,0.24)]">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-left text-sm font-semibold tracking-[0.01em] text-white">
                        Aria - Spray & Sniff Assistant
                      </p>
                      <p className="mt-0.5 text-left text-xs text-white/62">
                        Orders, payments, and customer help
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/8 text-white/72 transition hover:bg-white/14 hover:text-white"
                    aria-label="Close support chat"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-3 flex items-center gap-2 text-[11px] text-white/56">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>
                    {bootstrap?.isAuthenticated
                      ? `Secure mode / ${recentOrders.length} online order${recentOrders.length === 1 ? '' : 's'} visible`
                      : 'Guest mode / Sign in for order visibility'}
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
                    const isBot = message.role === 'bot'

                    return (
                      <div
                        key={message.id}
                        className={cn('flex items-end gap-2', isBot ? 'justify-start pr-8' : 'justify-end pl-8')}
                      >
                        {isBot ? <MessageAvatar role="bot" customerName={user?.name} /> : null}

                        <div className={cn('min-w-0 max-w-[82%]', !isBot && 'items-end')}>
                          <div
                            className={cn(
                              'rounded-[1.15rem] bg-white px-3 py-2.5 text-[13px] leading-5 text-[#2f2b29] shadow-[0_10px_22px_rgba(63,52,49,0.12)]',
                              isBot ? 'rounded-bl-sm' : 'rounded-br-sm',
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

                                {message.supportCase.messages?.length ? (
                                  <div className="mt-3 space-y-2">
                                    {message.supportCase.messages.slice(-3).map((threadMessage) => (
                                      <div key={threadMessage.id} className="rounded-[0.9rem] bg-white px-3 py-2.5">
                                        <div className="flex items-center justify-between gap-3">
                                          <p className="text-[12px] font-semibold text-[#2d2a27]">
                                            {threadMessage.authorName}
                                          </p>
                                          <p className="text-[10px] text-[#8a7d78]">
                                            {new Date(threadMessage.createdAt).toLocaleDateString()}
                                          </p>
                                        </div>
                                        <p className="mt-1 text-[12px] leading-5 text-[#6d615e]">
                                          {threadMessage.message}
                                        </p>
                                      </div>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            ) : null}
                          </div>

                          <p className={cn('mt-1 text-[10px] text-white/70', isBot ? 'pl-1' : 'pr-1 text-right')}>
                            {formatBubbleTime(message.createdAt)}
                          </p>
                        </div>

                        {!isBot ? <MessageAvatar role="customer" customerName={user?.name} /> : null}
                      </div>
                    )
                  })}
                </div>
              </ScrollArea>

              <div className="border-t border-white/12 bg-[rgba(243,240,235,0.92)] px-3 pb-3 pt-2">
                {showPrompts ? (
                  <div className="mb-2.5 flex flex-wrap gap-2">
                    {promptChips.map((chip) => (
                      <button
                        key={chip.id}
                        type="button"
                        onClick={() => void handlePromptChip(chip)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-[#ddd3cb] bg-white px-3 py-1.5 text-[11px] font-semibold text-[#5b5552] transition hover:bg-[#f8f4ef]"
                      >
                        {chip.actionId ? getQuickActionIcon(chip.actionId) : <Sparkles className="h-3.5 w-3.5" />}
                        {chip.label}
                      </button>
                    ))}
                  </div>
                ) : null}

                <div className="rounded-full border border-[#ded5cd] bg-white px-2 py-2 shadow-[0_10px_18px_rgba(74,63,59,0.08)]">
                  <div className="flex items-end gap-2">
                    <button
                      type="button"
                      onClick={() => setShowPrompts((currentValue) => !currentValue)}
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#6a625f] transition hover:bg-[#f6f2ed]"
                      aria-label="Toggle support shortcuts"
                    >
                      <Paperclip className="h-4 w-4" />
                    </button>

                    <div className="min-w-0 flex-1">
                      <Textarea
                        value={draftMessage}
                        onChange={(event) => setDraftMessage(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' && !event.shiftKey) {
                            event.preventDefault()
                            void handleComposerSubmit()
                          }
                        }}
                        placeholder={composerPlaceholder}
                        disabled={composerLocked}
                        className="min-h-0 border-0 bg-transparent px-0 py-1 text-sm leading-5 shadow-none focus-visible:ring-0"
                      />
                    </div>

                    <button
                      type="button"
                      onClick={() => void handleComposerSubmit()}
                      disabled={
                        composerLocked ||
                        pendingAction === 'composer' ||
                        draftMessage.trim().length === 0
                      }
                      className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#1d4055] text-white transition hover:bg-[#285068] disabled:opacity-60"
                      aria-label="Send support message"
                    >
                      {pendingAction === 'composer' ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : (
                        <SendHorizonal className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[10px] text-[#6b625f]">
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
        </div>
      ) : null}
    </>
  )
}
