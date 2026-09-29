import { describe, expect, it, vi } from 'vitest'
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { seal, unseal } from '../src/crypto'
import { findAsset, validIp, toAsset, patchMatches, type AssetRow, type PendingChange } from '../src/domain'
import { applyChange } from '../src/sync'
import { resolveAssetRoom } from '../src/shared/assignments'
import { hospitalRooms } from '../src/shared/rooms'
import maps from '../src/shared/floor-maps.json'

const row = { id: 'asset-1', tag: 'PC-001', qr_id: 'LIV-001', name: 'Workstation', category: 'System Unit',
  state: 'Active', ip: '192.168.1.10', location: 'Unassigned', owner: 'Unassigned',
  updated_at: '2026-09-28T00:00:00Z' } as AssetRow
const change: PendingChange = { id: 'change-1', assetId: row.id, userId: 'user-1', tag: row.tag,
  baseVersion: row.updated_at, patch: { state: 'Maintenance' }, status: 'pending', createdAt: row.updated_at }

describe('offline change handling', () => {
  it('accepts a conditional server update', async () => {
    const updated = { ...row, state: 'Maintenance' as const }
    const remote = { update: vi.fn().mockResolvedValue(updated), get: vi.fn() }
    expect(await applyChange(remote, 'user-1', change)).toEqual({ status: 'saved', row: updated })
    expect(remote.get).not.toHaveBeenCalled()
  })
  it('keeps concurrent server edits as conflicts instead of overwriting them', async () => {
    const current = { ...row, state: 'Broken' as const }
    const remote = { update: vi.fn().mockResolvedValue(null), get: vi.fn().mockResolvedValue(current) }
    expect(await applyChange(remote, 'user-1', change)).toEqual({ status: 'conflict', row: current })
    expect(remote.update).toHaveBeenCalledTimes(1)
  })
  it('recognizes a successful write when its original response was lost', async () => {
    const current = { ...row, ...change.patch }
    const remote = { update: vi.fn().mockResolvedValue(null), get: vi.fn().mockResolvedValue(current) }
    expect((await applyChange(remote, 'user-1', change)).status).toBe('saved')
  })
  it('normalizes database timestamps when reconciling a retried assignment', () => {
    expect(patchMatches({ ...row, assigned_at: '2026-09-28T01:00:00+00:00' }, { assigned_at: '2026-09-28T01:00:00.000Z' })).toBe(true)
  })
  it('never sends a different account’s pending change', async () => {
    const remote = { update: vi.fn(), get: vi.fn() }
    await expect(applyChange(remote, 'user-2', change)).rejects.toThrow('another account')
    expect(remote.update).not.toHaveBeenCalled()
  })
  it('retains transport failures for retry rather than reporting success', async () => {
    await expect(applyChange({ update: vi.fn().mockRejectedValue(new Error('Offline')), get: vi.fn() }, 'user-1', change)).rejects.toThrow('Offline')
  })
  it('treats missing or inaccessible records as conflicts', async () => {
    expect((await applyChange({ update: vi.fn().mockResolvedValue(null), get: vi.fn().mockResolvedValue(null) }, 'user-1', change)).status).toBe('conflict')
  })
})
describe('encrypted storage payloads', () => {
  it('round-trips Unicode records without exposing the inventory', () => {
    const key = randomBytes(32), payload = JSON.stringify({ room: 'F1 · Réception', token: 'secret-token' })
    const ciphertext = seal(key, randomBytes(12), 'inventory:user-1', payload)
    expect(ciphertext).not.toContain('secret-token')
    expect(unseal(key, 'inventory:user-1', ciphertext)).toBe(payload)
  })
  it('rejects swapped records, wrong keys, and modified ciphertext', () => {
    const key = randomBytes(32), ciphertext = seal(key, randomBytes(12), 'inventory:user-1', 'private')
    expect(() => unseal(key, 'inventory:user-2', ciphertext)).toThrow()
    expect(() => unseal(randomBytes(32), 'inventory:user-1', ciphertext)).toThrow()
    const tampered = ciphertext.slice(0, -1) + (ciphertext.endsWith('0') ? '1' : '0')
    expect(() => unseal(key, 'inventory:user-1', tampered)).toThrow()
  })
})
describe('website compatibility', () => {
  it('recognizes existing QR labels, legacy labels, and manual numbers', () => {
    for (const code of ['liveinv:qr:LIV-001', 'LIVEINV:ASSET:pc-001', ' liv-001 ', 'pc-001']) expect(findAsset([row], code)).toBe(row)
    expect(findAsset([row], 'https://unrelated.example')).toBeUndefined()
    expect(findAsset([row], '')).toBeUndefined()
  })
  it('validates all IPv4 octets', () => {
    expect(validIp('255.255.255.255')).toBe(true)
    expect(validIp('256.1.1.1')).toBe(false)
    expect(validIp('1.2.3')).toBe(false)
    expect(validIp('—')).toBe(true)
  })
  it('keeps the generated catalog and assignment logic identical to the website', () => {
    for (const name of ['types.ts', 'assignments.ts', 'rooms.ts', 'room-catalog.json']) {
      expect(readFileSync(`src/shared/${name}`, 'utf8')).toBe(readFileSync(`../src/lib/${name}`, 'utf8'))
    }
  })
  it('has a positive hit area for every room on all seven floor maps', () => {
    expect(Object.keys(maps)).toHaveLength(7)
    for (const map of Object.values(maps)) for (const room of map.rooms) {
      expect(room.width).toBeGreaterThan(0); expect(room.height).toBeGreaterThan(0)
      expect(hospitalRooms.some(item => item.id === room.id)).toBe(true)
    }
  })
  it('uses stable room IDs to distinguish rooms with the same name', () => {
    const rooms = [{ id: 'f1-space-1', floor: 1, name: 'Office' }, { id: 'f1-space-2', floor: 1, name: 'Office' }]
    const asset = toAsset({ ...row, assignment_floor_id: '1', assignment_room_id: 'f1-space-2', assignment_room_name: 'Office' })
    expect(resolveAssetRoom(asset, rooms)?.id).toBe('f1-space-2')
  })
})
