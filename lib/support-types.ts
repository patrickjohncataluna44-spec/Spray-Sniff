import type { OrderRecord } from '@/lib/store-engine'

export type SupportCategory = 'order_help' | 'payment_issue' | 'refund_request' | 'general'
export type SupportStatus =
  | 'open'
  | 'waiting_on_staff'
  | 'waiting_on_customer'
  | 'resolved'
  | 'closed'
export type SupportPriority = 'low' | 'normal' | 'high'
export type SupportSource = 'chatbot'
export type SupportAuthorType = 'customer' | 'bot' | 'staff' | 'system'
export type SupportQuickActionId =
  | 'track_order'
  | 'check_payment'
  | 'cancel_order'
  | 'confirm_received'
  | 'request_refund'
  | 'talk_to_support'
  | 'view_cases'
  | 'browse_faqs'
  | 'sign_in'

export interface SupportQuickAction {
  id: SupportQuickActionId
  label: string
  description: string
}

export interface SupportFaq {
  id: string
  question: string
  answer: string
}

export interface SupportCustomerProfile {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'STAFF' | 'USER'
}

export interface SupportPaymentSnapshot {
  paymentMethod?: string
  paymentStatus?: string
  paymentGateway?: string
  paymentChannel?: string
  reference?: string
  checkoutSessionId?: string
  paidAt?: string
}

export interface SupportMessage {
  id: string
  caseId: string
  authorType: SupportAuthorType
  authorId?: string | null
  authorName: string
  message: string
  metadata?: Record<string, unknown> | null
  createdAt: string
}

export interface SupportCase {
  id: string
  customerId?: string | null
  customerEmail: string
  customerName?: string
  category: SupportCategory
  status: SupportStatus
  priority: SupportPriority
  source: SupportSource
  orderId?: string | null
  paymentRecordId?: string | null
  paymentReference?: string | null
  latestSummary?: string | null
  assignedTo?: string | null
  assignedToName?: string | null
  createdAt: string
  updatedAt: string
  linkedOrder?: OrderRecord
  linkedPayment?: SupportPaymentSnapshot
  messages?: SupportMessage[]
}

export interface SupportBootstrapPayload {
  isAuthenticated: boolean
  customer: SupportCustomerProfile | null
  welcomeMessage: string
  quickActions: SupportQuickAction[]
  faqs: SupportFaq[]
  recentOrders: OrderRecord[]
  recentCases: SupportCase[]
}

export type SupportAction =
  | 'listOwnOrders'
  | 'getOrderDetails'
  | 'getPaymentDetails'
  | 'cancelOwnOrder'
  | 'confirmOwnDelivery'
  | 'createRefundRequest'
  | 'createSupportCase'

export type SupportActionRequest =
  | { action: 'listOwnOrders' }
  | { action: 'getOrderDetails'; orderId: string }
  | { action: 'getPaymentDetails'; orderId: string }
  | { action: 'cancelOwnOrder'; orderId: string }
  | { action: 'confirmOwnDelivery'; orderId: string }
  | { action: 'createRefundRequest'; orderId: string; message?: string }
  | {
      action: 'createSupportCase'
      category?: SupportCategory
      orderId?: string
      message?: string
    }

export interface SupportActionResult {
  ok: boolean
  message: string
  orders?: OrderRecord[]
  order?: OrderRecord
  case?: SupportCase
  cases?: SupportCase[]
}

