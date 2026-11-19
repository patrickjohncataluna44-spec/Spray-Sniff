'use client'

import { useEffect, useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts'
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart'
import {
  buildSalesTrendSeries,
  getAvailableSalesMonths,
  getAvailableSalesYears,
  roundAnalyticsCurrency,
  type SalesTrendGranularity,
} from '@/lib/analytics'
import { formatPHP } from '@/lib/currency'
import type { OrderRecord } from '@/lib/store-context'

interface AdminSalesTrendCardProps {
  orders: OrderRecord[]
  chartConfig: ChartConfig
  title?: string
  description?: string
  chartHeightClass?: string
  forcedMonthKey?: string
}

function formatMonthOptionLabel(monthKey: string) {
  const [year, month] = monthKey.split('-').map(Number)
  const date = new Date(year, month - 1, 1)
  return date.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })
}

function formatYAxisCurrency(value: number) {
  if (value === 0) return '₱0'
  if (value >= 1000) {
    const thousands = value / 1000
    return `₱${Number.isInteger(thousands) ? thousands : thousands.toFixed(1)}k`
  }
  return `₱${Math.round(value)}`
}

export function AdminSalesTrendCard({
  orders,
  chartConfig,
  title = 'Sales Trend',
  description = 'Paid revenue split between online orders and POS transactions.',
  chartHeightClass = 'h-[300px]',
  forcedMonthKey,
}: AdminSalesTrendCardProps) {
  const availableYears = useMemo(() => getAvailableSalesYears(orders), [orders])
  const availableMonths = useMemo(() => getAvailableSalesMonths(orders), [orders])

  const [granularity, setGranularity] = useState<SalesTrendGranularity>('days')
  const [selectedYear, setSelectedYear] = useState<number>(() => availableYears[0])
  const [daysFilter, setDaysFilter] = useState<string>(() => availableMonths[0] ?? 'last7')

  useEffect(() => {
    if (!availableYears.includes(selectedYear) && availableYears.length > 0) {
      setSelectedYear(availableYears[0])
    }
  }, [availableYears, selectedYear])

  useEffect(() => {
    if (forcedMonthKey && forcedMonthKey !== 'all') {
      setGranularity('days')
      setDaysFilter(forcedMonthKey)
      const [yr] = forcedMonthKey.split('-').map(Number)
      if (yr) setSelectedYear(yr)
      return
    }

    if (
      daysFilter !== 'last7' &&
      daysFilter !== 'last30' &&
      !availableMonths.includes(daysFilter)
    ) {
      setDaysFilter(availableMonths[0] ?? 'last7')
    }
  }, [availableMonths, daysFilter, forcedMonthKey])

  const seriesData = useMemo(() => {
    if (granularity === 'years') {
      return buildSalesTrendSeries(orders, { granularity: 'years' })
    }
    if (granularity === 'months') {
      return buildSalesTrendSeries(orders, { granularity: 'months', year: selectedYear })
    }
    if (daysFilter === 'last7' || daysFilter === 'last30') {
      return buildSalesTrendSeries(orders, { granularity: 'days', daysWindow: daysFilter })
    }
    return buildSalesTrendSeries(orders, {
      granularity: 'days',
      daysWindow: 'month',
      monthKey: daysFilter,
    })
  }, [daysFilter, granularity, orders, selectedYear])

  const windowSummary = useMemo(() => {
    const totals = seriesData.reduce(
      (acc, point) => {
        acc.revenue += point.revenue
        acc.online += point.online
        acc.pos += point.pos
        acc.orders += point.orders
        return acc
      },
      { revenue: 0, online: 0, pos: 0, orders: 0 },
    )
    return {
      revenue: roundAnalyticsCurrency(totals.revenue),
      online: roundAnalyticsCurrency(totals.online),
      pos: roundAnalyticsCurrency(totals.pos),
      orders: totals.orders,
    }
  }, [seriesData])

  const granularityLabel =
    granularity === 'days'
      ? 'Daily'
      : granularity === 'months'
        ? 'Monthly'
        : 'Yearly'

  return (
    <section className="rounded-2xl border border-border bg-card p-6">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="font-serif text-2xl text-foreground">
            {granularityLabel} {title}
          </h2>
          <p className="mt-1.5 text-sm text-foreground/60">{description}</p>
          <p className="mt-2 text-xs font-medium text-foreground/75">
            Period total:{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {formatPHP(windowSummary.revenue)}
            </span>{' '}
            &bull; Online:{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {formatPHP(windowSummary.online)}
            </span>{' '}
            &bull; POS:{' '}
            <span className="font-semibold tabular-nums text-foreground">
              {formatPHP(windowSummary.pos)}
            </span>{' '}
            &bull; {windowSummary.orders} paid order(s)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            className="inline-flex rounded-xl border border-border bg-muted/60 p-1"
            role="group"
            aria-label="Sales trend granularity"
          >
            {(
              [
                { id: 'days', label: 'Days' },
                { id: 'months', label: 'Months' },
                { id: 'years', label: 'Years' },
              ] as const
            ).map((option) => {
              const isActive = granularity === option.id
              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setGranularity(option.id)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${isActive
                    ? 'bg-primary text-primary-foreground'
                    : 'text-foreground/65 hover:text-foreground'
                    }`}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
          {granularity === 'days' && (
            <select
              aria-label="Select days range or month"
              value={daysFilter}
              onChange={(event) => setDaysFilter(event.target.value)}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {availableMonths.map((monthKey) => (
                <option key={monthKey} value={monthKey}>
                  {formatMonthOptionLabel(monthKey)}
                </option>
              ))}
              <option value="last30">Last 30 Days</option>
              <option value="last7">Last 7 Days</option>
            </select>
          )}

          {granularity === 'months' && (
            <select
              aria-label="Select year for monthly trend"
              value={String(selectedYear)}
              onChange={(event) => setSelectedYear(Number(event.target.value))}
              className="rounded-xl border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
            >
              {availableYears.map((yr) => (
                <option key={yr} value={String(yr)}>
                  {yr}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>

      <ChartContainer config={chartConfig} className={`${chartHeightClass} w-full`}>
        <BarChart data={seriesData}>
          <CartesianGrid vertical={false} />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tickMargin={8}
            minTickGap={granularity === 'days' ? 12 : 4}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            tickFormatter={formatYAxisCurrency}
          />
          <ChartTooltip
            cursor={false}
            content={
              <ChartTooltipContent
                indicator="dot"
                labelFormatter={(_label, payload) => {
                  const first = payload?.[0]?.payload as { fullLabel?: string; orders?: number } | undefined
                  if (!first?.fullLabel) return ''
                  return `${first.fullLabel} (${first.orders ?? 0} order${first.orders === 1 ? '' : 's'})`
                }}
                formatter={(value, name) => (
                  <div className="flex w-full items-center justify-between gap-6">
                    <span className="text-muted-foreground">{String(name)}</span>
                    <span className="font-medium text-foreground">
                      {formatPHP(Number(value))}
                    </span>
                  </div>
                )}
              />
            }
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="online"
            stackId="sales"
            fill="var(--color-online)"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="pos"
            stackId="sales"
            fill="var(--color-pos)"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </section>
  )
}
