import { describe, expect, it } from 'vitest'
import { layoutFloorPanels, stepFloorPanels, type FloorAnchor } from '../src/floor-panels'

const anchorsAt = (x: number): Record<number, FloorAnchor> => Object.fromEntries(Array.from({ length: 7 }, (_, i) => [i + 1, { x, y: 100 + (6 - i) * 18, visible: true, opacity: 1 }]))

describe('floating floor labels', () => {
  it('eases a side switch instead of teleporting a whole button width', () => {
    const before = layoutFloorPanels(anchorsAt(100), 320, 380)
    const target = layoutFloorPanels(anchorsAt(240), 320, 380, before)
    let current = stepFloorPanels(before, target, 1 / 60)
    expect(current[0].x).toBeGreaterThan(before[0].x)
    expect(current[0].x).toBeLessThan(target[0].x)
    for (let i = 0; i < 120; i++) current = stepFloorPanels(current, target, 1 / 60)
    expect(current).toEqual(target)
  })
  it('keeps whole buttons in bounds through full turns on narrow phones', () => {
    for (const width of [280, 320, 350, 430]) {
      let previous = layoutFloorPanels({}, width, 380)
      let current = previous
      for (let angle = 0; angle < Math.PI * 4; angle += 0.05) {
        const anchors = anchorsAt(width / 2 + Math.cos(angle) * width)
        previous = layoutFloorPanels(anchors, width, 380, previous)
        current = stepFloorPanels(current, previous, 1 / 60)
        for (const panel of current) {
          expect(panel.x).toBeGreaterThanOrEqual(0)
          expect(panel.x + panel.width).toBeLessThanOrEqual(width)
          expect(panel.y).toBeGreaterThanOrEqual(0)
          expect(panel.y + panel.height).toBeLessThanOrEqual(380)
        }
      }
    }
  })
  it('moves horizontally with the building instead of pinning labels to screen edges', () => {
    const first = layoutFloorPanels(anchorsAt(210), 400, 380)
    const next = layoutFloorPanels(anchorsAt(230), 400, 380, first)
    expect(next.find(p => p.id === 7)!.x - first.find(p => p.id === 7)!.x).toBe(20)
  })
  it('switches sides as a building anchor rotates across the screen', () => {
    const front = layoutFloorPanels(anchorsAt(80), 320, 380)
    const back = layoutFloorPanels(anchorsAt(240), 320, 380, front)
    expect(front.every(p => p.left)).toBe(true)
    expect(back.every(p => !p.left)).toBe(true)
  })
  it('does not flip sides when an anchor jitters near the center', () => {
    const first = layoutFloorPanels(anchorsAt(100), 320, 380)
    expect(layoutFloorPanels(anchorsAt(165), 320, 380, first).every(p => p.left)).toBe(true)
  })
  it('keeps all seven cards separated and inside a phone viewport, even on one side', () => {
    for (const width of [280, 320, 430]) {
      const panels = layoutFloorPanels(anchorsAt(-200), width, 380).sort((a, b) => a.y - b.y)
      expect(new Set(panels.map(p => p.id)).size).toBe(7)
      panels.forEach((p, i) => {
        expect(p.x).toBeGreaterThanOrEqual(0)
        expect(p.x + p.width).toBeLessThanOrEqual(width)
        expect(p.y).toBeGreaterThanOrEqual(0)
        expect(p.y + p.height).toBeLessThanOrEqual(380)
        if (i) expect(p.y - (panels[i - 1].y + panels[i - 1].height)).toBeGreaterThanOrEqual(8)
      })
    }
  })
  it('reduces size and opacity for the far side while keeping floor buttons available', () => {
    const anchors = anchorsAt(230)
    anchors[7] = { ...anchors[7], opacity: 0.58 }
    const panels = layoutFloorPanels(anchors, 400, 380)
    expect(panels.find(p => p.id === 7)!.scale).toBeLessThan(panels.find(p => p.id === 1)!.scale)
    expect(panels.find(p => p.id === 7)!.opacity).toBe(0.58)
    expect(layoutFloorPanels({}, 320, 380)).toHaveLength(7)
  })
})
