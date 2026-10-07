import { describe, expect, it } from 'vitest'
import { availableRoomDevices, roomExplorerSelection } from '../src/room-explorer'
import type { AssetRow } from '../src/domain'

const device = (id: string, category: string, tag = id): AssetRow => ({
  id, tag, category, qr_id: `LIV-${id}`, name: tag, state: 'Active', ip: '—',
  location: 'IT DEPARTMENT', owner: 'IT DEPARTMENT', brand: null, model: null,
  processor: null, ram_capacity_gb: null, ram_modules: null, ssd_capacity_gb: null, ssd_count: null,
  assignment_floor_id: '1', assignment_room_id: 'room-1', assignment_room_name: 'IT DEPARTMENT',
  assignment_department_id: 'IT DEPARTMENT', assigned_at: null, assigned_by: null,
  assignment_method: 'manual', updated_at: '2026-10-01T00:00:00Z',
})

describe('room explorer selection', () => {
  const devices = [device('database-10', 'System Unit', 'UNIT_10'), device('printer-id', 'Printer', 'PRINTER_1'), device('database-2', 'System Unit', 'UNIT_2')]
  it('counts categories and keeps all markers while filtering the device list', () => {
    const result = roomExplorerSelection(devices, 'System Unit', null)
    expect(result.sorted).toHaveLength(3)
    expect(result.counts.get('System Unit')).toBe(2)
    expect(result.counts.get('Printer')).toBe(1)
    expect(result.filtered.map(row => row.tag)).toEqual(['UNIT_2', 'UNIT_10'])
    expect(result.selected?.id).toBe('database-2')
    expect(devices[0].tag).toBe('UNIT_10')
  })
  it('uses the database identity for record navigation, preserving the selected device on refresh', () => {
    expect(roomExplorerSelection([...devices].reverse(), 'System Unit', 'database-10').selected?.qr_id).toBe('LIV-database-10')
  })
  it('drops stale selection when a device moves out of the room', () => {
    const result = roomExplorerSelection(devices.filter(row => row.id !== 'database-10'), 'System Unit', 'database-10')
    expect(result.selected?.id).toBe('database-2')
  })
  it('falls back to All when the last device in a category leaves', () => {
    const result = roomExplorerSelection(devices.filter(row => row.category !== 'Printer'), 'Printer', 'printer-id')
    expect(result.filter).toBeNull()
    expect(result.selected?.category).toBe('System Unit')
  })
  it('clears details and QR content for an empty room', () => {
    const result = roomExplorerSelection([], 'Printer', 'printer-id')
    expect(result.selected).toBeUndefined()
    expect(result.filtered).toEqual([])
    expect(result.counts.size).toBe(0)
  })
})

describe('available room devices', () => {
  const free = { ...device('free', 'Printer'), location: 'Unassigned', assignment_floor_id: null, assignment_room_id: null, assignment_room_name: null }
  it('excludes explicit and legacy assignments, including rooms outside the current map', () => {
    expect(availableRoomDevices([free, device('assigned', 'Printer'), { ...free, id: 'legacy', location: 'F2 · OLD ROOM' }], []).map(row => row.id)).toEqual(['free'])
  })
  it('excludes a device with any pending change, even an unassignment or conflict', () => {
    expect(availableRoomDevices([free], [{ assetId: 'free' } as import('../src/domain').PendingChange])).toEqual([])
  })
})
