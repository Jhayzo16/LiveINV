import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { FloorAnchorStore } from './floor-anchor-store'
import { FloorTopologyPanel, type PanelPlacement } from './FloorTopologyPanel'
import type { FloorScreenAnchor, HospitalFloorModel } from './topology-types'

type FloorTopologyOverlayProps = {
  floors: HospitalFloorModel[]
  anchorStore: FloorAnchorStore
  selectedFloorId: number | null
  hoveredFloorId: number | null
  resetToken: number
  onSelect: (floorId: number) => void
  onHover: (floorId: number, isHovering: boolean) => void
  onExplore: (floorId: number) => void
  onRotate: (deltaX: number) => void
}

type StageSize = { width: number; height: number }

export function FloorTopologyOverlay(props: FloorTopologyOverlayProps) {
  const { floors, anchorStore, selectedFloorId, hoveredFloorId, resetToken, onSelect, onHover, onExplore, onRotate } = props
  const anchors = useSyncExternalStore(anchorStore.subscribe, anchorStore.getSnapshot, anchorStore.getSnapshot)
  const overlayRef = useRef<HTMLDivElement>(null)
  const sideMemory = useRef<Record<number, 'left' | 'right'>>({})
  const [size, setSize] = useState<StageSize>({ width: 0, height: 0 })

  useEffect(() => {
    const element = overlayRef.current
    if (!element) return
    const observer = new ResizeObserver(entries => {
      const rect = entries[0]?.contentRect
      if (rect) setSize({ width: rect.width, height: rect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

  useEffect(() => { sideMemory.current = {} }, [resetToken])

  const placements = useMemo(() => calculatePanelLayout(
    floors,
    anchors,
    size,
    sideMemory.current,
  ), [anchors, floors, size])

  const compact = size.width > 0 && size.width < 690
  const selected = selectedFloorId === null ? null : floors.find(floor => floor.id === selectedFloorId) ?? null

  return <div ref={overlayRef} className="floor-topology-overlay">
    {!compact && <>
      <svg className="topology-connectors" width="100%" height="100%" aria-hidden="true">
        {floors.map(floor => {
          const anchor = anchors[floor.id]
          const panel = placements[floor.id]
          if (!anchor?.visible || !panel) return null
          const active = floor.id === selectedFloorId || floor.id === hoveredFloorId
          const startX = panel.side === 'left' ? panel.x + panel.width : panel.x
          const startY = panel.y + Math.min(panel.height * .48, 48)
          const direction = panel.side === 'left' ? 1 : -1
          const bend = Math.max(24, Math.abs(anchor.x - startX) * .45)
          const path = `M ${startX} ${startY} C ${startX + direction * bend} ${startY}, ${anchor.x - direction * bend * .35} ${anchor.y}, ${anchor.x} ${anchor.y}`
          return <g key={floor.id} className={`floor-connector ${active ? 'is-active' : ''}`} style={{ opacity: anchor.opacity }}>
            <path d={path} />
            {floor.id === selectedFloorId && <circle className="connector-ring" cx={anchor.x} cy={anchor.y} r="8" />}
            <circle className="connector-dot" cx={anchor.x} cy={anchor.y} r={active ? 4.5 : 3.5} />
          </g>
        })}
      </svg>
      <div className="floor-panel-layer">
        {floors.map(floor => {
          const placement = placements[floor.id]
          const anchor = anchors[floor.id]
          if (!placement || !anchor?.visible) return null
          return <FloorTopologyPanel
            key={floor.id}
            floor={floor}
            placement={placement}
            selected={floor.id === selectedFloorId}
            hovered={floor.id === hoveredFloorId}
            opacity={anchor.opacity}
            onSelect={onSelect}
            onHover={onHover}
            onExplore={onExplore}
            onRotate={onRotate}
          />
        })}
      </div>
    </>}
    {compact && <div className="mobile-floor-overlay">
      {selected ? <div className="mobile-selected-floor">
        <span>Selected floor</span><strong>Floor {selected.id}</strong>
        <p>{selected.rooms} rooms · {selected.assets} assets</p>
        <button type="button" onClick={() => onExplore(selected.id)}>Explore →</button>
      </div> : <div className="mobile-selected-floor is-empty">
        <span>No floor selected</span><strong>Select a floor</strong>
        <p>Tap a floor number or choose it from the building.</p>
      </div>}
      <div className="mobile-floor-selector" aria-label="Hospital floor selector">
        {[...floors].reverse().map(floor => <button
          type="button"
          key={floor.id}
          className={floor.id === selectedFloorId ? 'selected' : ''}
          aria-pressed={floor.id === selectedFloorId}
          onClick={() => onSelect(floor.id)}
        >{floor.id}</button>)}
      </div>
    </div>}
  </div>
}

function calculatePanelLayout(
  floors: HospitalFloorModel[],
  anchors: Record<number, FloorScreenAnchor>,
  size: StageSize,
  sideMemory: Record<number, 'left' | 'right'>,
) {
  const result: Record<number, PanelPlacement> = {}
  if (!size.width || !size.height) return result
  const center = size.width / 2
  const threshold = Math.min(80, size.width * .08)
  const narrow = size.width < 960
  const compactWidth = narrow ? 128 : 138
  const topBoundary = narrow ? 155 : 170
  const bottomBoundary = size.height - 66
  const edge = narrow ? 12 : 22
  const gap = narrow ? 9 : 12
  const bySide: Record<'left' | 'right', Array<{ floor: HospitalFloorModel; anchor: FloorScreenAnchor; placement: PanelPlacement }>> = { left: [], right: [] }

  floors.forEach(floor => {
    const anchor = anchors[floor.id]
    if (!anchor?.visible) return
    const preferredSide = floor.id === 3 || floor.id === 5 || floor.id === 6 ? 'left' : 'right'
    let side = sideMemory[floor.id] ?? (Math.abs(anchor.x - center) < threshold * 2 ? preferredSide : (anchor.x < center ? 'left' : 'right'))
    if (side === 'left' && anchor.x > center + threshold) side = 'right'
    if (side === 'right' && anchor.x < center - threshold) side = 'left'
    sideMemory[floor.id] = side
    const width = compactWidth
    const height = 58
    const orbitGap = narrow ? 26 : 34
    const desiredX = side === 'left' ? anchor.x - width - orbitGap : anchor.x + orbitGap
    const x = MathUtilsClamp(desiredX, edge, size.width - edge - width)
    const scale = .88 + anchor.opacity * .12
    const horizontalProgress = MathUtilsClamp((anchor.x - center) / Math.max(1, center), -1, 1)
    const tilt = (side === 'left' ? 1 : -1) * (7 + Math.abs(horizontalProgress) * 4)
    bySide[side].push({ floor, anchor, placement: { x, y: anchor.y - height / 2, width, height, side, scale, tilt } })
  })

  ;(['left', 'right'] as const).forEach(side => {
    const items = bySide[side].sort((a, b) => a.placement.y - b.placement.y)
    let cursor = topBoundary
    items.forEach(item => {
      item.placement.y = Math.max(cursor, item.placement.y)
      cursor = item.placement.y + item.placement.height + gap
    })
    if (items.length) {
      const overflow = Math.max(0, cursor - gap - bottomBoundary)
      items.forEach(item => { item.placement.y -= overflow })
      for (let index = items.length - 2; index >= 0; index -= 1) {
        const current = items[index]
        const next = items[index + 1]
        current.placement.y = Math.min(current.placement.y, next.placement.y - current.placement.height - gap)
      }
      const underflow = Math.max(0, topBoundary - items[0].placement.y)
      items.forEach(item => { item.placement.y += underflow })
    }
    items.forEach(item => { result[item.floor.id] = item.placement })
  })
  return result
}

function MathUtilsClamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value))
}
