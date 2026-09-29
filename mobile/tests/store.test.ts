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

const row = { id: 'asset-1', tag: 'PC-1', updated_at: 'version-1', state: 'Active' } as AssetRow
beforeEach(() => {
  vi.clearAllMocks(); mocks.saved.clear(); queryClient.clear()
  mocks.fetch.mockResolvedValue({ isConnected: false, isInternetReachable: false })
  mocks.setItem.mockImplementation(async (key: string, value: string) => { mocks.saved.set(key, value) })
  mocks.signOut.mockResolvedValue({ error: null })
  useInventory.setState({ userId: 'user-1', email: 'admin@example.test', status: 'ready', rows: [row], pending: [], lastSync: null, authorizedAt: Date.now(), busy: false, error: null, online: false })
})
async function settle() { await actions.refresh() }
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
