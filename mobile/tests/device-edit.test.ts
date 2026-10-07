import { describe, expect, it, vi } from 'vitest'
import { buildDeviceEdit, editDeviceForm, removedParts, saveDeviceEdit } from '../src/device-edit'
import type { AssetRow } from '../src/domain'
import type { StockReceipt } from '../src/registration'

const base = { id: 'pc-id', tag: 'PC-1', qr_id: 'LIV-1', name: 'HP 101', category: 'System Unit', state: 'Active', brand: 'HP', model: '101', ip: '192.168.1.1', processor: 'Intel Core i5',
  ram_receipt_id: 'ram-1', ram_capacity_gb: 8, ram_modules: 2, ssd_receipt_id: null, ssd_count: 1, ssd_capacity_gb: 256,
  stock_version: 3, updated_at: 'version-1', location: 'F1 · IT', owner: 'IT', assignment_room_id: 'room-1' } as AssetRow
const stock: StockReceipt[] = [{ id: 'ram-1', category: 'RAM', item_name: 'DDR4', specification: '8GB DDR4', unit: 'pieces', quantity: 10, used_quantity: 9, date_received: '2026-09-01', capacity_gb: 8 },
  { id: 'ram-2', category: 'RAM', item_name: 'DDR5', specification: '16GB DDR5', unit: 'pieces', quantity: 10, used_quantity: 5, date_received: '2026-09-01', capacity_gb: 16 }]
const form = editDeviceForm(base)
describe('device editor matches web fields and stock rules', () => {
  it('preserves identity, assignments and legacy parts by omitting protected fields from the patch', () => {
    const patch = buildDeviceEdit(base, { ...form, brand: ' Dell ', model: ' OptiPlex ' }, [])
    expect(patch).toMatchObject({ brand: 'Dell', model: 'OptiPlex', name: 'Dell OptiPlex', ram_modules: 2, ram_receipt_id: 'ram-1', ssd_count: 1, ssd_capacity_gb: 256, stock_version: 3 })
    for (const field of ['id', 'tag', 'qr_id', 'location', 'owner', 'assignment_room_id', 'assigned_by', 'updated_at']) expect(patch).not.toHaveProperty(field)
  })
  it('credits installed quantities when checking additional stock', () => {
    expect(buildDeviceEdit(base, { ...form, ramModules: '3' }, stock).ram_modules).toBe(3)
    expect(() => buildDeviceEdit(base, { ...form, ramModules: '4' }, stock)).toThrow('Only 1 additional')
    expect(buildDeviceEdit(base, form, [{ ...stock[0], used_quantity: 10 }]).ram_modules).toBe(2)
  })
  it('requires a return/discard decision when reducing or replacing linked parts', () => {
    expect(removedParts(base, { ...form, ramModules: '1' }, 'RAM')).toBe(1)
    expect(() => buildDeviceEdit(base, { ...form, ramModules: '1' }, stock)).toThrow('return removed RAM')
    expect(buildDeviceEdit(base, { ...form, ramModules: '1', returnRam: 'return' }, stock)).toMatchObject({ ram_modules: 1, return_ram_to_stock: true })
    expect(buildDeviceEdit(base, { ...form, ramReceiptId: 'ram-2', returnRam: 'discard' }, stock)).toMatchObject({ ram_receipt_id: 'ram-2', ram_capacity_gb: 16, return_ram_to_stock: false })
  })
  it('removes links and system specifications on a category change while requiring removed-part disposition', () => {
    expect(() => buildDeviceEdit(base, { ...form, category: 'Monitor' }, stock)).toThrow('return removed RAM')
    expect(buildDeviceEdit(base, { ...form, category: 'Monitor', returnRam: 'return' }, stock)).toMatchObject({ category: 'Monitor', processor: null, ip: '—', ram_receipt_id: null, ram_capacity_gb: null, ram_modules: null, ssd_count: null, return_ram_to_stock: true })
  })
  it('unlinks a stock source when its installed quantity becomes zero', () => {
    expect(buildDeviceEdit(base, { ...form, ramModules: '0', returnRam: 'discard' }, stock)).toMatchObject({ ram_receipt_id: null, ram_modules: 0, return_ram_to_stock: false })
  })
  it('rejects invalid details and prevents adding unbacked parts to an empty device', () => {
    expect(() => buildDeviceEdit(base, { ...form, brand: '' }, stock)).toThrow('brand and model')
    expect(() => buildDeviceEdit(base, { ...form, processor: '' }, stock)).toThrow('processor')
    expect(() => buildDeviceEdit(base, { ...form, ip: '999.1.1.1' }, stock)).toThrow('IPv4')
    expect(() => buildDeviceEdit(base, { ...form, ramModules: '-1' }, stock)).toThrow('whole number')
    const empty = { ...base, ram_receipt_id: null, ram_modules: 0, ram_capacity_gb: 0 }
    expect(() => buildDeviceEdit(empty, { ...editDeviceForm(empty), ramModules: '1' }, stock)).toThrow('Choose RAM stock')
  })
})
describe('device-edit save and retry safety', () => {
  const patch = buildDeviceEdit(base, { ...form, ramModules: '3' }, stock)
  const request = { base, patch }
  const saved = { ...base, ...patch, stock_version: 4, updated_at: 'version-2', return_ram_to_stock: false }
  it('uses the original version and returns a confirmed row', async () => {
    const remote = { get: vi.fn().mockResolvedValue(base), update: vi.fn().mockResolvedValue(saved) }
    expect(await saveDeviceEdit(remote, request)).toBe(saved)
    expect(remote.update).toHaveBeenCalledWith(request)
  })
  it('does not write again after a committed save whose response was lost', async () => {
    const remote = { get: vi.fn().mockResolvedValueOnce(base).mockResolvedValue(saved), update: vi.fn().mockRejectedValue(new Error('timeout')) }
    expect(await saveDeviceEdit(remote, request)).toBe(saved)
    expect(await saveDeviceEdit(remote, request)).toBe(saved)
    expect(remote.update).toHaveBeenCalledTimes(1)
  })
  it('ignores reset return flags and incremented stock version on successful readback', async () => {
    const removed = buildDeviceEdit(base, { ...form, ramModules: '1', returnRam: 'return' }, stock)
    const remote = { get: vi.fn().mockResolvedValue({ ...base, ...removed, stock_version: 4, return_ram_to_stock: false, updated_at: 'version-2' }), update: vi.fn() }
    await saveDeviceEdit(remote, { base, patch: removed })
    expect(remote.update).not.toHaveBeenCalled()
  })
  it('rejects stale edits rather than overwriting another user', async () => {
    const remote = { get: vi.fn().mockResolvedValue({ ...base, model: 'changed', updated_at: 'new' }), update: vi.fn() }
    await expect(saveDeviceEdit(remote, request)).rejects.toThrow('another session')
    expect(remote.update).not.toHaveBeenCalled()
  })
  it('handles a race between reading and writing the original version', async () => {
    const remote = { get: vi.fn().mockResolvedValueOnce(base).mockResolvedValue({ ...base, model: 'changed', updated_at: 'new' }), update: vi.fn().mockResolvedValue(null) }
    await expect(saveDeviceEdit(remote, request)).rejects.toThrow('another session')
  })
  it('keeps an ambiguous response retryable and reports definite stock rejection', async () => {
    const remote = { get: vi.fn().mockResolvedValue(base), update: vi.fn().mockRejectedValue(new Error('timeout')) }
    await expect(saveDeviceEdit(remote, request)).rejects.toMatchObject({ uncertain: true })
    remote.update.mockRejectedValue({ code: 'P0001', message: 'Not enough RAM stock' })
    await expect(saveDeviceEdit(remote, request)).rejects.toMatchObject({ uncertain: false, message: 'Not enough RAM stock' })
  })
})
