import type { ComponentProps } from 'react'
import { Popover as PopoverPrimitive } from '@base-ui/react/popover'
import { cn } from '@/lib/utils'
import './date-picker.css'

export const Popover = PopoverPrimitive.Root
export const PopoverTrigger = PopoverPrimitive.Trigger

type PopoverContentProps = ComponentProps<typeof PopoverPrimitive.Popup> & {
  align?: 'start' | 'center' | 'end'
}

export function PopoverContent({ align = 'center', className, ...props }: PopoverContentProps) {
  return <PopoverPrimitive.Portal>
    <PopoverPrimitive.Positioner className="ui-popover-positioner" align={align} sideOffset={6} collisionPadding={8}>
      <PopoverPrimitive.Popup className={cn('ui-popover-content', className)} {...props} />
    </PopoverPrimitive.Positioner>
  </PopoverPrimitive.Portal>
}
