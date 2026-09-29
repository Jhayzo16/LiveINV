import { afterEach, describe, expect, it, vi } from 'vitest'
import { readStored, storage } from '../src/storage.web'

afterEach(() => vi.unstubAllGlobals())
describe('browser preview storage', () => {
  it('supports server evaluation without accessing native storage or window', async () => {
    vi.stubGlobal('window', undefined)
    expect(await storage.getItem('session')).toBeNull()
    await expect(storage.setItem('session', 'value')).resolves.toBeUndefined()
  })
  it('namespaces session data and removes only the requested record', async () => {
    const data = new Map<string, string>([['another-app', 'keep']])
    vi.stubGlobal('window', { sessionStorage: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    } })
    await storage.setItem('inventory:user', JSON.stringify({ rows: [] }))
    expect(data.has('liveinv-mobile:inventory:user')).toBe(true)
    expect(await readStored('inventory:user')).toEqual({ rows: [] })
    await storage.removeItem('inventory:user')
    expect(await readStored('inventory:user')).toBeNull()
    expect(data.get('another-app')).toBe('keep')
  })
  it('surfaces denied browser storage rather than claiming a durable save', async () => {
    vi.stubGlobal('window', { sessionStorage: { setItem: () => { throw new Error('Storage blocked') } } })
    await expect(storage.setItem('session', 'value')).rejects.toThrow('Storage blocked')
  })
})
