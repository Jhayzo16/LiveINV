import { afterEach, expect, it, vi } from 'vitest'
import { fetchWithTimeout } from '../src/network'

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals() })
function pendingFetch() {
  return vi.fn<typeof fetch>((_, init) => new Promise((_, reject) => {
    if (init?.signal?.aborted) reject(new Error('aborted'))
    else init?.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
  }))
}
it('cancels a stalled request after fifteen seconds', async () => {
  vi.useFakeTimers(); vi.stubGlobal('fetch', pendingFetch())
  const result = expect(fetchWithTimeout('https://example.test')).rejects.toThrow('aborted')
  await vi.advanceTimersByTimeAsync(15_000)
  await result
  expect(vi.getTimerCount()).toBe(0)
})
it('preserves caller cancellation', async () => {
  vi.useFakeTimers(); vi.stubGlobal('fetch', pendingFetch())
  const controller = new AbortController()
  const result = expect(fetchWithTimeout('https://example.test', { signal: controller.signal })).rejects.toThrow('aborted')
  controller.abort(); await result
  expect(vi.getTimerCount()).toBe(0)
})
it('returns successful responses and clears the timer', async () => {
  vi.useFakeTimers(); const response = new Response('ok')
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response))
  expect(await fetchWithTimeout('https://example.test')).toBe(response)
  expect(vi.getTimerCount()).toBe(0)
})
