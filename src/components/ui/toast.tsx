import { useEffect, useState } from 'react'

type ToastState = 'loading' | 'success' | 'error'
type ToastItem = { id: number; message: string; state: ToastState }
type PromiseMessages<T> = {
  loading: string
  success: string | ((data: T) => string)
  error: string | ((error: unknown) => string)
}

let toastItems: ToastItem[] = []
let toastId = 0
const subscribers = new Set<(items: ToastItem[]) => void>()

const publish = () => subscribers.forEach(listener => listener([...toastItems]))
const dismiss = (id: number) => {
  toastItems = toastItems.filter(item => item.id !== id)
  publish()
}

const update = (id: number, state: ToastState, message: string) => {
  toastItems = toastItems.map(item => item.id === id ? { ...item, state, message } : item)
  publish()
  window.setTimeout(() => dismiss(id), 4200)
}

export const toast = {
  promise<T>(promise: Promise<T>, messages: PromiseMessages<T>) {
    const id = ++toastId
    toastItems = [...toastItems, { id, message: messages.loading, state: 'loading' }]
    publish()

    return promise.then(data => {
      update(id, 'success', typeof messages.success === 'function' ? messages.success(data) : messages.success)
      return data
    }).catch(error => {
      update(id, 'error', typeof messages.error === 'function' ? messages.error(error) : messages.error)
      throw error
    })
  },
  dismiss,
}

export function Toaster() {
  const [items, setItems] = useState<ToastItem[]>(toastItems)

  useEffect(() => {
    subscribers.add(setItems)
    return () => { subscribers.delete(setItems) }
  }, [])

  return <div className="toast-viewport" aria-live="polite" aria-label="Notifications">
    {items.map(item => <div className={`promise-toast ${item.state}`} role="status" key={item.id}>
      <span className="promise-toast-icon" aria-hidden="true">{item.state === 'loading' ? <i /> : item.state === 'success' ? '✓' : '!'}</span>
      <div><b>{item.state === 'loading' ? 'Please wait' : item.state === 'success' ? 'Device saved' : 'Registration failed'}</b><p>{item.message}</p></div>
      {item.state !== 'loading' && <button type="button" onClick={() => dismiss(item.id)} aria-label="Dismiss notification">×</button>}
    </div>)}
  </div>
}
