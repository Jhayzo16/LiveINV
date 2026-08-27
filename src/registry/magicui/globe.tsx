import { useEffect, useRef } from 'react'
import createGlobe, { type COBEOptions } from 'cobe'

const DEFAULT_CONFIG: COBEOptions = {
  width: 600,
  height: 600,
  devicePixelRatio: 2,
  phi: 0,
  theta: 0.22,
  dark: 1,
  diffuse: 1.15,
  mapSamples: 12000,
  mapBrightness: 1.7,
  baseColor: [0.16, 0.18, 0.18],
  markerColor: [27 / 255, 108 / 255, 36 / 255],
  glowColor: [0.08, 0.1, 0.09],
  markers: [
    { location: [7.4474, 125.8078], size: 0.08 },
  ],
}

type GlobeProps = {
  className?: string
  config?: Partial<COBEOptions>
  onDrag?: (degrees: number) => void
}

export function Globe({ className = '', config, onDrag }: GlobeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const widthRef = useRef(0)
  const phiRef = useRef(0)
  const pointerRef = useRef<number | null>(null)
  const onDragRef = useRef(onDrag)
  onDragRef.current = onDrag

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const resize = () => { widthRef.current = canvas.offsetWidth }
    resize()
    window.addEventListener('resize', resize)

    const globe = createGlobe(canvas, {
      ...DEFAULT_CONFIG,
      ...config,
      width: widthRef.current * 2,
      height: widthRef.current * 2,
    })

    let frame = 0
    const animate = () => {
      if (pointerRef.current === null) phiRef.current += 0.0024
      globe.update({
        phi: phiRef.current,
        width: widthRef.current * 2,
        height: widthRef.current * 2,
      })
      frame = requestAnimationFrame(animate)
    }
    frame = requestAnimationFrame(animate)

    requestAnimationFrame(() => { canvas.style.opacity = '1' })
    return () => {
      cancelAnimationFrame(frame)
      globe.destroy()
      window.removeEventListener('resize', resize)
    }
  }, [config])

  const stopDrag = () => {
    pointerRef.current = null
    if (canvasRef.current) canvasRef.current.style.cursor = 'grab'
  }

  return <canvas
    ref={canvasRef}
    className={`magic-globe ${className}`}
    aria-label="Interactive hospital globe. Drag horizontally to rotate the connected floors."
    onPointerDown={event => {
      event.currentTarget.setPointerCapture(event.pointerId)
      pointerRef.current = event.clientX
      event.currentTarget.style.cursor = 'grabbing'
    }}
    onPointerMove={event => {
      if (pointerRef.current === null) return
      const delta = event.clientX - pointerRef.current
      pointerRef.current = event.clientX
      phiRef.current += delta / 140
      onDragRef.current?.(delta * 0.36)
    }}
    onPointerUp={stopDrag}
    onPointerCancel={stopDrag}
  />
}
