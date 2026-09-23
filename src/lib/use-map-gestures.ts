import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'

type Point = { x: number; y: number }
type View = { zoom: number; pan: Point }
const initialView = (): View => ({ zoom: 1, pan: { x: 0, y: 0 } })
const clampZoom = (zoom: number) => Math.max(.2, Math.min(4, zoom))
const midpoint = (a: Point, b: Point): Point => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 })
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)

export function useMapGestures() {
  const viewportRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState(initialView)
  const viewRef = useRef(view)
  const pointers = useRef(new Map<number, Point>())
  const moved = useRef(false)
  const [isDragging, setIsDragging] = useState(false)

  const update = (next: View) => {
    viewRef.current = next
    setView(next)
  }

  // Use the canvas's actual center: oversized plans need not be centered in the viewport.
  const zoomAt = (zoom: number, from: Point, to = from) => {
    const current = viewRef.current
    const canvas = canvasRef.current
    const viewport = viewportRef.current
    if (!canvas || !viewport) return
    const rect = viewport.getBoundingClientRect()
    // Layout offsets remain stable when two pointer moves arrive before React paints.
    const origin = { x: rect.left + viewport.clientLeft + canvas.offsetLeft + canvas.offsetWidth / 2 - viewport.scrollLeft,
      y: rect.top + viewport.clientTop + canvas.offsetTop + canvas.offsetHeight / 2 - viewport.scrollTop }
    const nextZoom = clampZoom(zoom)
    const ratio = nextZoom / current.zoom
    update({ zoom: nextZoom, pan: {
      x: to.x - origin.x - (from.x - origin.x - current.pan.x) * ratio,
      y: to.y - origin.y - (from.y - origin.y - current.pan.y) * ratio,
    } })
  }

  useEffect(() => {
    const viewport = viewportRef.current
    if (!viewport) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      if (pointers.current.size) moved.current = true
      const delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? viewport.clientHeight : 1)
      zoomAt(viewRef.current.zoom * Math.exp(-Math.max(-500, Math.min(500, delta)) * .002), { x: event.clientX, y: event.clientY })
    }
    // React wheel listeners are passive; this local listener keeps the page still while zooming.
    viewport.addEventListener('wheel', wheel, { passive: false })
    return () => viewport.removeEventListener('wheel', wheel)
  }, [])

  const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 && event.button !== 1) return false
    if (!pointers.current.size) moved.current = false
    else moved.current = true
    pointers.current.set(event.pointerId, { x: event.clientX, y: event.clientY })
    event.currentTarget.setPointerCapture(event.pointerId)
    setIsDragging(true)
    return true
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return
    const next = { x: event.clientX, y: event.clientY }
    const before = [...pointers.current.values()]
    if (before.length === 1) {
      if (!moved.current && distance(previous, next) <= 4) return
      moved.current = true
      const current = viewRef.current
      update({ ...current, pan: { x: current.pan.x + next.x - previous.x, y: current.pan.y + next.y - previous.y } })
      pointers.current.set(event.pointerId, next)
    } else {
      pointers.current.set(event.pointerId, next)
      const after = [...pointers.current.values()]
      const previousDistance = distance(before[0], before[1])
      if (previousDistance > 0) zoomAt(viewRef.current.zoom * distance(after[0], after[1]) / previousDistance, midpoint(before[0], before[1]), midpoint(after[0], after[1]))
    }
  }

  const finishPointer = (event: ReactPointerEvent<HTMLDivElement>, cancelled = false) => {
    const previous = pointers.current.get(event.pointerId)
    if (!previous) return false
    const tapped = !cancelled && !moved.current && pointers.current.size === 1 && event.button === 0
      && distance(previous, { x: event.clientX, y: event.clientY }) <= 4
    if (cancelled) moved.current = true
    pointers.current.delete(event.pointerId)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setIsDragging(pointers.current.size > 0)
    return tapped
  }

  const zoomBy = (delta: number) => {
    const rect = viewportRef.current?.getBoundingClientRect()
    if (rect) zoomAt(viewRef.current.zoom + delta, { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 })
  }

  return { ...view, viewportRef, canvasRef, isDragging, isInteracting: () => pointers.current.size > 0,
    onPointerDown, onPointerMove, finishPointer, zoomBy, reset: () => update(initialView()) }
}
