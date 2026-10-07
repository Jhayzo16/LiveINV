export type Point = { x: number; y: number }
export type MapView = { zoom: number; x: number; y: number }
export const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value))
export const TAP_SLOP = 8
export const MAX_MAP_ZOOM = 8
export const withinTapSlop = (from: Point, to: Point) => Math.hypot(to.x - from.x, to.y - from.y) <= TAP_SLOP

export type MapBox = { x: number; y: number; width: number; height: number }
export function visibleMapBox(view: MapView, viewport: { width: number; height: number }, map: MapBox): MapBox {
  const scale = Math.min(viewport.width / map.width, viewport.height / map.height) * view.zoom
  return { x: map.x + map.width / 2 - (viewport.width / 2 + view.x) / scale,
    y: map.y + map.height / 2 - (viewport.height / 2 + view.y) / scale,
    width: viewport.width / scale, height: viewport.height / scale }
}
export function roomAtPoint<T extends MapBox & { id: string }>(rooms: T[], point: Point, unitsPerPixel: number): T | undefined {
  const distance = (room: T) => Math.hypot(Math.max(room.x - point.x, 0, point.x - room.x - room.width), Math.max(room.y - point.y, 0, point.y - room.y - room.height))
  // Exact hits always win. For overlapping shapes, prefer the smaller room.
  const exact = rooms.filter(room => distance(room) === 0).sort((a, b) => a.width * a.height - b.width * b.height)
  if (exact.length) return exact[0]
  // A small screen-space margin helps narrow rooms without selecting distant
  // rooms across corridors. Equal-distance ties are stable across renders.
  return rooms.map(room => ({ room, distance: distance(room) })).filter(hit => hit.distance <= unitsPerPixel * 8)
    .sort((a, b) => a.distance - b.distance || a.room.id.localeCompare(b.room.id))[0]?.room
}

export function constrainMap(view: MapView, width: number, height: number, contentWidth: number, contentHeight: number): MapView {
  const zoom = clamp(view.zoom, 1, MAX_MAP_ZOOM)
  const limitX = Math.max(0, (contentWidth * zoom - width) / 2)
  const limitY = Math.max(0, (contentHeight * zoom - height) / 2)
  return { zoom, x: limitX ? clamp(view.x, -limitX, limitX) : 0, y: limitY ? clamp(view.y, -limitY, limitY) : 0 }
}

// Points are relative to the viewport's center. Preserve the map point under
// the fingers as their midpoint moves, including at the zoom limits.
export function pinchMap(view: MapView, scale: number, from: Point, to: Point): MapView {
  const zoom = clamp(view.zoom * scale, 1, MAX_MAP_ZOOM)
  const ratio = zoom / view.zoom
  return { zoom, x: to.x - (from.x - view.x) * ratio, y: to.y - (from.y - view.y) * ratio }
}

export type TouchSample = { id: string | number; x: number; y: number }
export function touchDelta(previous: TouchSample[], next: TouchSample[]) {
  // Rebase when a finger is added, removed or replaced. Never interpret that
  // transition as movement or a pinch; doing so makes the map jump.
  if (previous.length !== next.length || !next.length || next.some(t => !previous.some(p => p.id === t.id))) return null
  const before = next.map(t => previous.find(p => p.id === t.id)!)
  if (next.length === 1) return { kind: 'pan' as const, x: next[0].x - before[0].x, y: next[0].y - before[0].y }
  const distance = (points: TouchSample[]) => Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)
  const middle = (points: TouchSample[]): Point => ({ x: (points[0].x + points[1].x) / 2, y: (points[0].y + points[1].y) / 2 })
  const separation = distance(before)
  return separation < 2 ? null : { kind: 'pinch' as const, scale: distance(next) / separation, from: middle(before), to: middle(next) }
}
