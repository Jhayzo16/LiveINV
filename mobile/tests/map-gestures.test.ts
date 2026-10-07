import { describe, expect, it } from 'vitest'
import { constrainMap, pinchMap, touchDelta } from '../src/map-gestures'

describe('floor plan gestures', () => {
  it('keeps the touched map point under the moving pinch midpoint', () => {
    const view = { zoom: 1.5, x: 20, y: -30 }
    const from = { x: 50, y: 40 }
    const to = { x: 60, y: 25 }
    const next = pinchMap(view, 1.4, from, to)
    expect((to.x - next.x) / next.zoom).toBeCloseTo((from.x - view.x) / view.zoom)
    expect((to.y - next.y) / next.zoom).toBeCloseTo((from.y - view.y) / view.zoom)
  })
  it('allows midpoint panning even when pinch reaches the zoom limit', () => {
    expect(pinchMap({ zoom: 8, x: 0, y: 0 }, 2, { x: 20, y: 30 }, { x: 30, y: 40 })).toEqual({ zoom: 8, x: 10, y: 10 })
  })
  it('keeps a zoomed map reachable and centers dimensions smaller than the viewport', () => {
    expect(constrainMap({ zoom: 2, x: 900, y: -900 }, 300, 400, 300, 150)).toEqual({ zoom: 2, x: 150, y: 0 })
    expect(constrainMap({ zoom: 0.2, x: 90, y: -90 }, 300, 400, 300, 150)).toEqual({ zoom: 1, x: 0, y: 0 })
  })
  it('rebases when adding, lifting, or replacing fingers without jumping', () => {
    const a = { id: 1, x: 30, y: 20 }
    const b = { id: 2, x: 100, y: 20 }
    expect(touchDelta([a], [a, b])).toBeNull()
    expect(touchDelta([a, b], [b])).toBeNull()
    expect(touchDelta([a], [b])).toBeNull()
    expect(touchDelta([a], [])).toBeNull()
  })
  it('tracks touch identities even if the event array order changes', () => {
    expect(touchDelta([{ id: 1, x: 0, y: 0 }, { id: 2, x: 100, y: 0 }], [{ id: 2, x: 150, y: 10 }, { id: 1, x: -50, y: 10 }])).toEqual({ kind: 'pinch', scale: 2, from: { x: 50, y: 0 }, to: { x: 50, y: 10 } })
  })
  it('ignores coincident fingers instead of producing infinite zoom', () => {
    expect(touchDelta([{ id: 1, x: 0, y: 0 }, { id: 2, x: 0, y: 0 }], [{ id: 1, x: 0, y: 0 }, { id: 2, x: 50, y: 0 }])).toBeNull()
  })
})
