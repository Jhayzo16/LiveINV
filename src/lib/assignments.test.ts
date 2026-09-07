import { describe, expect, it } from 'vitest'
import { assetBelongsToRoom, assignAsset, floorIdFromLocation, isAssetAssigned, normalizeRoomName, unassignAsset } from './assignments'
import type { InventoryAsset } from './types'

const unassignedAsset: InventoryAsset = {
  tag: 'PC-TEST-01', qrId: 'LIV-TEST0001', name: 'Test PC', category: 'System Unit',
  location: 'Unassigned', owner: 'Unassigned', state: 'Active', ip: '—',
}

describe('assignment helpers', () => {
  it('creates a complete structured assignment and legacy display fields', () => {
    const asset = assignAsset(unassignedAsset, {
      floorId: '5', roomId: 'f5-records', roomName: 'Medical Records',
      departmentId: 'Medical Records Department', assignedBy: 'Admin', method: 'manual',
    }, '2026-09-03T00:00:00.000Z')

    expect(asset.location).toBe('F5 · Medical Records')
    expect(asset.owner).toBe('Medical Records Department')
    expect(asset.assignment).toEqual({
      floorId: '5', roomId: 'f5-records', roomName: 'Medical Records',
      departmentId: 'Medical Records Department', assignedAt: '2026-09-03T00:00:00.000Z',
      assignedBy: 'Admin', method: 'manual',
    })
    expect(isAssetAssigned(asset)).toBe(true)
  })

  it('matches a stable room id and tolerates legacy punctuation/capitalization', () => {
    const assigned = assignAsset(unassignedAsset, {
      floorId: '1', roomId: 'f1-er_reception', roomName: 'E.R. RECEPTION', departmentId: 'Emergency',
    })
    expect(assetBelongsToRoom(assigned, { id: 'f1-er_reception', floor: 1, name: 'ER Reception' })).toBe(true)

    const legacy = { ...unassignedAsset, location: 'F1 · E.R. RECEPTION', owner: 'Emergency' }
    expect(assetBelongsToRoom(legacy, { id: 'anything', floor: 1, name: 'ER Reception' })).toBe(true)
    expect(assetBelongsToRoom({ ...legacy, location: 'F1 · Laboratory' }, { id: 'lab', floor: 1, name: 'LABORATORY EQUIPMENT AREA' })).toBe(true)
    expect(assetBelongsToRoom({ ...legacy, location: 'F5 · Accounting' }, { id: 'accounting', floor: 5, name: 'ACCOUTING OFFICE' })).toBe(true)
    expect(assetBelongsToRoom(legacy, { id: 'anything', floor: 2, name: 'ER Reception' })).toBe(false)
    expect(normalizeRoomName("NURSE’S STATION")).toBe('nursesstation')
    expect(floorIdFromLocation(legacy.location)).toBe('1')
  })

  it('clears every assignment field so a device can be transferred', () => {
    const assigned = assignAsset(unassignedAsset, {
      floorId: '3', roomId: 'f3-nurses-station-1', roomName: "Nurse's Station 1", departmentId: 'Hemodialysis Center',
    })

    const unassigned = unassignAsset(assigned)

    expect(unassigned.location).toBe('Unassigned')
    expect(unassigned.owner).toBe('Unassigned')
    expect(unassigned.assignment).toBeUndefined()
    expect(isAssetAssigned(unassigned)).toBe(false)
    expect(isAssetAssigned(assigned)).toBe(true)
  })
})
