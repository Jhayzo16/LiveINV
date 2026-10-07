import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { roomAtPoint, visibleMapBox, withinTapSlop } from '../src/map-gestures'
import maps from '../src/shared/floor-maps.json'
import { nightFloorXml, nightMap } from '../src/floor-plan-theme'

describe('floor plan clarity and touch alignment', () => {
  it('applies Night Navigator to all seven floors without changing any geometry, label or room identity', () => {
    const withoutFillColors = (xml: string) => xml.replace(/\bfill="[^"]+"/g, 'fill=""')
    for (const map of Object.values(maps)) {
      const original = JSON.stringify(map)
      const themed = nightFloorXml(map.xml)
      expect(themed).not.toBe(map.xml)
      expect(withoutFillColors(themed)).toBe(withoutFillColors(map.xml))
      expect(themed).toContain(`fill="${nightMap.background}"`)
      expect(themed).toContain(`fill="${nightMap.room}"`)
      expect(themed).toContain(`fill="${nightMap.label}"`)
      expect(JSON.stringify(map)).toBe(original)
    }
  })
  it('removes only the embedded floor titles while preserving room labels', () => {
    for (const [floor, map] of Object.entries(maps)) {
      const title = /^[1-7](?:st|nd|rd|th) FLOOR$/i
      const ids = (xml: string) => [...xml.matchAll(/\bid="([^"]+)"/g)].map(match => match[1]
        .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code))).replaceAll('&amp;', '&'))
      const sourceIds = ids(readFileSync(`../public/floor-plans/floor-${floor}.svg`, 'utf8'))
      expect(ids(map.xml)).toEqual(sourceIds.filter(id => !title.test(id)))
      expect(ids(map.xml).some(id => title.test(id))).toBe(false)
      expect(map.rooms.length).toBeGreaterThan(0)
    }
  })
  it('keeps every room center selectable at multiple zoom levels and pan offsets', () => {
    for (const map of Object.values(maps)) {
      const [x, y, width, height] = map.viewBox.split(' ').map(Number)
      for (const zoom of [1, 2, 4, 8]) {
        const viewport = { width: 360, height: 430 }
        const box = visibleMapBox({ zoom, x: 81, y: -42 }, viewport, { x, y, width, height })
        for (const room of map.rooms) {
          const screenX = (room.x + room.width / 2 - box.x) / box.width * viewport.width
          const screenY = (room.y + room.height / 2 - box.y) / box.height * viewport.height
          const point = { x: box.x + screenX / viewport.width * box.width, y: box.y + screenY / viewport.height * box.height }
          expect(roomAtPoint(map.rooms, point, box.width / viewport.width)?.id).toBe(room.id)
        }
      }
    }
  })
  it('expands touch tolerance in screen pixels without stealing direct hits from neighbors', () => {
    const rooms = [{ id: 'small', x: 0, y: 0, width: 5, height: 5 }, { id: 'neighbor', x: 12, y: 0, width: 10, height: 10 }]
    expect(roomAtPoint(rooms, { x: -6, y: 2 }, 1)?.id).toBe('small')
    expect(roomAtPoint(rooms, { x: 13, y: 2 }, 1)?.id).toBe('neighbor')
    expect(roomAtPoint(rooms, { x: -9, y: 2 }, 1)).toBeUndefined()
    expect(roomAtPoint(rooms, { x: -6, y: 2 }, 0.5)).toBeUndefined()
  })
  it('allows natural finger jitter but rejects a drag as a tap', () => {
    expect(withinTapSlop({ x: 100, y: 200 }, { x: 104, y: 204 })).toBe(true)
    expect(withinTapSlop({ x: 100, y: 200 }, { x: 112, y: 204 })).toBe(false)
  })
  it('fits a nonzero-origin map without distorting its aspect ratio', () => {
    const box = visibleMapBox({ zoom: 1, x: 0, y: 0 }, { width: 300, height: 400 }, { x: 20, y: 40, width: 600, height: 600 })
    expect(box).toEqual({ x: 20, y: -60, width: 600, height: 800 })
  })
})
