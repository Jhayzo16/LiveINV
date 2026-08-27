import { useRef, type CSSProperties, type MouseEvent, type PointerEvent } from 'react'
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card'
import floorPanelBuildingIcon from '@/assets/floor-panel-building.png'
import type { HospitalFloorModel } from './topology-types'

export type PanelPlacement = {
  x: number
  y: number
  width: number
  height: number
  side: 'left' | 'right'
  scale: number
  tilt: number
}

type FloorTopologyPanelProps = {
  floor: HospitalFloorModel
  placement: PanelPlacement
  selected: boolean
  hovered: boolean
  opacity: number
  onSelect: (floorId: number) => void
  onHover: (floorId: number, isHovering: boolean) => void
  onExplore: (floorId: number) => void
  onRotate: (deltaX: number) => void
}

export function FloorTopologyPanel({ floor, placement, selected, hovered, opacity, onSelect, onHover, onExplore, onRotate }: FloorTopologyPanelProps) {
  const dragState = useRef({ active: false, startX: 0, lastX: 0, moved: false })
  const maintenance = floor.maintenanceAssets ?? Math.max(1, Math.round(floor.assets * 0.08))
  const broken = floor.brokenAssets ?? Math.max(1, Math.round(floor.assets * 0.03))
  const active = floor.activeAssets ?? Math.max(0, floor.assets - maintenance - broken)
  const style = {
    '--panel-x': `${placement.x}px`,
    '--panel-y': `${placement.y}px`,
    '--panel-opacity': opacity,
    '--panel-scale': placement.scale,
    '--panel-tilt': `${placement.tilt}deg`,
    width: placement.width,
  } as CSSProperties

  const stopPointer = (event: MouseEvent<HTMLElement>) => event.stopPropagation()

  const handlePointerDown = (event: PointerEvent<HTMLElement>) => {
    event.stopPropagation()
    dragState.current = { active: true, startX: event.clientX, lastX: event.clientX, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const handlePointerMove = (event: PointerEvent<HTMLElement>) => {
    if (!dragState.current.active) return
    const deltaX = event.clientX - dragState.current.lastX
    dragState.current.lastX = event.clientX
    if (Math.abs(event.clientX - dragState.current.startX) > 3) dragState.current.moved = true
    if (dragState.current.moved && deltaX) onRotate(deltaX)
  }

  const handlePointerUp = (event: PointerEvent<HTMLElement>) => {
    dragState.current.active = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return <HoverCard open={hovered} openDelay={10} closeDelay={100}>
    <HoverCardTrigger asChild>
      <article
        className={`floor-topology-panel ${selected ? 'is-selected' : ''} ${hovered ? 'is-hovered' : ''}`}
        style={style}
        onPointerEnter={() => onHover(floor.id, true)}
        onPointerLeave={() => onHover(floor.id, false)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        onMouseDown={stopPointer}
      >
        <button
          type="button"
          className="floor-panel-main"
          aria-label={`Select Floor ${floor.id}, ${floor.rooms} rooms, ${floor.assets} assets`}
          aria-pressed={selected}
          onClick={event => {
            event.stopPropagation()
            if (dragState.current.moved) { dragState.current.moved = false; return }
            onSelect(floor.id)
          }}
          onDoubleClick={event => { event.stopPropagation(); onExplore(floor.id) }}
        >
          <span className="floor-panel-icon" aria-hidden="true"><img src={floorPanelBuildingIcon} alt="" /></span>
          <span className="floor-panel-copy"><strong>Floor {floor.id}</strong></span>
        </button>
      </article>
    </HoverCardTrigger>
    <HoverCardContent
      side={placement.side === 'left' ? 'right' : 'left'}
      align="center"
      sideOffset={10}
      onPointerEnter={() => onHover(floor.id, true)}
      onPointerLeave={() => onHover(floor.id, false)}
      onPointerDown={event => event.stopPropagation()}
    >
      <div className="floor-hover-card-heading">
        <span className="floor-panel-icon" aria-hidden="true"><img src={floorPanelBuildingIcon} alt="" /></span>
        <span className="floor-panel-copy"><strong>Floor {floor.id}</strong><span><b>{floor.rooms}</b> Rooms <i /> <b>{floor.assets}</b> Assets</span></span>
      </div>
      <div className="floor-hover-card-statuses">
        <span className="floor-panel-status"><i className="active" />{active} Active</span>
        <span className="floor-panel-status"><i className="maintenance" />{maintenance} Maintenance</span>
        <span className="floor-panel-status"><i className="broken" />{broken} Broken</span>
      </div>
      <ExploreFloorButton floorId={floor.id} onExplore={onExplore} />
    </HoverCardContent>
  </HoverCard>
}

function ExploreFloorButton({ floorId, onExplore }: { floorId: number; onExplore: (floorId: number) => void }) {
  return <button
    type="button"
    className="floor-panel-explore"
    aria-label={`Explore Floor ${floorId}`}
    onPointerDown={event => event.stopPropagation()}
    onClick={event => { event.stopPropagation(); onExplore(floorId) }}
  >Explore Floor →</button>
}
