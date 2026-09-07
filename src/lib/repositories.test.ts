import { beforeEach, describe, expect, it, vi } from 'vitest'
import { assignAsset } from './assignments'
import type { InventoryAsset } from './types'

const { from, results, writes } = vi.hoisted(() => ({ from: vi.fn(), results: [] as unknown[], writes: [] as unknown[] }))
vi.mock('./supabase', () => ({ supabase: { from } }))
import { AssetRepository } from './repositories'

const asset: InventoryAsset = { tag: 'TEST', qrId: 'LIV-TEST', name: 'Device', category: 'Router', state: 'Active', ip: '—', owner: 'Unassigned', location: 'Unassigned' }

beforeEach(() => {
  localStorage.clear()
  results.length = 0
  writes.length = 0
  from.mockImplementation(() => {
    const chain = {
      update: vi.fn(value => { writes.push(value); return chain }),
      insert: vi.fn(value => { writes.push(value); return chain }),
      eq: vi.fn(() => chain), select: vi.fn(() => chain), order: vi.fn(() => chain),
      then: (resolve: (value: unknown) => unknown) => Promise.resolve(results.shift()).then(resolve),
    }
    return chain
  })
})

describe('shared assignment persistence', () => {
  it('persists stable room IDs with consistent display fields', async () => {
    results.push({ data: [{ tag: asset.tag }], error: null })
    const assigned = assignAsset(asset, { floorId: '2', roomId: 'f2-space-33', roomName: 'MAJOR OR 1', departmentId: 'IT Department' })
    await AssetRepository.update(asset.tag, { ...assigned, location: 'F1 · Wrong', owner: 'Wrong' })
    expect(writes[0]).toMatchObject({ assignment_room_id: 'f2-space-33', location: 'F2 · MAJOR OR 1', owner: 'IT Department' })
  })

  it('does not silently drop the room ID when the database migration is missing', async () => {
    results.push({ data: null, error: { code: 'PGRST204', message: 'Missing assignment_room_id' } })
    const assigned = assignAsset(asset, { floorId: '2', roomId: 'f2-space-33', roomName: 'MAJOR OR 1', departmentId: 'IT Department' })
    await expect(AssetRepository.update(asset.tag, assigned)).rejects.toThrow('migration')
    expect(writes).toHaveLength(1)
  })

  it('does not report a browser-only update as a successful shared save', async () => {
    results.push({ data: null, error: { code: '42501', message: 'Permission denied for audit_logs' } })
    await expect(AssetRepository.update(asset.tag, asset)).rejects.toThrow('audit_logs')
    expect(AssetRepository.getUnsyncedAssetTags()).toEqual([])
  })

  it('rejects an update that changed no record', async () => {
    results.push({ data: [], error: null })
    await expect(AssetRepository.update(asset.tag, asset)).rejects.toThrow('not updated')
  })

  it('does not replace a failed inventory fetch with sample records', async () => {
    results.push({ data: null, error: { message: 'Connection failed' } })
    await expect(AssetRepository.getAll()).rejects.toThrow('shared inventory')
  })

  it('retains old local drafts without overriding shared records', async () => {
    localStorage.setItem('liveinv-local-asset-overrides', JSON.stringify({ TEST: { ...asset, location: 'F2 · Wrong' } }))
    results.push({ data: [{ ...asset, qr_id: asset.qrId }], error: null })
    expect((await AssetRepository.getAll())[0].location).toBe('Unassigned')
    expect(AssetRepository.getUnsyncedAssetTags()).toEqual(['TEST'])
  })
})
