import { useEffect, useRef, useState } from 'react'

export const MINIMUM_LOADING_MS = 1000

/** Keep an initial loading indicator visible without delaying the request itself. */
export function useMinimumLoading(pending: boolean) {
  const [holding, setHolding] = useState(pending)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  useEffect(() => {
    if (!pending) return
    setHolding(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(() => setHolding(false), MINIMUM_LOADING_MS)
  }, [pending])

  useEffect(() => () => clearTimeout(timer.current), [])

  return pending || holding
}
