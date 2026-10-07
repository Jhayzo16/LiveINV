import { beforeEach, describe, expect, it, vi } from 'vitest'
const mocks = vi.hoisted(() => ({
  saved: new Map<string, string>(), fetch: vi.fn(), verify: vi.fn(), getSession: vi.fn(), signOut: vi.fn(),
  setItem: vi.fn(), from: vi.fn(),
}))
vi.mock('expo-crypto', () => ({ randomUUID: () => 'change-id' }))
vi.mock('@react-native-community/netinfo', () => ({ default: { fetch: mocks.fetch } }))
vi.mock('../src/storage', () => ({
  storage: { setItem: mocks.setItem, removeItem: async (key: string) => { mocks.saved.delete(key) } },
  readStored: async (key: string) => mocks.saved.has(key) ? JSON.parse(mocks.saved.get(key)!) : null,
}))
vi.mock('../src/supabase', () => ({
  AccessDeniedError: class AccessDeniedError extends Error {},
  verifyAdmin: mocks.verify,
  supabase: { auth: { getSession: mocks.getSession, signOut: mocks.signOut }, from: mocks.from },
}))
import { actions, useInventory, queryClient } from '../src/store'
import { AccessDeniedError } from '../src/supabase'
import type { AssetRow } from '../src/domain'
import { buildDevice, emptyDevice } from '../src/registration'
import { hospitalRooms } from '../src/shared/rooms'
import { buildDeviceEdit, editDeviceForm } from '../src/device-edit'

const row = { id: 'asset-1', tag: 'PC-1', updated_at: 'version-1', state: 'Active' } as AssetRow
beforeEach(() => {
  vi.clearAllMocks(); mocks.saved.clear(); queryClient.clear()
  mocks.fetch.mockResolvedValue({ isConnected: false, isInternetReachable: false })
  mocks.setItem.mockImplementation(async (key: string, value: string) => { mocks.saved.set(key, value) })
  mocks.signOut.mockResolvedValue({ error: null })
  useInventory.setState({ userId: 'user-1', email: 'admin@example.test', status: 'ready', rows: [row], pending: [], lastSync: null, authorizedAt: Date.now(), busy: false, error: null, online: false })
})
async function settle() { await actions.refresh() }

describe('online device editing', () => {
  const device = { ...row, category: 'Printer', brand: 'HP', model: '101', name: 'HP 101', ip: '—', processor: null, ram_capacity_gb: null, ram_modules: null, ssd_capacity_gb: null, ssd_count: null }
  const request = { base: device, patch: buildDeviceEdit(device, { ...editDeviceForm(device), model: '102' }, []) }
  function remote() {
    mocks.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true })
    mocks.verify.mockResolvedValue({ id: 'user-1' })
    const saved = { ...device, ...request.patch, updated_at: 'version-2' }
    const query = { select: vi.fn(), eq: vi.fn(), update: vi.fn(), maybeSingle: vi.fn().mockResolvedValueOnce({ data: device, error: null }).mockResolvedValueOnce({ data: saved, error: null }) }
    query.select.mockReturnValue(query); query.eq.mockReturnValue(query); query.update.mockReturnValue(query)
    mocks.from.mockReturnValue(query)
    useInventory.setState({ rows: [device] })
    return { query, saved }
  }
  it('requires internet and fresh admin authorization', async () => {
    await expect(actions.editDevice(request)).rejects.toThrow('Connect')
    remote(); mocks.verify.mockRejectedValueOnce(new Error('Revoked'))
    await expect(actions.editDevice(request)).rejects.toThrow('Revoked')
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('blocks edits while the device has a queued change', async () => {
    await actions.queue(row, { state: 'Broken' }); await settle()
    await expect(actions.editDevice(request)).rejects.toThrow('unsynced change')
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('updates only editable fields with a version guard and persists the confirmed device', async () => {
    const { query, saved } = remote()
    expect(await actions.editDevice(request)).toEqual(saved)
    expect(query.eq).toHaveBeenCalledWith('updated_at', 'version-1')
    expect(query.update).toHaveBeenCalledWith(request.patch)
    expect(useInventory.getState().rows).toEqual([saved])
    expect(JSON.parse(mocks.saved.get('inventory:user-1')!).rows).toEqual([saved])
  })
  it('keeps a confirmed online save when updating local storage fails', async () => {
    const { saved } = remote(); mocks.setItem.mockRejectedValueOnce(new Error('Disk full'))
    expect(await actions.editDevice(request)).toEqual(saved)
    expect(useInventory.getState().rows).toEqual([saved])
    expect(useInventory.getState().error).toContain('saved online')
  })
})
function seedOffline(authorizedAt = Date.now()) {
  mocks.saved.set('active-identity', JSON.stringify({ id: 'user-1', email: 'admin@example.test' }))
  mocks.saved.set('inventory:user-1', JSON.stringify({ rows: [row], pending: [], lastSync: null, authorizedAt }))
}
describe('durable offline workflow', () => {
  it('saves a queued edit before acknowledging it and leaves confirmed inventory unchanged', async () => {
    await actions.queue(row, { state: 'Broken' }); await settle()
    const saved = JSON.parse(mocks.saved.get('inventory:user-1')!)
    expect(saved.pending[0]).toMatchObject({ userId: 'user-1', baseVersion: 'version-1', patch: { state: 'Broken' } })
    expect(useInventory.getState().rows[0].state).toBe('Active')
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('does not claim success or retain an in-memory change after storage fails', async () => {
    mocks.setItem.mockRejectedValueOnce(new Error('Disk full'))
    await expect(actions.queue(row, { state: 'Broken' })).rejects.toThrow('Disk full')
    expect(useInventory.getState().pending).toHaveLength(0)
  })
  it('prevents multiple unsynced edits to the same asset', async () => {
    await actions.queue(row, { state: 'Broken' }); await settle()
    await expect(actions.queue(row, { state: 'Inactive' })).rejects.toThrow('pending change')
    expect(useInventory.getState().pending).toHaveLength(1)
  })
  it('restores a previously authorized account offline without refreshing an expired JWT', async () => {
    seedOffline(); await actions.restore()
    expect(useInventory.getState().status).toBe('ready')
    expect(useInventory.getState().rows).toEqual([row])
    expect(mocks.getSession).not.toHaveBeenCalled()
    expect(mocks.verify).not.toHaveBeenCalled()
  })
  it('requires online verification after eight hours', async () => {
    seedOffline(Date.now() - 9 * 60 * 60 * 1000); await actions.restore()
    expect(useInventory.getState().status).toBe('locked')
    await expect(actions.queue(row, { state: 'Broken' })).rejects.toThrow()
  })
  it('does not unlock cached inventory after a known access revocation', async () => {
    seedOffline()
    mocks.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true })
    mocks.getSession.mockResolvedValue({ data: { session: { user: { id: 'user-1', email: 'admin@example.test' } } }, error: null })
    mocks.verify.mockRejectedValueOnce(new AccessDeniedError('Revoked'))
    await actions.restore()
    expect(useInventory.getState().status).toBe('locked')
    mocks.fetch.mockResolvedValue({ isConnected: false, isInternetReachable: false })
    await actions.restore()
    expect(useInventory.getState().status).toBe('locked')
    expect(JSON.parse(mocks.saved.get('inventory:user-1')!).authorizedAt).toBe(0)
  })
  it('clears the current account’s local data on explicit sign-out', async () => {
    seedOffline(); await actions.logout()
    expect(mocks.saved.has('inventory:user-1')).toBe(false)
    expect(mocks.saved.has('active-identity')).toBe(false)
    expect(useInventory.getState()).toMatchObject({ status: 'signedOut', rows: [], pending: [], userId: null })
  })
})

describe('room assignment', () => {
  const room = hospitalRooms[0]
  const free = { ...row, location: 'Unassigned', owner: 'Unassigned', assignment_floor_id: null, assignment_room_id: null, assignment_room_name: null }
  beforeEach(() => { useInventory.setState({ rows: [free] }) })
  it('queues the exact room and reports offline pending without claiming confirmation', async () => {
    expect(await actions.assignToRoom(free.id, room.id)).toBe('pending')
    expect(useInventory.getState().rows[0].assignment_room_id).toBeNull()
    expect(useInventory.getState().pending[0]).toMatchObject({ assetId: free.id, baseVersion: 'version-1', patch: {
      assignment_room_id: room.id, assignment_floor_id: String(room.floor), assignment_room_name: room.name,
      assignment_method: 'manual', assigned_by: 'user-1', location: `F${room.floor} · ${room.name}`, owner: room.department,
    } })
  })
  it('rejects duplicate taps and a device that became assigned after the picker opened', async () => {
    const results = await Promise.allSettled([actions.assignToRoom(free.id, room.id), actions.assignToRoom(free.id, room.id)])
    expect(results.map(result => result.status).sort()).toEqual(['fulfilled', 'rejected'])
    expect(useInventory.getState().pending).toHaveLength(1)
    useInventory.setState({ pending: [], rows: [{ ...free, assignment_room_id: 'some-other-room' }] })
    await expect(actions.assignToRoom(free.id, room.id)).rejects.toThrow('already assigned')
  })
  it('rejects invalid rooms and does not acknowledge failed durable storage', async () => {
    await expect(actions.assignToRoom(free.id, 'missing-room')).rejects.toThrow('room is no longer available')
    mocks.setItem.mockRejectedValueOnce(new Error('Disk full'))
    await expect(actions.assignToRoom(free.id, room.id)).rejects.toThrow('Disk full')
    expect(useInventory.getState().pending).toEqual([])
  })
  it('updates the room inventory after the server confirms the assignment', async () => {
    mocks.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true })
    mocks.verify.mockResolvedValue({ id: 'user-1' })
    let saved = free as AssetRow
    const eq = vi.fn()
    const updateQuery = { eq, select: () => ({ maybeSingle: async () => ({ data: saved, error: null }) }) }
    eq.mockReturnValue(updateQuery)
    mocks.from.mockReturnValue({
      update: (patch: object) => { saved = { ...free, ...patch, updated_at: 'version-2' }; return updateQuery },
      select: () => ({ order: () => ({ range: async () => ({ data: [saved], error: null }) }) }),
    })
    expect(await actions.assignToRoom(free.id, room.id)).toBe('saved')
    expect(eq).toHaveBeenCalledWith('updated_at', 'version-1')
    expect(useInventory.getState().rows[0].assignment_room_id).toBe(room.id)
    expect(useInventory.getState().pending).toEqual([])
  })
  it('keeps a competing server assignment and reports a conflict instead of success', async () => {
    mocks.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true })
    mocks.verify.mockResolvedValue({ id: 'user-1' })
    const remoteRow = { ...free, assignment_room_id: 'another-room', updated_at: 'version-2' }
    const updateQuery = { eq: vi.fn(), select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }
    updateQuery.eq.mockReturnValue(updateQuery)
    mocks.from.mockReturnValue({ update: () => updateQuery, select: () => ({
      eq: () => ({ maybeSingle: async () => ({ data: remoteRow, error: null }) }),
      order: () => ({ range: async () => ({ data: [remoteRow], error: null }) }),
    }) })
    await expect(actions.assignToRoom(free.id, room.id)).rejects.toThrow('changed on the server')
    expect(useInventory.getState().pending[0].status).toBe('conflict')
    expect(useInventory.getState().rows[0].assignment_room_id).toBe('another-room')
  })
})

describe('online device registration', () => {
  const request = buildDevice({ ...emptyDevice, category: 'Printer', tag: 'PRN-NEW', brand: 'HP', model: 'LaserJet' }, [], { id: 'new-device', qrId: 'LIV-12345678' })
  const created = { ...request, updated_at: 'new-version' }
  function online() { mocks.fetch.mockResolvedValue({ isConnected: true, isInternetReachable: true }); mocks.verify.mockResolvedValue({ id: 'user-1' }) }
  function remote() {
    const find = vi.fn().mockResolvedValue({ data: null, error: null })
    const insert = vi.fn().mockReturnValue({ select: () => ({ single: async () => ({ data: created, error: null }) }) })
    mocks.from.mockReturnValue({ select: () => ({ eq: () => ({ maybeSingle: find }) }), insert })
    return { find, insert }
  }
  it('does not queue registrations or consume stock while offline', async () => {
    await expect(actions.registerDevice(request)).rejects.toThrow('Connect to the internet')
    expect(mocks.from).not.toHaveBeenCalled()
    expect(useInventory.getState().pending).toEqual([])
  })
  it('requires current administrator verification before inserting', async () => {
    online(); mocks.verify.mockRejectedValueOnce(new AccessDeniedError('Revoked'))
    await expect(actions.registerDevice(request)).rejects.toThrow('Revoked')
    expect(mocks.from).not.toHaveBeenCalled()
  })
  it('makes a confirmed new device available immediately and persists its offline copy', async () => {
    online(); const api = remote()
    expect(await actions.registerDevice(request)).toEqual(created)
    expect(api.insert).toHaveBeenCalledWith(request)
    expect(useInventory.getState().rows).toEqual([created, row])
    expect(JSON.parse(mocks.saved.get('inventory:user-1')!).rows[0]).toEqual(created)
  })
  it('does not misreport a committed insert as failed if offline caching fails', async () => {
    online(); remote(); mocks.setItem.mockRejectedValueOnce(new Error('Disk full'))
    expect(await actions.registerDevice(request)).toEqual(created)
    expect(useInventory.getState().rows[0]).toEqual(created)
    expect(useInventory.getState().error).toContain('Device saved online')
  })
})
