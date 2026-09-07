import type { ComponentProps } from 'react'
import { clsx } from 'clsx'
import './empty.css'

export function Empty({ className, ...props }: ComponentProps<'div'>) {
  return <div className={clsx('empty-state', className)} {...props} />
}

export function EmptyHeader({ className, ...props }: ComponentProps<'div'>) {
  return <div className={clsx('empty-state-header', className)} {...props} />
}

export function EmptyMedia({ className, ...props }: ComponentProps<'div'> & { variant?: 'icon' }) {
  const { variant, ...mediaProps } = props
  return <div className={clsx('empty-state-media', variant && `empty-state-media-${variant}`, className)} {...mediaProps} />
}

export function EmptyTitle({ className, ...props }: ComponentProps<'h3'>) {
  return <h3 className={clsx('empty-state-title', className)} {...props} />
}

export function EmptyDescription({ className, ...props }: ComponentProps<'p'>) {
  return <p className={clsx('empty-state-description', className)} {...props} />
}
