import { readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { describe, expect, it } from 'vitest'
import catalog from './room-catalog.json'
import { hospitalRooms, assignmentLocations } from './rooms'
import { assignAsset, resolveAssetRoom } from './assignments'
import type { InventoryAsset } from './types'

const asset: InventoryAsset = { tag: 'TEST', qrId: 'LIV-TEST', name: 'Device', category: 'Router', state: 'Active', ip: '—', owner: 'IT Department', location: 'Unassigned' }

describe('asset and map consistency', () => {
  it('offers a unique assignment ID for every physical room, including namesakes', () => {
    expect(new Set(assignmentLocations.map(room => room.roomId)).size).toBe(hospitalRooms.length)
    for (const target of assignmentLocations) {
      const assigned = assignAsset(asset, { floorId: target.floor, roomId: target.roomId, roomName: target.room, departmentId: target.department })
      expect(resolveAssetRoom(assigned, hospitalRooms)?.id).toBe(target.roomId)
    }
  })

  it('does not guess an operating room or silently place HR on another floor', () => {
    expect(resolveAssetRoom({ ...asset, location: 'F2 · Operating Room' }, hospitalRooms)).toBeUndefined()
    expect(resolveAssetRoom({ ...asset, location: 'F5 · HR Office' }, hospitalRooms)).toBeUndefined()
    expect(resolveAssetRoom({ ...asset, location: 'F1 · HR Office' }, hospitalRooms)?.name).toBe('HR OFFICE')
    expect(resolveAssetRoom({ ...asset, location: 'F2 · MAJOR OR 1' }, hospitalRooms)?.name).toBe('MAJOR OR 1')
  })

  it('resolves unique legacy names and retains duplicate names for clarification', () => {
    for (const location of ['F1 · Laboratory', 'F1 · ER Reception', 'F5 · Accounting', 'F5 · Medical Records']) {
      expect(resolveAssetRoom({ ...asset, location }, hospitalRooms)).toBeDefined()
    }
    expect(resolveAssetRoom({ ...asset, location: 'F5 · PRIVATE ROOM' }, hospitalRooms)).toBeUndefined()
  })

  it('uses an exact room ID ahead of a conflicting display name', () => {
    const target = hospitalRooms.find(room => room.name === 'MAJOR OR 1')!
    const assigned = assignAsset(asset, { floorId: '2', roomId: target.id, roomName: 'MAJOR OR 2', departmentId: 'IT Department' })
    expect(resolveAssetRoom(assigned, hospitalRooms)?.id).toBe(target.id)
    assigned.assignment!.roomId = 'f2-space-999'
    expect(resolveAssetRoom(assigned, hospitalRooms)).toBeUndefined()
    assigned.assignment!.roomId = target.legacyIds[0]
    expect(resolveAssetRoom(assigned, hospitalRooms)?.id).toBe(target.id)
  })

  it('moves a device between rooms and removes it entirely when unassigned', async () => {
    const { unassignAsset } = await import('./assignments')
    const room = hospitalRooms.find(room => room.name === 'MAJOR OR 2')!
    const moved = assignAsset({ ...asset, location: 'F1 · Laboratory' }, { floorId: '2', roomId: room.id, roomName: room.name, departmentId: 'IT Department' })
    expect(resolveAssetRoom(moved, hospitalRooms)?.id).toBe(room.id)
    expect(resolveAssetRoom(unassignAsset(moved), hospitalRooms)).toBeUndefined()
  })

  for (const [floor, entry] of Object.entries(catalog)) {
    it(`keeps Floor ${floor}'s catalog synchronized with its actual SVG`, () => {
      const source = readFileSync(`public/floor-plans/floor-${floor}.svg`, 'utf8')
      expect(createHash('sha256').update(source).digest('hex'), 'Run node scripts/generate-room-catalog.mjs after editing floor plans').toBe(entry.sourceHash)
      const document = new DOMParser().parseFromString(source, 'image/svg+xml')
      const shapes = [...document.querySelectorAll('rect[fill="#D9D9D9"]')]
      expect(shapes).toHaveLength(entry.rooms.length)
      expect(entry.rooms.map(room => room.shapeId)).toEqual(shapes.map((shape, index) => shape.id || `shape-${index + 1}`))
    })
  }
})
