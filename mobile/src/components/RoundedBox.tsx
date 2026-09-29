import { useEffect, useMemo } from 'react'
import type { ThreeElements } from '@react-three/fiber/native'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
export function RoundedBox({ args, radius, smoothness = 3, children, ...props }: Omit<ThreeElements['mesh'], 'args'> & { args: [number, number, number]; radius: number; smoothness?: number }) {
  const [w, h, d] = args
  const geometry = useMemo(() => new RoundedBoxGeometry(w, h, d, Math.min(smoothness, 3), Math.min(radius, h / 2)), [w, h, d, radius, smoothness])
  useEffect(() => () => geometry.dispose(), [geometry])
  return <mesh {...props} geometry={geometry}>{children}</mesh>
}
