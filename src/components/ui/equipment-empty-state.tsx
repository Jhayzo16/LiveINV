import type { ReactNode } from 'react'
import { clsx } from 'clsx'
import type { DeviceCategory } from '../../lib/types'
import keyboardRoomIcon from '../../assets/room-icons/keyboard.png'
import monitorRoomIcon from '../../assets/room-icons/monitor.png'
import printerRoomIcon from '../../assets/room-icons/printer.png'
import routerRoomIcon from '../../assets/room-icons/router.png'
import scannerRoomIcon from '../../assets/room-icons/scanner.png'
import systemUnitRoomIcon from '../../assets/room-icons/system-unit.png'
import upsRoomIcon from '../../assets/room-icons/ups.png'
import { Empty, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from './empty'

export type EquipmentKind = DeviceCategory | 'Other'

const equipmentIconImages: Partial<Record<EquipmentKind, string>> = {
  'System Unit': systemUnitRoomIcon,
  Printer: printerRoomIcon,
  Monitor: monitorRoomIcon,
  Keyboard: keyboardRoomIcon,
  UPS: upsRoomIcon,
  Scanner: scannerRoomIcon,
  Router: routerRoomIcon,
}

export function EquipmentIcon({ kind }: { kind: EquipmentKind }) {
  const source = equipmentIconImages[kind]
  return source
    ? <img src={source} alt="" aria-hidden="true" />
    : <span aria-hidden="true">◆</span>
}

export function EquipmentEmptyState({
  title,
  description,
  kind = 'System Unit',
  size = 'default',
  className,
}: {
  title: ReactNode
  description?: ReactNode
  kind?: EquipmentKind
  size?: 'default' | 'compact' | 'inline'
  className?: string
}) {
  return <Empty className={clsx(`empty-state-${size}`, className)} role="status">
    <EmptyHeader>
      <EmptyMedia variant="icon"><EquipmentIcon kind={kind} /></EmptyMedia>
      <EmptyTitle>{title}</EmptyTitle>
      {description && <EmptyDescription>{description}</EmptyDescription>}
    </EmptyHeader>
  </Empty>
}
