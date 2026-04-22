'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, LoaderCircle, LifeBuoy, RefreshCw, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { ProtectedRoute } from '@/components/protected-route'
import { AdminSidebar } from '@/components/admin-sidebar'
import { useAuth } from '@/lib/auth-context'
import { getBrowserAuthHeaders } from '@/lib/client-auth-headers'
import { formatPHP } from '@/lib/currency'
import type { SupportCase, SupportStatus } from '@/lib/support-types'
import { toast } from '@/hooks/use-toast'

type StaffMember = {
  id: string
  email: string
  name: string
  role: 'ADMIN' | 'STAFF'
}

type FilterKey = 'open' | 'refund_request' | 'payment_issue' | 'order_help' | 'resolved'

const FILTERS: Array<{
  key: FilterKey
  label: string
}> = [
  { key: 'open', label: 'Open' },
  { key: 'refund_request', label: 'Refund requests' },
  { key: 'payment_issue', label: 'Payment issues' },
  { key: 'order_help', label: 'Order help' },
  { key: 'resolved', label: 'Resolved' },
]

function getCaseTone(status: SupportCase['status']) {
  switch (status) {
    case 'resolved':
      return 'bg-emerald-100 text-emerald-800'
    case 'closed':
      return 'bg-slate-200 text-slate-700'
    case 'waiting_on_customer':
      return 'bg-sky-100 text-sky-800'
    case 'waiting_on_staff':
      return 'bg-amber-100 text-amber-800'
    default:
      return 'bg-rose-100 text-rose-800'
  }
}

function isOpenCase(status: SupportCase['status']) {
  return status === 'open' || status === 'waiting_on_staff' || status === 'waiting_on_customer'
}

export default function AdminSupportPage() {
  const { user } = useAuth()
  const [cases, setCases] = useState<SupportCase[]>([])
  const [staffMembers, setStaffMembers] = useState<StaffMember[]>([])
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null)
  const [selectedCase, setSelectedCase] = useState<SupportCase | null>(null)
  const [activeFilter, setActiveFilter] = useState<FilterKey>('open')
  const [isLoadingCases, setIsLoadingCases] = useState(true)
  const [isLoadingDetail, setIsLoadingDetail] = useState(false)
  const [isSavingCase, setIsSavingCase] = useState(false)
  const [isSendingReply, setIsSendingReply] = useState(false)
  const [isRefunding, setIsRefunding] = useState(false)
  const [manualRefundInfo, setManualRefundInfo] = useState<{ paymentId: string; dashboardUrl: string } | null>(null)
  const [replyDraft, setReplyDraft] = useState('')

  const filteredCases = useMemo(() => {
    return cases.filter((supportCase) => {
      switch (activeFilter) {
        case 'open':
          return isOpenCase(supportCase.status)
        case 'resolved':
          return supportCase.status === 'resolved' || supportCase.status === 'closed'
        case 'refund_request':
        case 'payment_issue':
        case 'order_help':
          return supportCase.category === activeFilter
        default:
          return true
      }
    })
  }, [activeFilter, cases])

  const loadCases = async () => {
    setIsLoadingCases(true)

    try {
      const response = await fetch('/api/support/cases', {
        method: 'GET',
        headers: await getBrowserAuthHeaders(),
        cache: 'no-store',
      })
      const payload = (await response.json().catch(() => null)) as
        | {
            cases?: SupportCase[]
            staffMembers?: StaffMember[]
            error?: string
          }
        | null

      if (!response.ok || !payload?.cases) {
        throw new Error(payload?.error ?? 'Unable to load support cases.')
      }

      setCases(payload.cases)
      setStaffMembers(payload.staffMembers ?? [])

      if (!selectedCaseId && payload.cases.length > 0) {
        setSelectedCaseId(payload.cases[0].id)
      }
    } catch (error) {
      toast({
        title: 'Unable to load support inbox',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingCases(false)
    }
  }

  const loadCaseDetail = async (caseId: string) => {
    setIsLoadingDetail(true)

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
        throw new Error(payload?.error ?? 'Unable to load the selected support thread.')
      }

      setSelectedCase(payload.case)
    } catch (error) {
      toast({
        title: 'Unable to load case',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsLoadingDetail(false)
    }
  }

  useEffect(() => {
    void loadCases()
  }, [])

  useEffect(() => {
    if (!selectedCaseId) {
      setSelectedCase(null)
      return
    }

    void loadCaseDetail(selectedCaseId)
  }, [selectedCaseId])

  useEffect(() => {
    if (filteredCases.length === 0) {
      setSelectedCaseId(null)
      setSelectedCase(null)
      return
    }

    if (!selectedCaseId || !filteredCases.some((supportCase) => supportCase.id === selectedCaseId)) {
      setSelectedCaseId(filteredCases[0].id)
    }
  }, [filteredCases, selectedCaseId])

  const saveCaseUpdate = async (updates: {
    status?: SupportStatus
    assignedTo?: string | null
  }) => {
    if (!selectedCaseId) {
      return
    }

    setIsSavingCase(true)

    try {
      const response = await fetch(`/api/support/cases/${encodeURIComponent(selectedCaseId)}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(await getBrowserAuthHeaders()),
        },
        body: JSON.stringify(updates),
      })
      const payload = (await response.json().catch(() => null)) as
        | {
            case?: SupportCase
            error?: string
          }
        | null

      if (!response.ok || !payload?.case) {
        throw new Error(payload?.error ?? 'Unable to update the support case.')
      }

      setSelectedCase(payload.case)
      setCases((currentCases) =>
        currentCases.map((supportCase) =>
          supportCase.id === payload.case?.id ? payload.case : supportCase,
        ),
      )
      toast({
        title: 'Case updated',
        description: 'The support case has been updated successfully.',
      })
    } catch (error) {
      toast({
        title: 'Unable to update case',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSavingCase(false)
    }
  }

  const handleReplySubmit = async () => {
    if (!selectedCaseId || replyDraft.trim().length === 0) {
      return
    }

    setIsSendingReply(true)

    try {
      const response = await fetch(
        `/api/support/cases/${encodeURIComponent(selectedCaseId)}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(await getBrowserAuthHeaders()),
          },
          body: JSON.stringify({ message: replyDraft.trim() }),
        },
      )
      const payload = (await response.json().catch(() => null)) as
        | {
            case?: SupportCase
            error?: string
          }
        | null

      if (!response.ok || !payload?.case) {
        throw new Error(payload?.error ?? 'Unable to send your support reply.')
      }

      setReplyDraft('')
      setSelectedCase(payload.case)
      setCases((currentCases) =>
        currentCases.map((supportCase) =>
          supportCase.id === payload.case?.id ? payload.case : supportCase,
        ),
      )
      toast({
        title: 'Reply sent',
        description: 'Your reply has been added to the support thread.',
      })
    } catch (error) {
      toast({
        title: 'Unable to send reply',
        description: error instanceof Error ? error.message : 'Please try again.',
        variant: 'destructive',
      })
    } finally {
      setIsSendingReply(false)
    }
  }

  const handleIssueRefundFromCase = async () => {
    if (!selectedCase?.linkedPayment?.checkoutSessionId) return

    const amount = selectedCase.linkedOrder?.total
      ? formatPHP(selectedCase.linkedOrder.total)
      : 'the full amount'

    const confirmed = window.confirm(
      `Issue refund of ${amount} for order ${selectedCase.linkedOrder?.id ?? 'this order'}?\n\nThis will automatically send the money back to the customer via PayMongo (GCash / QR Ph).`,
    )
    if (!confirmed) return

    setIsRefunding(true)
    setManualRefundInfo(null)
    try {
      const response = await fetch('/api/paymongo/refund', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(await getBrowserAuthHeaders()),
        },
        body: JSON.stringify({
          checkoutSessionId: selectedCase.linkedPayment.checkoutSessionId,
          reason: 'others',
          notes: `Refund issued by ${user?.name ?? 'admin'} from Support Inbox — Case ${selectedCase.id}.`,
        }),
      })

      const result = (await response.json().catch(() => null)) as {
        ok?: boolean
        message?: string
        refundId?: string
        error?: string
        manualRefundRequired?: boolean
        paymentId?: string
        dashboardUrl?: string
      } | null

      // QR Ph / GCash — must be done manually via PayMongo Dashboard
      if (response.status === 422 && result?.manualRefundRequired) {
        setManualRefundInfo({
          paymentId: result.paymentId ?? '',
          dashboardUrl: result.dashboardUrl ?? 'https://dashboard.paymongo.com/payments',
        })
        toast({
          title: '⚠️ Manual refund required',
          description: 'QR Ph / GCash payments cannot be refunded via API. See the PayMongo Dashboard link below.',
          variant: 'destructive',
        })
        return
      }

      if (!response.ok || !result?.ok) {
        throw new Error(result?.error ?? result?.message ?? 'Refund failed.')
      }

      // Auto-resolve the case after successful refund
      await saveCaseUpdate({ status: 'resolved' })

      toast({
        title: '✅ Refund issued',
        description: result.message ?? `Money sent back to customer. Refund ID: ${result.refundId}`,
      })
    } catch (error) {
      toast({
        title: 'Refund failed',
        description: error instanceof Error ? error.message : 'Unable to process the refund.',
        variant: 'destructive',
      })
    } finally {
      setIsRefunding(false)
    }
  }

  return (
    <ProtectedRoute requiredRole={['ADMIN', 'STAFF']}>
      <div className="flex min-h-screen bg-background">
        <AdminSidebar />
        <div className="flex-1">
          <div className="border-b border-border bg-card">
            <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
              <div className="mb-4 flex items-center gap-4">
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/admin/dashboard" className="flex items-center gap-2">
                    <ArrowLeft className="h-4 w-4" />
                    Back
                  </Link>
                </Button>
              </div>
              <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                <div>
                  <h1 className="font-serif text-3xl text-foreground">Support Inbox</h1>
                  <p className="mt-2 text-sm text-foreground/60">
                    Review guided chatbot requests, payment concerns, refund follow-up, and customer replies.
                  </p>
                </div>
                <div className="rounded-2xl border border-border/70 bg-white/80 px-4 py-3 text-sm text-foreground/60">
                  Signed in as <span className="font-semibold text-foreground">{user?.name}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
            <div className="flex flex-wrap gap-3">
              {FILTERS.map((filter) => (
                <Button
                  key={filter.key}
                  type="button"
                  variant={activeFilter === filter.key ? 'default' : 'outline'}
                  className="rounded-2xl"
                  onClick={() => setActiveFilter(filter.key)}
                >
                  {filter.label}
                </Button>
              ))}
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
              <section className="rounded-[2rem] border border-border bg-card">
                <div className="border-b border-border px-5 py-4">
                  <p className="text-sm font-semibold text-foreground">
                    {activeFilter === 'open'
                      ? 'Open support threads'
                      : `${FILTERS.find((filter) => filter.key === activeFilter)?.label ?? 'Support threads'}`}
                  </p>
                  <p className="mt-1 text-xs text-foreground/52">
                    {filteredCases.length} visible case(s)
                  </p>
                </div>

                <div className="max-h-[72vh] overflow-y-auto p-4">
                  {isLoadingCases ? (
                    <div className="flex items-center gap-3 rounded-2xl bg-muted/35 px-4 py-4 text-sm text-foreground/60">
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Loading support cases...
                    </div>
                  ) : filteredCases.length === 0 ? (
                    <div className="rounded-2xl bg-muted/35 px-4 py-8 text-center text-sm text-foreground/58">
                      No support cases matched this filter.
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredCases.map((supportCase) => (
                        <button
                          key={supportCase.id}
                          type="button"
                          onClick={() => setSelectedCaseId(supportCase.id)}
                          className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
                            selectedCaseId === supportCase.id
                              ? 'border-primary bg-primary/5 shadow-[0_18px_30px_rgba(191,98,133,0.12)]'
                              : 'border-border bg-white hover:border-primary/40 hover:bg-muted/20'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-foreground/45">
                                {supportCase.id}
                              </p>
                              <p className="mt-2 font-semibold capitalize text-foreground">
                                {supportCase.category.replace(/_/g, ' ')}
                              </p>
                              <p className="mt-1 text-sm text-foreground/58">
                                {supportCase.customerName ?? supportCase.customerEmail}
                              </p>
                            </div>
                            <span
                              className={`inline-flex rounded-full px-3 py-1 text-[11px] font-semibold ${getCaseTone(supportCase.status)}`}
                            >
                              {supportCase.status.replace(/_/g, ' ')}
                            </span>
                          </div>
                          <p className="mt-3 line-clamp-3 text-sm leading-7 text-foreground/62">
                            {supportCase.latestSummary ?? 'Support case ready for review.'}
                          </p>
                          <p className="mt-3 text-xs text-foreground/45">
                            Updated {new Date(supportCase.updatedAt).toLocaleString()}
                          </p>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              <section className="rounded-[2rem] border border-border bg-card">
                {isLoadingDetail ? (
                  <div className="flex min-h-[72vh] items-center justify-center text-sm text-foreground/58">
                    <LoaderCircle className="mr-3 h-4 w-4 animate-spin" />
                    Loading support thread...
                  </div>
                ) : !selectedCase ? (
                  <div className="flex min-h-[72vh] flex-col items-center justify-center gap-4 px-6 text-center">
                    <span className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                      <LifeBuoy className="h-6 w-6" />
                    </span>
                    <div>
                      <p className="text-xl font-semibold text-foreground">Select a support case</p>
                      <p className="mt-2 text-sm leading-7 text-foreground/58">
                        The case detail, linked order, payment snapshot, thread, and reply tools will appear here.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="max-h-[72vh] overflow-y-auto">
                    <div className="border-b border-border px-6 py-5">
                      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <p className="text-xs uppercase tracking-[0.22em] text-foreground/45">
                            {selectedCase.id}
                          </p>
                          <h2 className="mt-2 font-serif text-2xl capitalize text-foreground">
                            {selectedCase.category.replace(/_/g, ' ')}
                          </h2>
                          <p className="mt-2 text-sm text-foreground/58">
                            Customer: {selectedCase.customerName ?? selectedCase.customerEmail}
                          </p>
                          <p className="mt-1 text-sm text-foreground/58">
                            Created {new Date(selectedCase.createdAt).toLocaleString()}
                          </p>
                        </div>
                        <span
                          className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${getCaseTone(selectedCase.status)}`}
                        >
                          {selectedCase.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>

                    <div className="space-y-6 px-6 py-6">
                      <div className="rounded-[1.5rem] bg-muted/30 p-5">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/45">
                          Summary
                        </h3>
                        <p className="mt-3 text-sm leading-7 text-foreground/65">
                          {selectedCase.latestSummary ?? 'No case summary has been generated yet.'}
                        </p>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div className="rounded-[1.5rem] bg-muted/30 p-5">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/45">
                            Assignment & Status
                          </h3>
                          <div className="mt-4 grid gap-3">
                            <label className="text-xs uppercase tracking-[0.18em] text-foreground/42">
                              Status
                            </label>
                            <select
                              value={selectedCase.status}
                              disabled={isSavingCase}
                              onChange={(event) =>
                                void saveCaseUpdate({
                                  status: event.target.value as SupportStatus,
                                })
                              }
                              className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                            >
                              <option value="open">Open</option>
                              <option value="waiting_on_staff">Waiting on staff</option>
                              <option value="waiting_on_customer">Waiting on customer</option>
                              <option value="resolved">Resolved</option>
                              <option value="closed">Closed</option>
                            </select>

                            <label className="mt-2 text-xs uppercase tracking-[0.18em] text-foreground/42">
                              Assigned to
                            </label>
                            <select
                              value={selectedCase.assignedTo ?? ''}
                              disabled={isSavingCase}
                              onChange={(event) =>
                                void saveCaseUpdate({
                                  assignedTo: event.target.value || null,
                                })
                              }
                              className="rounded-2xl border border-border bg-white px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                            >
                              <option value="">Unassigned</option>
                              {staffMembers.map((staffMember) => (
                                <option key={staffMember.id} value={staffMember.id}>
                                  {staffMember.name} ({staffMember.role})
                                </option>
                              ))}
                            </select>

                            {isSavingCase ? (
                              <p className="text-xs text-foreground/45">Saving case changes...</p>
                            ) : null}
                          </div>
                        </div>

                        <div className="rounded-[1.5rem] bg-muted/30 p-5">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/45">
                            Linked Payment
                          </h3>
                          {selectedCase.linkedPayment ? (
                            <div className="mt-4 space-y-2 text-sm text-foreground/65">
                              <p>
                                Method:{' '}
                                <span className="font-semibold text-foreground">
                                  {selectedCase.linkedPayment.paymentMethod ?? 'Unknown'}
                                </span>
                              </p>
                              <p>
                                Status:{' '}
                                <span className="font-semibold text-foreground">
                                  {selectedCase.linkedPayment.paymentStatus ?? 'Unknown'}
                                </span>
                              </p>
                              {selectedCase.linkedPayment.reference ? (
                                <p className="break-all">
                                  Reference:{' '}
                                  <span className="font-semibold text-foreground">
                                    {selectedCase.linkedPayment.reference}
                                  </span>
                                </p>
                              ) : null}
                              {selectedCase.linkedPayment.checkoutSessionId ? (
                                <p className="break-all">
                                  Session:{' '}
                                  <span className="font-semibold text-foreground">
                                    {selectedCase.linkedPayment.checkoutSessionId}
                                  </span>
                                </p>
                              ) : null}

                              {selectedCase.category === 'refund_request' &&
                              selectedCase.linkedPayment.paymentMethod === 'PayMongo' &&
                              selectedCase.linkedPayment.paymentStatus === 'Paid' &&
                              selectedCase.linkedPayment.checkoutSessionId ? (
                                <div className="pt-3 space-y-3">
                                  <Button
                                    type="button"
                                    size="sm"
                                    disabled={isRefunding || isSavingCase}
                                    onClick={() => void handleIssueRefundFromCase()}
                                    className="w-full rounded-2xl bg-amber-500 text-white hover:bg-amber-600"
                                  >
                                    {isRefunding ? (
                                      <><RefreshCw className="mr-2 h-3.5 w-3.5 animate-spin" />Processing refund...</>
                                    ) : (
                                      '⮐ Issue PayMongo Refund'
                                    )}
                                  </Button>
                                  <p className="text-center text-[11px] text-foreground/45">
                                    Sends money back to customer via GCash / QR Ph and resolves this case.
                                  </p>

                                  {manualRefundInfo ? (
                                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 space-y-2">
                                      <p className="text-xs font-semibold text-amber-800">⚠️ Manual refund required</p>
                                      <p className="text-[11px] text-amber-700 leading-5">
                                        QR Ph / GCash payments cannot be refunded via API. Process it directly in the PayMongo Dashboard.
                                      </p>
                                      {manualRefundInfo.paymentId ? (
                                        <p className="text-[11px] text-amber-700 break-all">
                                          Payment ID: <span className="font-mono font-semibold">{manualRefundInfo.paymentId}</span>
                                        </p>
                                      ) : null}
                                      <a
                                        href={manualRefundInfo.dashboardUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-amber-500 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-600"
                                      >
                                        Open PayMongo Dashboard →
                                      </a>
                                    </div>
                                  ) : null}
                                </div>
                              ) : null}
                            </div>
                          ) : (
                            <p className="mt-4 text-sm text-foreground/58">
                              No payment snapshot is linked to this case.
                            </p>
                          )}
                        </div>
                      </div>

                      {selectedCase.linkedOrder ? (
                        <div className="rounded-[1.5rem] bg-muted/30 p-5">
                          <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/45">
                            Linked Order
                          </h3>
                          <div className="mt-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <p className="text-xs uppercase tracking-[0.22em] text-foreground/45">
                                {selectedCase.linkedOrder.id}
                              </p>
                              <p className="mt-2 text-xl font-semibold text-foreground">
                                {selectedCase.linkedOrder.status}
                              </p>
                              <p className="mt-2 text-sm text-foreground/60">
                                {selectedCase.linkedOrder.customerName} / {selectedCase.linkedOrder.customerEmail}
                              </p>
                            </div>
                            <div className="text-sm text-foreground/65 lg:text-right">
                              <p>
                                Total:{' '}
                                <span className="font-semibold text-foreground">
                                  {formatPHP(selectedCase.linkedOrder.total)}
                                </span>
                              </p>
                              <p className="mt-1">
                                Payment:{' '}
                                <span className="font-semibold text-foreground">
                                  {selectedCase.linkedOrder.paymentStatus}
                                </span>
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-2">
                            {selectedCase.linkedOrder.items.map((item) => (
                              <div
                                key={`${selectedCase.linkedOrder?.id}-${item.productId}-${item.size}`}
                                className="rounded-2xl bg-white/80 px-4 py-3 text-sm text-foreground/65"
                              >
                                <p className="font-semibold text-foreground">{item.productName}</p>
                                <p className="mt-1">
                                  {item.quantity} x {item.size}ml
                                </p>
                                <p className="mt-1">{formatPHP(item.unitPrice)} each</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : null}

                      <div className="rounded-[1.5rem] bg-muted/30 p-5">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/45">
                          Thread
                        </h3>

                        {selectedCase.messages?.length ? (
                          <div className="mt-4 space-y-3">
                            {selectedCase.messages.map((message) => (
                              <div
                                key={message.id}
                                className="rounded-2xl bg-white/82 px-4 py-4"
                              >
                                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                  <p className="font-semibold text-foreground">{message.authorName}</p>
                                  <p className="text-xs text-foreground/42">
                                    {new Date(message.createdAt).toLocaleString()}
                                  </p>
                                </div>
                                <p className="mt-2 text-sm leading-7 text-foreground/65">
                                  {message.message}
                                </p>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="mt-4 text-sm text-foreground/58">
                            No support messages are attached to this case yet.
                          </p>
                        )}
                      </div>

                      <div className="rounded-[1.5rem] bg-muted/30 p-5">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.22em] text-foreground/45">
                          Reply
                        </h3>
                        <Textarea
                          value={replyDraft}
                          onChange={(event) => setReplyDraft(event.target.value)}
                          placeholder="Write your update or response for the customer..."
                          className="mt-4 min-h-28 rounded-2xl border-border bg-white"
                        />
                        <div className="mt-4 flex items-center justify-end">
                          <Button
                            type="button"
                            className="rounded-2xl"
                            disabled={isSendingReply || replyDraft.trim().length === 0}
                            onClick={() => void handleReplySubmit()}
                          >
                            {isSendingReply ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <Send className="h-4 w-4" />
                            )}
                            Send reply
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </ProtectedRoute>
  )
}
