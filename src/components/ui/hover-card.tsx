import * as HoverCardPrimitive from '@radix-ui/react-hover-card'
import type { ComponentProps } from 'react'
import { cn } from '@/lib/utils'

export function HoverCard(props: ComponentProps<typeof HoverCardPrimitive.Root>) {
  return <HoverCardPrimitive.Root data-slot="hover-card" {...props} />
}

export function HoverCardTrigger(props: ComponentProps<typeof HoverCardPrimitive.Trigger>) {
  return <HoverCardPrimitive.Trigger data-slot="hover-card-trigger" {...props} />
}

export function HoverCardContent({ className, align = 'center', sideOffset = 10, ...props }: ComponentProps<typeof HoverCardPrimitive.Content>) {
  return <HoverCardPrimitive.Portal>
    <HoverCardPrimitive.Content
      data-slot="hover-card-content"
      align={align}
      sideOffset={sideOffset}
      className={cn('floor-hover-card-content', className)}
      {...props}
    />
  </HoverCardPrimitive.Portal>
}

