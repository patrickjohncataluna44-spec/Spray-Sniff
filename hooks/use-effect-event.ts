'use client'

import * as React from 'react'

/**
 * Polyfill for the experimental React.useEffectEvent hook.
 * Returns a stable function that always sees the latest props/state.
 */
export function useEffectEvent<T extends (...args: any[]) => any>(callback: T): T {
  const ref = React.useRef<T>(callback)

  // Update the ref whenever the callback changes (on every render)
  React.useLayoutEffect(() => {
    ref.current = callback
  })

  // Return a stable function that calls the current ref
  return React.useCallback((...args: any[]) => {
    const fn = ref.current
    return fn(...args)
  }, []) as T
}
