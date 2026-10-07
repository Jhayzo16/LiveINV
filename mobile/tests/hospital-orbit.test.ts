import { describe, expect, it } from 'vitest'
import { dragOrbit, initialOrbit, orbitAtRest, resetOrbit, stepOrbit } from '../src/hospital-orbit'

describe('hospital rotation', () => {
  it('retains complete turns and their direction across repeated drags', () => {
    let target = { ...initialOrbit }
    let current = { ...initialOrbit }
    for (let i = 0; i < 240; i++) {
      target = dragOrbit(target, 5, 0)
      const next = stepOrbit(current, target, 1 / 60)
      expect(next.theta).toBeLessThan(current.theta)
      current = next
    }
    expect(target.theta).toBeCloseTo(initialOrbit.theta - 10.8)
    for (let i = 0; i < 120; i++) current = stepOrbit(current, target, 1 / 60)
    expect(orbitAtRest(current, target)).toBe(true)
  })

  it('finishes the last movement after release at different display frame rates', () => {
    const target = { theta: 2.9, phi: 0.8, zoom: 1.5 }
    for (const fps of [30, 60, 120]) {
      let current = { ...initialOrbit }
      for (let i = 0; i < fps * 2; i++) current = stepOrbit(current, target, 1 / fps)
      expect(current).toEqual(target)
    }
  })

  it('does not jump straight to the endpoint after an idle gap', () => {
    const target = dragOrbit(initialOrbit, 100, 0)
    const next = stepOrbit(initialOrbit, target, 5)
    expect(next.theta).toBeGreaterThan(target.theta)
    expect(next.theta).toBeLessThan(initialOrbit.theta)
  })

  it('resets to the closest equivalent front view after several turns', () => {
    for (const theta of [-30, -8, 0, 9, 40]) {
      const reset = resetOrbit({ theta, phi: 0.8, zoom: 1.5 })
      expect(Math.abs(reset.theta - theta)).toBeLessThanOrEqual(Math.PI)
      expect(Math.cos(reset.theta)).toBeCloseTo(Math.cos(initialOrbit.theta))
      expect(reset.phi).toBe(initialOrbit.phi)
      expect(reset.zoom).toBe(1)
    }
  })
})
