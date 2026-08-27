"use client"

import { useEffect, useRef, useCallback } from "react"
import createGlobe from "cobe"

const EMPTY_MARKERS: GlobeMarker[] = []
const EMPTY_ARCS: GlobeArc[] = []

export interface GlobeMarker {
  id: string
  location: [number, number]
  label: string
}

export interface GlobeArc {
  id: string
  from: [number, number]
  to: [number, number]
  label?: string
}

interface GlobeProps {
  markers?: GlobeMarker[]
  arcs?: GlobeArc[]
  className?: string
  markerColor?: [number, number, number]
  baseColor?: [number, number, number]
  arcColor?: [number, number, number]
  glowColor?: [number, number, number]
  dark?: number
  mapBrightness?: number
  markerSize?: number
  markerElevation?: number
  arcWidth?: number
  arcHeight?: number
  speed?: number
  theta?: number
  diffuse?: number
  mapSamples?: number
  onDrag?: (degrees: number) => void
  onMarkerClick?: (id: string) => void
  onRotationChange?: (rotation: { phi: number; theta: number }) => void
}

export function Globe({
  markers = EMPTY_MARKERS, arcs = EMPTY_ARCS, className = "",
  markerColor = [0.3, 0.45, 0.85], baseColor = [1, 1, 1],
  arcColor = [0.3, 0.45, 0.85], glowColor = [0.94, 0.93, 0.91],
  dark = 0, mapBrightness = 10, markerSize = 0.025,
  markerElevation = 0.01, arcWidth = 0.5, arcHeight = 0.25,
  speed = 0.003, theta = 0.2, diffuse = 1.5, mapSamples = 16000,
  onDrag, onMarkerClick, onRotationChange,
}: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const pointerInteracting = useRef<{ x: number; y: number } | null>(null)
  const lastPointer = useRef<{ x: number; y: number; t: number } | null>(null)
  const dragOffset = useRef({ phi: 0, theta: 0 })
  const velocity = useRef({ phi: 0, theta: 0 })
  const phiOffsetRef = useRef(0)
  const thetaOffsetRef = useRef(0)
  const isPausedRef = useRef(false)
  const onDragRef = useRef(onDrag)
  const onRotationChangeRef = useRef(onRotationChange)
  onDragRef.current = onDrag
  onRotationChangeRef.current = onRotationChange

  const handlePointerDown = useCallback((event: React.PointerEvent) => {
    pointerInteracting.current = { x: event.clientX, y: event.clientY }
    lastPointer.current = { x: event.clientX, y: event.clientY, t: Date.now() }
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing"
    isPausedRef.current = true
  }, [])

  const handlePointerMove = useCallback((event: PointerEvent) => {
    if (pointerInteracting.current === null) return
    const deltaX = event.clientX - pointerInteracting.current.x
    const deltaY = event.clientY - pointerInteracting.current.y
    dragOffset.current = { phi: deltaX / 300, theta: deltaY / 1000 }

    const now = Date.now()
    if (lastPointer.current) {
      onDragRef.current?.((event.clientX - lastPointer.current.x) * 0.36)
      const dt = Math.max(now - lastPointer.current.t, 1)
      const maxVelocity = 0.15
      velocity.current = {
        phi: Math.max(-maxVelocity, Math.min(maxVelocity, ((event.clientX - lastPointer.current.x) / dt) * 0.3)),
        theta: Math.max(-maxVelocity, Math.min(maxVelocity, ((event.clientY - lastPointer.current.y) / dt) * 0.08)),
      }
    }
    lastPointer.current = { x: event.clientX, y: event.clientY, t: now }
  }, [])

  const handlePointerUp = useCallback(() => {
    if (pointerInteracting.current !== null) {
      phiOffsetRef.current += dragOffset.current.phi
      thetaOffsetRef.current += dragOffset.current.theta
      dragOffset.current = { phi: 0, theta: 0 }
      lastPointer.current = null
    }
    pointerInteracting.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = "grab"
    isPausedRef.current = false
  }, [])

  useEffect(() => {
    window.addEventListener("pointermove", handlePointerMove, { passive: true })
    window.addEventListener("pointerup", handlePointerUp, { passive: true })
    return () => {
      window.removeEventListener("pointermove", handlePointerMove)
      window.removeEventListener("pointerup", handlePointerUp)
    }
  }, [handlePointerMove, handlePointerUp])

  useEffect(() => {
    if (!canvasRef.current) return
    const canvas = canvasRef.current
    let globe: ReturnType<typeof createGlobe> | null = null
    let animationId = 0
    let phi = 0
    let resizeObserver: ResizeObserver | null = null

    function init() {
      const width = canvas.offsetWidth
      if (width === 0 || globe) return
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      globe = createGlobe(canvas, {
        devicePixelRatio: dpr, width: width * dpr, height: width * dpr,
        phi: 0, theta, dark, diffuse, mapSamples, mapBrightness,
        baseColor, markerColor, glowColor, markerElevation,
        markers: markers.map(marker => ({ location: marker.location, size: markerSize, id: marker.id })),
        arcs: arcs.map(arc => ({ from: arc.from, to: arc.to, id: arc.id })),
        arcColor, arcWidth, arcHeight, opacity: 1,
      })

      function animate() {
        if (!isPausedRef.current) {
          phi += speed
          if (Math.abs(velocity.current.phi) > 0.0001 || Math.abs(velocity.current.theta) > 0.0001) {
            phiOffsetRef.current += velocity.current.phi
            thetaOffsetRef.current += velocity.current.theta
            velocity.current.phi *= 0.95
            velocity.current.theta *= 0.95
          }
          thetaOffsetRef.current = Math.max(-0.4, Math.min(0.4, thetaOffsetRef.current))
        }
        const renderedPhi = phi + phiOffsetRef.current + dragOffset.current.phi
        const renderedTheta = theta + thetaOffsetRef.current + dragOffset.current.theta
        globe!.update({
          phi: renderedPhi,
          theta: renderedTheta,
          dark, mapBrightness, markerColor, baseColor, arcColor, markerElevation,
          markers: markers.map(marker => ({ location: marker.location, size: markerSize, id: marker.id })),
          arcs: arcs.map(arc => ({ from: arc.from, to: arc.to, id: arc.id })),
        })
        onRotationChangeRef.current?.({ phi: renderedPhi, theta: renderedTheta })
        animationId = requestAnimationFrame(animate)
      }
      animate()
      requestAnimationFrame(() => { canvas.style.opacity = "1" })
    }

    if (canvas.offsetWidth > 0) init()
    else {
      resizeObserver = new ResizeObserver(entries => {
        if (entries[0]?.contentRect.width > 0) { resizeObserver?.disconnect(); init() }
      })
      resizeObserver.observe(canvas)
    }

    return () => {
      resizeObserver?.disconnect()
      if (animationId) cancelAnimationFrame(animationId)
      globe?.destroy()
    }
  }, [markers, arcs, markerColor, baseColor, arcColor, glowColor, dark, mapBrightness, markerSize, markerElevation, arcWidth, arcHeight, speed, theta, diffuse, mapSamples])

  return <div className={`relative aspect-square select-none ${className}`}>
    <canvas ref={canvasRef} onPointerDown={handlePointerDown} style={{ width: "100%", height: "100%", cursor: "grab", opacity: 0, transition: "opacity 1.2s ease", borderRadius: "50%", touchAction: "none" }} />
    {markers.map(marker => <button key={marker.id} type="button" className={`cobe-marker-label ${marker.id === 'hospital' ? 'hospital-marker-label' : ''}`} onClick={() => onMarkerClick?.(marker.id)} disabled={marker.id === 'hospital'} style={{
      position: "absolute",
      positionAnchor: `--cobe-${marker.id}`,
      bottom: "anchor(top)", left: "anchor(center)", translate: "-50% 0",
      opacity: `var(--cobe-visible-${marker.id}, 0)`,
      filter: `blur(calc((1 - var(--cobe-visible-${marker.id}, 0)) * 8px))`,
    }}>{marker.label}</button>)}
  </div>
}
