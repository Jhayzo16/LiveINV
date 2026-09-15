import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'
import './loading-state.css'

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'default' | 'outline'
  size?: 'default' | 'icon'
}

export function Button({ className, variant = 'default', size = 'default', type = 'button', ...props }: ButtonProps) {
  return <button type={type} data-slot="button" className={cn('ui-button', `ui-button-${variant}`, size === 'icon' && 'ui-button-icon', className)} {...props} />
}
