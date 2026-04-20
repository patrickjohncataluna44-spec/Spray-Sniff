'use client'

import { type FormEvent, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import {
  ArrowLeft,
  BadgePercent,
  CalendarDays,
  Save,
  TicketPercent,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  PROMOTION_STATUSES,
  PROMOTION_TYPES,
  type PromotionFormValues,
} from '@/lib/admin-promotions'
import { formatPHP } from '@/lib/currency'

type FormErrors = Partial<Record<keyof PromotionFormValues, string>>

interface AdminPromotionEditorProps {
  title: string
  description: string
  submitLabel: string
  backHref: string
  backLabel: string
  cancelHref: string
  initialValues: PromotionFormValues
  onSubmit: (values: PromotionFormValues) => Promise<void>
}

function FieldError({ message }: { message?: string }) {
  if (!message) {
    return null
  }

  return <p className="text-xs text-destructive">{message}</p>
}

function validateForm(values: PromotionFormValues): FormErrors {
  const errors: FormErrors = {}
  const discountValue = Number(values.discountValue)
  const usedCount = Number(values.usedCount)
  const hasUsageLimit = values.usageLimit.trim().length > 0
  const usageLimit = hasUsageLimit ? Number(values.usageLimit) : null

  if (!values.code.trim()) {
    errors.code = 'Enter a promotion code.'
  }

  if (!Number.isFinite(discountValue) || discountValue <= 0) {
    errors.discountValue = 'Enter a valid discount amount.'
  }

  if (values.type === 'Percentage' && discountValue > 100) {
    errors.discountValue = 'Percentage discounts cannot exceed 100.'
  }

  if (!Number.isFinite(usedCount) || usedCount < 0) {
    errors.usedCount = 'Used count must be 0 or higher.'
  }

  if (
    hasUsageLimit &&
    (!Number.isFinite(usageLimit) || (usageLimit ?? 0) < 0)
  ) {
    errors.usageLimit = 'Usage limit must be blank or 0 and above.'
  }

  if (
    hasUsageLimit &&
    Number.isFinite(usedCount) &&
    typeof usageLimit === 'number' &&
    usedCount > usageLimit
  ) {
    errors.usedCount = 'Used count cannot be higher than the usage limit.'
  }

  if (!values.startsAt) {
    errors.startsAt = 'Choose a start date.'
  }

  if (!values.expiresAt) {
    errors.expiresAt = 'Choose an expiry date.'
  }

  if (values.startsAt && values.expiresAt && values.startsAt > values.expiresAt) {
    errors.expiresAt = 'Expiry date must be on or after the start date.'
  }

  return errors
}

export function AdminPromotionEditor({
  title,
  description,
  submitLabel,
  backHref,
  backLabel,
  cancelHref,
  initialValues,
  onSubmit,
}: AdminPromotionEditorProps) {
  const [formValues, setFormValues] = useState<PromotionFormValues>(initialValues)
  const [errors, setErrors] = useState<FormErrors>({})
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    setFormValues(initialValues)
    setErrors({})
  }, [initialValues])

  const updateField = <K extends keyof PromotionFormValues>(
    field: K,
    value: PromotionFormValues[K],
  ) => {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }))

    setErrors((current) => ({
      ...current,
      [field]: undefined,
    }))
  }

  const previewDiscount = useMemo(() => {
    const numericValue = Number(formValues.discountValue)

    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return formValues.type === 'Fixed' ? formatPHP(0) : '0%'
    }

    return formValues.type === 'Fixed'
      ? formatPHP(numericValue)
      : `${numericValue}%`
  }, [formValues.discountValue, formValues.type])

  const usageLabel =
    formValues.usageLimit.trim().length > 0
      ? `${formValues.usedCount || '0'}/${formValues.usageLimit}`
      : `${formValues.usedCount || '0'}/Unlimited`

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()

    const nextErrors = validateForm(formValues)

    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors)
      return
    }

    setIsSubmitting(true)

    try {
      await onSubmit(formValues)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="mb-4 flex items-center gap-4">
            <Button variant="ghost" size="sm" asChild>
              <Link href={backHref} className="flex items-center gap-2">
                <ArrowLeft className="h-4 w-4" />
                {backLabel}
              </Link>
            </Button>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <span className="inline-flex rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-primary">
                Promotions Studio
              </span>
              <h1 className="mt-4 font-serif text-3xl text-foreground">{title}</h1>
              <p className="mt-2 max-w-3xl text-sm text-foreground/60">
                {description}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-background/80 px-4 py-3 text-sm text-foreground/70">
              <p className="font-medium text-foreground">Best-practice setup</p>
              <p className="mt-1 text-sm text-foreground/60">
                Percentage works best for seasonal sales. Fixed discounts work best
                for welcome offers and quick-entry promos.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8">
        <div className="grid gap-8 xl:grid-cols-[minmax(0,1.35fr)_380px]">
          <form onSubmit={handleSubmit} className="space-y-8">
            <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-6">
                <h2 className="font-serif text-2xl text-foreground">
                  Promotion Basics
                </h2>
                <p className="mt-2 text-sm text-foreground/60">
                  Start with the code, discount style, and customer-facing summary.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="code">Promotion Code</Label>
                  <Input
                    id="code"
                    value={formValues.code}
                    onChange={(event) =>
                      updateField('code', event.target.value.toUpperCase())
                    }
                    placeholder="WELCOME10"
                  />
                  <FieldError message={errors.code} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="status">Status</Label>
                  <select
                    id="status"
                    value={formValues.status}
                    onChange={(event) =>
                      updateField(
                        'status',
                        event.target.value as PromotionFormValues['status'],
                      )
                    }
                    className="h-10 rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {PROMOTION_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {status}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="type">Discount Type</Label>
                  <select
                    id="type"
                    value={formValues.type}
                    onChange={(event) =>
                      updateField(
                        'type',
                        event.target.value as PromotionFormValues['type'],
                      )
                    }
                    className="h-10 rounded-md border border-input bg-transparent px-3 text-sm text-foreground outline-none transition-[color,box-shadow] focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    {PROMOTION_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="discountValue">
                    {formValues.type === 'Fixed'
                      ? 'Discount Amount (PHP)'
                      : 'Discount Percentage'}
                  </Label>
                  <Input
                    id="discountValue"
                    type="number"
                    min="0"
                    step={formValues.type === 'Fixed' ? '0.01' : '1'}
                    value={formValues.discountValue}
                    onChange={(event) =>
                      updateField('discountValue', event.target.value)
                    }
                    placeholder={formValues.type === 'Fixed' ? '100' : '15'}
                  />
                  <FieldError message={errors.discountValue} />
                </div>

                <div className="grid gap-2 md:col-span-2">
                  <Label htmlFor="description">Campaign Notes</Label>
                  <Textarea
                    id="description"
                    value={formValues.description}
                    onChange={(event) =>
                      updateField('description', event.target.value)
                    }
                    placeholder="Explain who this discount is for and when it should be used."
                    className="min-h-28"
                  />
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <div className="mb-6">
                <h2 className="font-serif text-2xl text-foreground">
                  Scheduling and Limits
                </h2>
                <p className="mt-2 text-sm text-foreground/60">
                  Control when the promotion runs and how many times it can be redeemed.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="startsAt">Starts On</Label>
                  <Input
                    id="startsAt"
                    type="date"
                    value={formValues.startsAt}
                    onChange={(event) => updateField('startsAt', event.target.value)}
                  />
                  <FieldError message={errors.startsAt} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="expiresAt">Expires On</Label>
                  <Input
                    id="expiresAt"
                    type="date"
                    value={formValues.expiresAt}
                    onChange={(event) => updateField('expiresAt', event.target.value)}
                  />
                  <FieldError message={errors.expiresAt} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="usedCount">Used Count</Label>
                  <Input
                    id="usedCount"
                    type="number"
                    min="0"
                    value={formValues.usedCount}
                    onChange={(event) => updateField('usedCount', event.target.value)}
                    placeholder="0"
                  />
                  <FieldError message={errors.usedCount} />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="usageLimit">Usage Limit</Label>
                  <Input
                    id="usageLimit"
                    type="number"
                    min="0"
                    value={formValues.usageLimit}
                    onChange={(event) => updateField('usageLimit', event.target.value)}
                    placeholder="Leave blank for unlimited"
                  />
                  <FieldError message={errors.usageLimit} />
                </div>
              </div>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
              <Button variant="outline" asChild>
                <Link href={cancelHref}>Cancel</Link>
              </Button>
              <Button type="submit" className="gap-2" disabled={isSubmitting}>
                <Save className="h-4 w-4" />
                {submitLabel}
              </Button>
            </div>
          </form>

          <div className="space-y-6">
            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm xl:sticky xl:top-8">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm uppercase tracking-[0.22em] text-primary">
                    Live Preview
                  </p>
                  <h2 className="mt-2 font-serif text-2xl text-foreground">
                    {formValues.code.trim() || 'PROMO-CODE'}
                  </h2>
                </div>
                <TicketPercent className="h-5 w-5 text-primary" />
              </div>

              <div className="mt-6 space-y-4 rounded-3xl border border-border bg-[radial-gradient(circle_at_top,rgba(255,228,236,0.8),rgba(255,250,252,0.95)_58%,rgba(255,255,255,1))] p-5">
                <div className="flex items-center justify-between rounded-2xl bg-white/80 p-4 shadow-sm">
                  <div>
                    <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">
                      Discount
                    </p>
                    <p className="mt-2 font-serif text-3xl text-foreground">
                      {previewDiscount}
                    </p>
                  </div>
                  <BadgePercent className="h-6 w-6 text-primary" />
                </div>

                <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                  <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">
                    Status
                  </p>
                  <p className="mt-2 text-base font-medium text-foreground">
                    {formValues.status}
                  </p>
                  <p className="mt-1 text-sm text-foreground/60">
                    {formValues.description.trim() ||
                      'Add campaign notes so your team knows when to use this promotion.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">
                      Usage
                    </p>
                    <p className="mt-2 text-base font-medium text-foreground">
                      {usageLabel}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white/80 p-4 shadow-sm">
                    <p className="text-xs uppercase tracking-[0.18em] text-foreground/45">
                      Window
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-base font-medium text-foreground">
                      <CalendarDays className="h-4 w-4 text-primary" />
                      <span>{formValues.expiresAt || 'Set dates'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="rounded-3xl border border-border bg-card p-6 shadow-sm">
              <p className="text-sm uppercase tracking-[0.22em] text-primary">
                Best Use
              </p>
              <h3 className="mt-3 font-serif text-2xl text-foreground">
                Which Discount Type Works Best?
              </h3>
              <div className="mt-4 space-y-3 text-sm leading-6 text-foreground/70">
                <p>
                  Percentage discounts are best for big seasonal promotions because
                  they scale naturally across different product prices.
                </p>
                <p>
                  Fixed discounts are best for welcome codes and simple marketing
                  campaigns because customers understand them instantly.
                </p>
                <p>
                  If you want broad appeal, start with a percentage promo. If you
                  want fast conversion on entry offers, use a fixed amount.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
