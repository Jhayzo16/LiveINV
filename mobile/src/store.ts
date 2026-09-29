import { create } from 'zustand'
import { QueryClient } from '@tanstack/react-query'
import NetInfo from '@react-native-community/netinfo'
import * as Crypto from 'expo-crypto'
import { supabase, verifyAdmin, AccessDeniedError } from './supabase'
import { readStored, storage } from './storage'
import type { AssetRow, AssetPatch, PendingChange } from './domain'
import { applyChange } from './sync'
import { authErrorMessage } from './auth-errors'
import { saveRegistration, type DeviceInsert, type StockReceipt } from './registration'

export const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1 } } })
type Snapshot = { rows: AssetRow[]; pending: PendingChange[]; lastSync: string | null; authorizedAt: number }
type State = Snapshot & {
  userId: string | null; email: string; status: 'loading' | 'signedOut' | 'ready' | 'locked';
  online: boolean; busy: boolean; error: string | null;
}
const blank: Snapshot = { rows: [], pending: [], lastSync: null, authorizedAt: 0 }
export const useInventory = create<State>(() => ({ ...blank, userId: null, email: '', status: 'loading', online: true, busy: false, error: null }))
const key = (userId: string) => `inventory:${userId}`
const maxOfflineAge = 8 * 60 * 60 * 1000
let jobs: Promise<unknown> = Promise.resolve()
let refreshing: Promise<void> | null = null
function serial<T>(fn: () => Promise<T>): Promise<T> {
  const task = jobs.then(fn, fn)
  jobs = task.catch(() => undefined)
  return task
}
const message = (error: unknown) => error instanceof Error ? error.message : 'Something went wrong. Please retry.'
async function connected() {
  const net = await NetInfo.fetch()
  const online = net.isConnected !== false && net.isInternetReachable !== false
  useInventory.setState({ online })
  return online
}
async function persist(next: Snapshot) {
  const userId = useInventory.getState().userId
  if (!userId) throw new Error('Sign in before saving changes.')
  await storage.setItem(key(userId), JSON.stringify(next))
  useInventory.setState(next)
}
function snapshot(): Snapshot {
  const { rows, pending, lastSync, authorizedAt } = useInventory.getState()
  return { rows, pending, lastSync, authorizedAt }
}
async function verifyAccess(userId: string) {
  try { return await verifyAdmin(userId) }
  catch (error) {
    if (error instanceof AccessDeniedError) {
      const cached = await readStored<Snapshot>(key(userId))
      if (cached) await storage.setItem(key(userId), JSON.stringify({ ...cached, authorizedAt: 0 }))
      if (useInventory.getState().userId === userId) useInventory.setState({ authorizedAt: 0 })
    }
    throw error
  }
}
async function fetchRows() {
  const rows: AssetRow[] = []
  for (let offset = 0; ; offset += 500) {
    const { data, error } = await supabase.from('assets').select('*').order('id').range(offset, offset + 499)
    if (error) throw new Error('Could not refresh the shared inventory. Your saved copy is still available.')
    rows.push(...data as AssetRow[])
    if (data.length < 500) return rows
  }
}
export const actions = {
  async loadRegistrationStock(): Promise<StockReceipt[]> {
    if (!await connected()) throw new Error('Connect to load available RAM and SSD stock.')
    const receipts: StockReceipt[] = []
    for (let offset = 0; ; offset += 500) {
      const { data, error } = await supabase.from('consumable_receipts').select('*').in('category', ['RAM', 'SSD']).eq('unit', 'pieces').order('id').range(offset, offset + 499)
      if (error) throw new Error('Could not load consumable stock. Check your connection and retry.')
      receipts.push(...data as StockReceipt[])
      if (data.length < 500) return receipts
    }
  },
  async registerDevice(request: DeviceInsert): Promise<AssetRow> {
    return serial(async () => {
      const { userId, status } = useInventory.getState()
      if (!userId || status !== 'ready') throw new Error('Sign in before adding a device.')
      if (!await connected()) throw new Error('Connect to the internet to save a new device.')
      await verifyAccess(userId)
      const row = await saveRegistration({
        async find(id) {
          const { data, error } = await supabase.from('assets').select('*').eq('id', id).maybeSingle()
          if (error) throw error
          return data as AssetRow | null
        },
        async insert(device) {
          // The existing database trigger deducts linked stock in this same transaction.
          const { data, error } = await supabase.from('assets').insert(device).select('*').single()
          if (error) throw error
          if (!data) throw new Error('No confirmation received.')
          return data as AssetRow
        },
      }, request)
      const next = { ...snapshot(), rows: [row, ...useInventory.getState().rows.filter(item => item.id !== row.id)], authorizedAt: Date.now() }
      try { await persist(next) }
      catch {
        // Registration is already committed; never report it as a failed insert.
        useInventory.setState({ ...next, error: 'Device saved online, but the offline copy could not be updated. Refresh inventory when possible.' })
      }
      void queryClient.invalidateQueries({ queryKey: ['registration-stock'] })
      return row
    })
  },
  async restore() {
    await serial(async () => {
      useInventory.setState({ status: 'loading', error: null })
      try {
        const online = await connected()
        if (!online) {
          const identity = await readStored<{ id: string; email: string }>('active-identity')
          const cached = identity && await readStored<Snapshot>(key(identity.id))
          if (!identity || !cached?.authorizedAt || Date.now() - cached.authorizedAt > maxOfflineAge || cached.authorizedAt > Date.now()) {
            throw new Error('Connect to the internet to sign in or renew your access. Offline access lasts up to eight hours after verification.')
          }
          useInventory.setState({ ...cached, userId: identity.id, email: identity.email, status: 'ready', error: null })
          return
        }
        const { data, error } = await supabase.auth.getSession()
        if (error) throw new Error(authErrorMessage(error))
        if (!data.session) { useInventory.setState({ ...blank, userId: null, status: 'signedOut' }); return }
        const { user } = data.session
        const cached = await readStored<Snapshot>(key(user.id))
        await verifyAccess(user.id)
        const authorizedAt = Date.now()
        await storage.setItem('active-identity', JSON.stringify({ id: user.id, email: user.email || '' }))
        useInventory.setState({ ...(cached || blank), userId: user.id, email: user.email || '', authorizedAt, status: 'ready', error: null })
      } catch (error) {
        useInventory.setState({ status: 'locked', error: message(error) })
      }
    })
    if (useInventory.getState().status === 'ready' && useInventory.getState().online) await actions.refresh()
  },
  async login(email: string, password: string) {
    await serial(async () => {
      if (!await connected()) throw new Error('Connect to the internet to sign in.')
      useInventory.setState({ status: 'signedOut', error: null })
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (error) throw new Error(authErrorMessage(error))
    })
    await actions.restore()
  },
  async logout() {
    return serial(async () => {
      const { userId } = useInventory.getState()
      const { error } = await supabase.auth.signOut({ scope: 'local' })
      if (error) throw new Error('Could not sign out. Please retry.')
      if (userId) await storage.removeItem(key(userId))
      await storage.removeItem('active-identity')
      queryClient.clear()
      useInventory.setState({ ...blank, userId: null, email: '', status: 'signedOut', error: null, busy: false })
    })
  },
  async refresh() {
    if (refreshing) return refreshing
    refreshing = serial(async () => {
      const { userId, status } = useInventory.getState()
      if (!userId || status !== 'ready') return
      useInventory.setState({ busy: true, error: null })
      try {
        if (!await connected()) return
        try { await verifyAccess(userId) } catch (error) {
          useInventory.setState({ status: 'locked' })
          throw error
        }
        await persist({ ...snapshot(), authorizedAt: Date.now() })
        const remote = {
          async update(change: PendingChange) {
            const { data, error } = await supabase.from('assets').update(change.patch)
              .eq('id', change.assetId).eq('updated_at', change.baseVersion).select('*').maybeSingle()
            if (error) throw new Error(error.message)
            return data as AssetRow | null
          },
          async get(id: string) {
            const { data, error } = await supabase.from('assets').select('*').eq('id', id).maybeSingle()
            if (error) throw new Error(error.message)
            return data as AssetRow | null
          },
        }
        for (const change of [...useInventory.getState().pending]) {
          if (change.status === 'conflict') continue
          try {
            const result = await applyChange(remote, userId, change)
            const current = snapshot()
            if (result.status === 'saved') {
              await persist({ ...current, rows: current.rows.map(row => row.id === result.row.id ? result.row : row), pending: current.pending.filter(item => item.id !== change.id) })
            } else {
              await persist({ ...current, pending: current.pending.map(item => item.id === change.id ? { ...item, status: 'conflict', message: 'This asset changed on the server. Discard this pending change, refresh, and review the latest record before editing again.' } : item) })
            }
          } catch (error) {
            await persist({ ...snapshot(), pending: useInventory.getState().pending.map(item => item.id === change.id ? { ...item, status: 'error', message: message(error) } : item) })
            throw error
          }
        }
        const rows = await queryClient.fetchQuery({ queryKey: ['assets', userId], queryFn: fetchRows, staleTime: 0 })
        await persist({ ...snapshot(), rows, lastSync: new Date().toISOString() })
      } catch (error) { useInventory.setState({ error: message(error) }) }
      finally { useInventory.setState({ busy: false }) }
    }).finally(() => { refreshing = null })
    return refreshing
  },
  async queue(row: AssetRow, patch: AssetPatch) {
    await serial(async () => {
      const state = useInventory.getState()
      if (!state.userId || state.status !== 'ready') throw new Error('Sign in before editing inventory.')
      if (Date.now() - state.authorizedAt > maxOfflineAge || state.authorizedAt > Date.now()) throw new Error('Reconnect and refresh to renew your access before editing.')
      if (state.pending.some(change => change.assetId === row.id)) throw new Error('Sync or discard the pending change for this asset before editing it again.')
      if (!Object.keys(patch).length) return
      const change: PendingChange = { id: Crypto.randomUUID(), userId: state.userId, assetId: row.id, tag: row.tag,
        baseVersion: row.updated_at, patch, createdAt: new Date().toISOString(), status: 'pending' }
      // Durable storage must succeed before the UI acknowledges the change.
      await persist({ ...snapshot(), pending: [...state.pending, change] })
    })
    void actions.refresh()
  },
  async discard(id: string) {
    await serial(() => persist({ ...snapshot(), pending: useInventory.getState().pending.filter(change => change.id !== id) }))
    void actions.refresh()
  },
}
