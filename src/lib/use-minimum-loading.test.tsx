import { StrictMode } from 'react'
import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useMinimumLoading } from './use-minimum-loading'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('minimum initial loading time', () => {
  it('keeps fast loads visible for two seconds, including in Strict Mode', () => {
    const { result, rerender } = renderHook(({ pending }) => useMinimumLoading(pending), {
      initialProps: { pending: true },
      wrapper: StrictMode,
    })
    act(() => vi.advanceTimersByTime(100))
    rerender({ pending: false })
    act(() => vi.advanceTimersByTime(1899))
    expect(result.current).toBe(true)
    act(() => vi.advanceTimersByTime(1))
    expect(result.current).toBe(false)
  })

  it('waits for slow content and reveals it immediately when ready', () => {
    const { result, rerender } = renderHook(({ pending }) => useMinimumLoading(pending), { initialProps: { pending: true } })
    act(() => vi.advanceTimersByTime(3000))
    expect(result.current).toBe(true)
    rerender({ pending: false })
    expect(result.current).toBe(false)
  })

  it('shows cached content immediately and applies the minimum to a new pending request', () => {
    const { result, rerender } = renderHook(({ pending }) => useMinimumLoading(pending), { initialProps: { pending: false } })
    expect(result.current).toBe(false)
    rerender({ pending: true })
    rerender({ pending: false })
    expect(result.current).toBe(true)
    act(() => vi.advanceTimersByTime(2000))
    expect(result.current).toBe(false)
  })

  it('cleans up its timer when navigating away', () => {
    const { unmount } = renderHook(() => useMinimumLoading(true))
    unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
