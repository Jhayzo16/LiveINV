import { Button } from './button'
import { Spinner } from './spinner'
import { cn } from '@/lib/utils'

export function LoadingState({ label = 'Loading…', className }: { label?: string; className?: string }) {
  return <div className={cn('loading-state', className)} role="status" aria-live="polite" aria-label={label}>
    <Button variant="outline" disabled><Spinner data-icon="inline-start" />{label}</Button>
  </div>
}
