import type { AssetRow } from './domain'
import { validIp } from './domain'
import { availableStock, deviceCategories, deviceStates, receiptCapacity, supportsIp, type StockReceipt } from './registration'

export type EditDeviceForm = {
  category: string; brand: string; model: string; state: AssetRow['state']; ip: string; processor: string;
  ramReceiptId: string; ramModules: string; ssdReceiptId: string; ssdCount: string;
  returnRam: '' | 'return' | 'discard'; returnSsd: '' | 'return' | 'discard';
}
export type DeviceEditPatch = Pick<AssetRow, 'category' | 'name' | 'brand' | 'model' | 'state' | 'ip' | 'processor' | 'ram_capacity_gb' | 'ram_modules' | 'ssd_capacity_gb' | 'ssd_count'> & {
  ram_receipt_id?: string | null; ssd_receipt_id?: string | null; stock_version?: number;
  return_ram_to_stock?: boolean; return_ssd_to_stock?: boolean;
}
export type DeviceEditRequest = { base: AssetRow; patch: DeviceEditPatch }
export const editDeviceForm = (row: AssetRow): EditDeviceForm => ({
  category: row.category, brand: row.brand || '', model: row.model || '', state: row.state,
  ip: row.ip === '—' ? '' : row.ip, processor: row.processor || '',
  ramReceiptId: row.ram_receipt_id || '', ramModules: String(row.ram_modules ?? 0),
  ssdReceiptId: row.ssd_receipt_id || '', ssdCount: String(row.ssd_count ?? 0), returnRam: '', returnSsd: '',
})
export function removedParts(base: AssetRow, form: EditDeviceForm, kind: 'RAM' | 'SSD') {
  const source = kind === 'RAM' ? base.ram_receipt_id : base.ssd_receipt_id
  const count = (kind === 'RAM' ? base.ram_modules : base.ssd_count) || 0
  if (!source) return 0
  const nextSource = kind === 'RAM' ? form.ramReceiptId : form.ssdReceiptId
  const nextCount = Number(kind === 'RAM' ? form.ramModules : form.ssdCount)
  return form.category !== 'System Unit' || nextSource !== source ? count : Math.max(0, count - nextCount)
}
export function buildDeviceEdit(base: AssetRow, form: EditDeviceForm, stock: StockReceipt[]): DeviceEditPatch {
  const brand = form.brand.trim(), model = form.model.trim()
  if (!brand || !model || brand.length > 100 || model.length > 100) throw new Error('Enter a brand and model, up to 100 characters each.')
  if (!deviceCategories.some(item => item === form.category) || !deviceStates.includes(form.state)) throw new Error('Select a valid device category and status.')
  const ip = supportsIp(form.category) ? form.ip.trim() || '—' : '—'
  if (!validIp(ip)) throw new Error('Enter a valid IPv4 address, or leave it blank.')
  const system = form.category === 'System Unit'
  if (system && (!form.processor.trim() || form.processor.trim().length > 255)) throw new Error('Enter a processor model, up to 255 characters.')
  const patch: DeviceEditPatch = { category: form.category, brand, model, name: `${brand} ${model}`, state: form.state, ip,
    processor: system ? form.processor.trim() : null, ram_capacity_gb: null, ram_modules: null, ssd_capacity_gb: null, ssd_count: null }
  for (const kind of ['RAM', 'SSD'] as const) {
    const ram = kind === 'RAM'
    const oldSource = (ram ? base.ram_receipt_id : base.ssd_receipt_id) || null
    const oldCount = (ram ? base.ram_modules : base.ssd_count) || 0
    const oldCapacity = (ram ? base.ram_capacity_gb : base.ssd_capacity_gb) || 0
    const input = ram ? form.ramModules : form.ssdCount
    const count = system ? Number(input) : 0
    if (system && (!/^\d+$/.test(input.trim()) || !Number.isSafeInteger(count) || count > 2147483647)) throw new Error(`Enter a whole number for ${kind} quantity.`)
    const chosenSource = ram ? form.ramReceiptId : form.ssdReceiptId
    const source = system && count > 0 ? chosenSource || null : null
    let capacity = 0
    if (source) {
      const receipt = stock.find(item => item.id === source)
      if (source === oldSource && count <= oldCount) capacity = oldCapacity
      else {
        if (!receipt || receipt.category !== kind || receipt.unit !== 'pieces' || receipt.used_quantity === undefined) throw new Error(`Refresh and select valid ${kind} stock.`)
        capacity = receiptCapacity(receipt) || 0
        if (!capacity) throw new Error(`The selected ${kind} has no recorded capacity.`)
        const additional = source === oldSource ? Math.max(0, count - oldCount) : count
        if (additional > availableStock(receipt)) throw new Error(`Not enough ${kind} stock available. Only ${availableStock(receipt)} additional pieces are available.`)
      }
      if (!capacity) throw new Error(`The installed ${kind} capacity is missing. Select a stock receipt with a recorded capacity.`)
    } else if (system && count > 0) {
      if (oldSource || oldCount < 1 || !oldCapacity) throw new Error(`Choose ${kind} stock before entering an installed quantity.`)
      capacity = oldCapacity // Existing unlinked parts follow the web editor's legacy behavior.
    }
    const removed = oldSource && (source !== oldSource || count < oldCount)
    const disposition = ram ? form.returnRam : form.returnSsd
    if (removed && !disposition) throw new Error(`Choose whether to return removed ${kind} to stock or keep it used/discarded.`)
    if (source || oldSource || chosenSource) {
      if (ram) patch.ram_receipt_id = source
      else patch.ssd_receipt_id = source
    }
    if (removed) {
      if (ram) patch.return_ram_to_stock = disposition === 'return'
      else patch.return_ssd_to_stock = disposition === 'return'
    }
    if (ram) { patch.ram_capacity_gb = system ? capacity : null; patch.ram_modules = system ? count : null }
    else { patch.ssd_capacity_gb = system ? capacity : null; patch.ssd_count = system ? count : null }
  }
  if (base.stock_version !== undefined) patch.stock_version = base.stock_version
  return patch
}
export class DeviceEditError extends Error {
  constructor(message: string, readonly uncertain = false) { super(message) }
}
const matches = (row: AssetRow, patch: DeviceEditPatch) => Object.entries(patch)
  .filter(([key]) => !['stock_version', 'return_ram_to_stock', 'return_ssd_to_stock'].includes(key))
  .every(([key, value]) => (row[key as keyof AssetRow] ?? null) === value)
type Remote = { get: (id: string) => Promise<AssetRow | null>; update: (request: DeviceEditRequest) => Promise<AssetRow | null> }

// Always compare the original version. A retry reads back the committed result
// before attempting another write, so installed parts cannot be deducted twice.
export async function saveDeviceEdit(remote: Remote, request: DeviceEditRequest): Promise<AssetRow> {
  let current: AssetRow | null
  try { current = await remote.get(request.base.id) }
  catch { throw new DeviceEditError('Could not check this device. Reconnect and retry the same save.', true) }
  if (!current) throw new DeviceEditError('This device no longer exists. Return to Assets and refresh.')
  if (matches(current, request.patch)) return current
  if (current.updated_at !== request.base.updated_at) throw new DeviceEditError('This device changed in another session. Close and reopen the editor to review the latest record.')
  let failure: { code?: string; message?: string } | undefined
  try { const saved = await remote.update(request); if (saved) return saved }
  catch (error) { failure = error as typeof failure }
  try { current = await remote.get(request.base.id) }
  catch { throw new DeviceEditError('The save could not be confirmed. Keep these details and retry the same save.', true) }
  if (current && matches(current, request.patch)) return current
  if (failure?.code) throw new DeviceEditError(failure.message || 'The device update was rejected. Check the details and retry.')
  if (!current || current.updated_at !== request.base.updated_at) throw new DeviceEditError('This device changed in another session. Close and reopen the editor to review the latest record.')
  throw new DeviceEditError('The save could not be confirmed. Keep these details and retry the same save.', true)
}
