import { createContext, useContext, useEffect, useId, useRef, useState, type ButtonHTMLAttributes, type HTMLAttributes, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { clsx } from 'clsx'
import './alert-dialog.css'

type AlertDialogContextValue = {
  open: boolean
  setOpen: (open: boolean) => void
  titleId: string
  descriptionId: string
}

const AlertDialogContext = createContext<AlertDialogContextValue | null>(null)

function useAlertDialog() {
  const context = useContext(AlertDialogContext)
  if (!context) throw new Error('Alert dialog components must be placed inside AlertDialog.')
  return context
}

export function AlertDialog({ open: controlledOpen, defaultOpen = false, onOpenChange, children }: { open?: boolean; defaultOpen?: boolean; onOpenChange?: (open: boolean) => void; children: ReactNode }) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen)
  const open = controlledOpen ?? uncontrolledOpen
  const titleId = useId()
  const descriptionId = useId()
  const setOpen = (nextOpen: boolean) => {
    if (controlledOpen === undefined) setUncontrolledOpen(nextOpen)
    onOpenChange?.(nextOpen)
  }

  return <AlertDialogContext.Provider value={{ open, setOpen, titleId, descriptionId }}>{children}</AlertDialogContext.Provider>
}

export function AlertDialogTrigger({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useAlertDialog()
  return <button type="button" {...props} onClick={event => { props.onClick?.(event); if (!event.defaultPrevented) setOpen(true) }}>{children}</button>
}

export function AlertDialogContent({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  const { open, setOpen, titleId, descriptionId } = useAlertDialog()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const dialog = dialogRef.current
    const focusable = dialog?.querySelector<HTMLElement>('button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
    focusable?.focus()

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        return
      }
      if (event.key !== 'Tab' || !dialog) return
      const elements = Array.from(dialog.querySelectorAll<HTMLElement>('button:not(:disabled), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      if (!elements.length) return
      const first = elements[0]
      const last = elements[elements.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.body.style.overflow = previousOverflow
      previouslyFocused?.focus()
    }
  }, [open, setOpen])

  if (!open) return null
  return createPortal(
    <div className="alert-dialog-overlay">
      <div ref={dialogRef} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={descriptionId} className={clsx('alert-dialog-content', className)} {...props}>{children}</div>
    </div>,
    document.body,
  )
}

export function AlertDialogHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('alert-dialog-header', className)} {...props} />
}

export function AlertDialogTitle({ className, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  const { titleId } = useAlertDialog()
  return <h2 id={titleId} className={clsx('alert-dialog-title', className)} {...props} />
}

export function AlertDialogDescription({ className, ...props }: HTMLAttributes<HTMLParagraphElement>) {
  const { descriptionId } = useAlertDialog()
  return <p id={descriptionId} className={clsx('alert-dialog-description', className)} {...props} />
}

export function AlertDialogFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={clsx('alert-dialog-footer', className)} {...props} />
}

export function AlertDialogCancel({ className, children = 'Cancel', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useAlertDialog()
  return <button type="button" className={clsx('alert-dialog-cancel', className)} {...props} onClick={event => { props.onClick?.(event); if (!event.defaultPrevented) setOpen(false) }}>{children}</button>
}

export function AlertDialogAction({ className, children = 'Continue', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  const { setOpen } = useAlertDialog()
  return <button type="button" className={clsx('alert-dialog-action', className)} {...props} onClick={event => { props.onClick?.(event); if (!event.defaultPrevented) setOpen(false) }}>{children}</button>
}
