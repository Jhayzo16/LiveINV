import { clamp } from './map-gestures'

export type Orbit = { theta: number; phi: number; zoom: number }
export const initialOrbit: Orbit = { theta: 0.38, phi: 1.2, zoom: 1 }

export function dragOrbit(orbit: Orbit, x: number, y: number): Orbit {
  // Do not wrap theta: accumulated drags must keep their direction through 360°.
  return { ...orbit, theta: orbit.theta - x * 0.009, phi: clamp(orbit.phi - y * 0.007, Math.PI * 0.23, Math.PI * 0.49) }
}

export function easeTo(current: number, target: number, delta: number, tolerance: number): number {
  const next = current + (target - current) * (1 - Math.exp(-18 * clamp(delta, 0, 1 / 20)))
  return Math.abs(target - next) <= tolerance ? target : next
}

export function stepOrbit(current: Orbit, target: Orbit, delta: number): Orbit {
  return { theta: easeTo(current.theta, target.theta, delta, 0.0001), phi: easeTo(current.phi, target.phi, delta, 0.0001), zoom: easeTo(current.zoom, target.zoom, delta, 0.0001) }
}

export function orbitAtRest(current: Orbit, target: Orbit): boolean {
  return current.theta === target.theta && current.phi === target.phi && current.zoom === target.zoom
}

export function resetOrbit(current: Orbit): Orbit {
  const turn = Math.PI * 2
  return { ...initialOrbit, theta: initialOrbit.theta + Math.round((current.theta - initialOrbit.theta) / turn) * turn }
}
