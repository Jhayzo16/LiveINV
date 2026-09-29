import { describe, expect, it, vi } from 'vitest'
import { buildDevice, emptyDevice, saveRegistration, type StockReceipt } from '../src/registration'
import type { AssetRow } from '../src/domain'

const identity = { id: 'new-id', qrId: 'LIV-12345678' }
const form = { ...emptyDevice, tag: ' pc-100 ', brand: ' Dell ', model: ' OptiPlex ', processor: 'Intel Core i5' }
const stock: StockReceipt[] = [{ id: 'ram-1', category: 'RAM', item_name: 'DDR4', specification: '8GB DDR4', unit: 'pieces', quantity: 5, used_quantity: 3, date_received: '2026-09-01' }]

describe('device registration', () => {
  it('normalizes identity and begins unassigned without consuming unspecified stock', () => {
    const row = buildDevice(form, [], identity)
    expect(row).toMatchObject({ id: 'new-id', qr_id: 'LIV-12345678', tag: 'PC-100', name: 'Dell OptiPlex', location: 'Unassigned', owner: 'Unassigned', assignment_room_id: null, ram_modules: 0, ssd_count: 0 })
    expect(row).not.toHaveProperty('ram_receipt_id')
  })
  it('uses the receipt capacity and sends a stock link for atomic deduction', () => {
    expect(buildDevice({ ...form, ramReceiptId: 'ram-1', ramModules: '2' }, stock, identity)).toMatchObject({ ram_receipt_id: 'ram-1', ram_capacity_gb: 8, ram_modules: 2 })
  })
  it('rejects insufficient stock, wrong part types, and negative quantities', () => {
    expect(() => buildDevice({ ...form, ramReceiptId: 'ram-1', ramModules: '3' }, stock, identity)).toThrow('between 1 and 2')
    expect(() => buildDevice({ ...form, ssdReceiptId: 'ram-1', ssdCount: '1' }, stock, identity)).toThrow('valid SSD')
    expect(() => buildDevice({ ...form, ramModules: '-1' }, stock, identity)).toThrow('whole number')
    expect(() => buildDevice({ ...form, ramModules: '1' }, stock, identity)).toThrow('Select RAM stock')
  })
  it('requires readable stock usage and capacity', () => {
    expect(() => buildDevice({ ...form, ramReceiptId: 'ram-1', ramModules: '1' }, [{ ...stock[0], used_quantity: undefined }], identity)).toThrow('valid RAM')
    expect(() => buildDevice({ ...form, ramReceiptId: 'ram-1', ramModules: '1' }, [{ ...stock[0], specification: 'Unknown capacity' }], identity)).toThrow('no recorded capacity')
  })
  it('validates required details and supported IP addresses', () => {
    expect(() => buildDevice({ ...form, brand: ' ' }, [], identity)).toThrow('Brand and model')
    expect(() => buildDevice({ ...form, processor: ' ' }, [], identity)).toThrow('processor')
    expect(() => buildDevice({ ...form, ip: '256.0.0.1' }, [], identity)).toThrow('IPv4')
  })
  it('drops hidden system-unit details and unsupported IP on category changes', () => {
    const row = buildDevice({ ...form, category: 'Monitor', ramReceiptId: 'ram-1', ramModules: '2', ip: 'invalid' }, stock, identity)
    expect(row).toMatchObject({ processor: null, ram_modules: null, ip: '—' })
    expect(row).not.toHaveProperty('ram_receipt_id')
  })
})

describe('registration retry safety', () => {
  const request = buildDevice(form, [], identity)
  const saved = { ...request, updated_at: '2026-09-29' } as AssetRow
  it('returns the original registration without another insert on retry', async () => {
    const remote = { find: vi.fn().mockResolvedValue(saved), insert: vi.fn() }
    expect(await saveRegistration(remote, request)).toEqual(saved)
    expect(remote.insert).not.toHaveBeenCalled()
  })
  it('recovers a committed save whose network response was lost', async () => {
    const remote = { find: vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(saved), insert: vi.fn().mockRejectedValue(new Error('timeout')) }
    expect(await saveRegistration(remote, request)).toEqual(saved)
    expect(remote.insert).toHaveBeenCalledTimes(1)
  })
  it('keeps an ambiguous failure retryable with the same request', async () => {
    const remote = { find: vi.fn().mockResolvedValue(null), insert: vi.fn().mockRejectedValue(new Error('timeout')) }
    await expect(saveRegistration(remote, request)).rejects.toMatchObject({ uncertain: true })
  })
  it('reports duplicate tags and server stock rejection without masking either as success', async () => {
    const remote = { find: vi.fn().mockResolvedValue(null), insert: vi.fn().mockRejectedValue({ code: '23505' }) }
    await expect(saveRegistration(remote, request)).rejects.toMatchObject({ uncertain: false, message: expect.stringContaining('already exists') })
    remote.insert.mockRejectedValue({ code: 'P0001', message: 'Not enough RAM stock available.' })
    await expect(saveRegistration(remote, request)).rejects.toMatchObject({ uncertain: false, message: 'Not enough RAM stock available.' })
  })
})
