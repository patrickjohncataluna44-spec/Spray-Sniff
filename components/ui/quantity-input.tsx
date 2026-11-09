'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Minus, Plus } from 'lucide-react'

export interface QuantityInputProps {
  value: number
  onChange: (value: number) => void
  min?: number
  max?: number
  disabled?: boolean
  className?: string
  size?: 'sm' | 'md'
  ariaLabel?: string
  showMaxIndicator?: boolean
}

export function QuantityInput({
  value,
  onChange,
  min = 1,
  max = 9999,
  disabled = false,
  className = '',
  size = 'md',
  ariaLabel = 'Quantity',
  showMaxIndicator = true,
}: QuantityInputProps) {
  const isOutOfStock = max <= 0 || disabled
  const effectiveMin = isOutOfStock ? 0 : min
  const effectiveValue = isOutOfStock ? 0 : Math.max(effectiveMin, Math.min(value, max))

  const [buffer, setBuffer] = useState<string>(String(effectiveValue))
  const [showMaxNotice, setShowMaxNotice] = useState(false)
  const noticeTimerRef = useRef<NodeJS.Timeout | null>(null)

  const triggerMaxNotice = () => {
    if (!showMaxIndicator || isOutOfStock) return
    setShowMaxNotice(true)
    if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    noticeTimerRef.current = setTimeout(() => {
      setShowMaxNotice(false)
    }, 1800)
  }

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current) clearTimeout(noticeTimerRef.current)
    }
  }, [])

  // Synchronize buffer when external value or max changes
  useEffect(() => {
    setBuffer(String(effectiveValue))
  }, [effectiveValue])

  const commit = (text: string) => {
    if (isOutOfStock) {
      setBuffer('0')
      onChange(0)
      return
    }

    const trimmed = text.trim()
    if (!trimmed) {
      setBuffer(String(effectiveMin))
      onChange(effectiveMin)
      return
    }

    const parsed = parseInt(trimmed, 10)
    if (Number.isNaN(parsed)) {
      setBuffer(String(effectiveMin))
      onChange(effectiveMin)
      return
    }

    if (parsed > max) {
      setBuffer(String(max))
      onChange(max)
      triggerMaxNotice()
      return
    }

    const clamped = Math.max(effectiveMin, Math.min(parsed, max))
    setBuffer(String(clamped))
    onChange(clamped)
  }

  const handleDecrease = () => {
    if (isOutOfStock) return
    const current = parseInt(buffer, 10) || effectiveValue
    const next = Math.max(effectiveMin, current - 1)
    setBuffer(String(next))
    onChange(next)
  }

  const handleIncrease = () => {
    if (isOutOfStock) return
    const current = parseInt(buffer, 10) || effectiveValue
    if (current >= max) {
      triggerMaxNotice()
      return
    }
    const next = Math.min(max, current + 1)
    setBuffer(String(next))
    onChange(next)
  }

  const buttonSize = size === 'sm' ? 'h-7 w-7' : 'h-10 w-10 rounded-xl'
  const iconSize = size === 'sm' ? 'h-3.5 w-3.5' : 'h-4 w-4'
  const inputWidth = size === 'sm' ? 'w-10 text-xs' : 'w-14 text-sm'

  return (
    <div className="inline-flex items-center gap-2">
      <div
        data-ui="quantity-input"
        className={`inline-flex items-center gap-1 rounded-2xl border border-border/70 bg-white/80 p-1 dark:bg-stone-900/80 ${
          isOutOfStock ? 'opacity-60 cursor-not-allowed' : ''
        } ${className}`}
      >
        <button
          type="button"
          onClick={handleDecrease}
          disabled={isOutOfStock || effectiveValue <= effectiveMin}
          className={`inline-flex ${buttonSize} items-center justify-center text-foreground/75 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30`}
          aria-label={`Decrease ${ariaLabel}`}
        >
          <Minus className={iconSize} />
        </button>

        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          value={isOutOfStock ? '0' : buffer}
          disabled={isOutOfStock}
          onFocus={(e) => {
            if (!isOutOfStock) {
              e.target.select()
            }
          }}
          onChange={(e) => {
            if (isOutOfStock) return
            // Filter out non-numeric characters while typing
            const val = e.target.value.replace(/[^0-9]/g, '')

            if (!val) {
              setBuffer('')
              return
            }

            const parsed = parseInt(val, 10)
            if (Number.isNaN(parsed)) {
              setBuffer('')
              return
            }

            // Real-time hard ceiling: Never allow typing higher than available stock!
            if (parsed > max) {
              setBuffer(String(max))
              onChange(max)
              triggerMaxNotice()
              return
            }

            setBuffer(val)
            if (parsed >= effectiveMin) {
              onChange(parsed)
            }
          }}
          onPaste={(e) => {
            if (isOutOfStock) return
            e.preventDefault()
            const pastedText = e.clipboardData.getData('text').replace(/[^0-9]/g, '')
            if (!pastedText) return
            const parsed = parseInt(pastedText, 10)
            if (!Number.isNaN(parsed)) {
              if (parsed > max) {
                setBuffer(String(max))
                onChange(max)
                triggerMaxNotice()
              } else {
                const clamped = Math.max(effectiveMin, parsed)
                setBuffer(String(clamped))
                onChange(clamped)
              }
            }
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              commit(buffer)
              ;(e.target as HTMLInputElement).blur()
            } else if (e.key === 'ArrowUp') {
              e.preventDefault()
              handleIncrease()
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              handleDecrease()
            }
          }}
          className={`${inputWidth} text-center font-semibold text-foreground bg-transparent border-0 focus:outline-none focus:ring-2 focus:ring-primary rounded-lg py-1`}
          aria-label={ariaLabel}
        />

        <button
          type="button"
          onClick={handleIncrease}
          disabled={isOutOfStock || effectiveValue >= max}
          className={`inline-flex ${buttonSize} items-center justify-center text-foreground/75 transition hover:bg-muted disabled:cursor-not-allowed disabled:opacity-30`}
          aria-label={`Increase ${ariaLabel}`}
        >
          <Plus className={iconSize} />
        </button>
      </div>

      {showMaxNotice && (
        <span className="text-[11px] font-medium text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800 animate-in fade-in duration-200">
          Max {max} available
        </span>
      )}
    </div>
  )
}
