import { clamp } from './map-gestures'
import { easeTo } from './hospital-orbit'

export type FloorAnchor = { x: number; y: number; visible: boolean; opacity: number }
export type FloorPanel = { id: number; x: number; y: number; width: number; height: number; left: boolean; scale: number; tilt: number; opacity: number }
export const leftFloorIds = [6, 5, 3]

export function stepFloorPanels(current: FloorPanel[], target: FloorPanel[], delta: number): FloorPanel[] {
  return target.map(panel => {
    const previous = current.find(item => item.id === panel.id)
    return previous ? { ...panel, x: easeTo(previous.x, panel.x, delta, 0.1), y: easeTo(previous.y, panel.y, delta, 0.1) } : panel
  })
}

// Same projected-anchor layout as the website, with room for seven touch
// targets in the phone viewport. Side hysteresis prevents center-line jitter.
export function layoutFloorPanels(anchors: Record<number, FloorAnchor>, width: number, height: number, previous: FloorPanel[] = []): FloorPanel[] {
  if (width <= 0 || height <= 0) return []
  const panelWidth = width < 350 ? 66 : 72
  const panelHeight = 40
  const edge = 6
  const gap = 8
  const center = width / 2
  const threshold = Math.min(30, width * 0.06)
  const panels = Array.from({ length: 7 }, (_, index) => {
    const id = index + 1
    const preferredLeft = leftFloorIds.includes(id)
    const anchor = anchors[id] ?? { x: center + (preferredLeft ? -50 : 50), y: 65 + (7 - id) * 36, opacity: 1, visible: true }
    let left = previous.find(panel => panel.id === id)?.left ?? (Math.abs(anchor.x - center) < threshold * 2 ? preferredLeft : anchor.x < center)
    if (left && anchor.x > center + threshold) left = false
    else if (!left && anchor.x < center - threshold) left = true
    return {
      id, left, width: panelWidth, height: panelHeight,
      x: clamp(left ? anchor.x - panelWidth - 14 : anchor.x + 14, edge, Math.max(edge, width - panelWidth - edge)),
      y: anchor.y - panelHeight / 2,
      scale: 0.9 + anchor.opacity * 0.1,
      tilt: (left ? 1 : -1) * (7 + Math.abs(clamp((anchor.x - center) / center, -1, 1)) * 4),
      opacity: anchor.visible ? anchor.opacity : 0.58,
    }
  })
  for (const left of [true, false]) {
    const group = panels.filter(panel => panel.left === left).sort((a, b) => a.y - b.y || b.id - a.id)
    let cursor = edge
    for (const panel of group) { panel.y = Math.max(cursor, panel.y); cursor = panel.y + panelHeight + gap }
    const overflow = Math.max(0, cursor - gap - (height - edge))
    for (const panel of group) panel.y -= overflow
    for (let i = group.length - 2; i >= 0; i--) group[i].y = Math.min(group[i].y, group[i + 1].y - panelHeight - gap)
    const underflow = Math.max(0, edge - (group[0]?.y ?? edge))
    for (const panel of group) panel.y += underflow
  }
  return panels
}
