// Bound backend requests, including token renewal, on unreliable mobile networks.
// Preserve caller cancellation so abandoned requests do not continue in the background.
export const fetchWithTimeout: typeof fetch = async (input, init) => {
  const controller = new AbortController()
  const signal = init?.signal ?? (typeof Request !== 'undefined' && input instanceof Request ? input.signal : undefined)
  const abort = () => controller.abort()
  if (signal?.aborted) abort()
  else signal?.addEventListener('abort', abort, { once: true })
  const timer = setTimeout(abort, 15_000)
  try { return await fetch(input, { ...init, signal: controller.signal }) }
  finally { clearTimeout(timer); signal?.removeEventListener('abort', abort) }
}
