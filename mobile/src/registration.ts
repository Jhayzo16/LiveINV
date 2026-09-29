import { validIp, type AssetRow } from './domain'
import { consumableCapacityGb } from './shared/consumable-capacity'

export const deviceCategories = ['System Unit', 'Printer', 'Monitor', 'Keyboard', 'UPS', 'Scanner', 'Router'] as const
export const deviceStates = ['Active', 'Maintenance', 'Broken', 'Inactive'] as const
export type StockReceipt = {
  id: string; category: string; item_name: string; specification: string; unit: string;
  quantity: number; used_quantity?: number; capacity_gb?: number | null; date_received: string; reference_number?: string | null;
}
export type DeviceForm = {
  tag: string; category: string; brand: string; model: string; state: AssetRow['state']; ip: string; processor: string;
  ramReceiptId: string; ramModules: string; ssdReceiptId: string; ssdCount: string;
}
export const emptyDevice: DeviceForm = { tag: '', category: 'System Unit', brand: '', model: '', state: 'Active', ip: '', processor: '', ramReceiptId: '', ramModules: '0', ssdReceiptId: '', ssdCount: '0' }
export type DeviceInsert = Omit<AssetRow, 'updated_at'> & { ram_receipt_id?: string; ssd_receipt_id?: string }
export const receiptCapacity = (receipt: StockReceipt) => consumableCapacityGb({ capacityGb: receipt.capacity_gb ?? undefined, specification: receipt.specification, itemName: receipt.item_name })
export const availableStock = (receipt: StockReceipt) => Math.max(0, receipt.quantity - (receipt.used_quantity ?? receipt.quantity))
export const supportsIp = (category: string) => ['System Unit', 'Printer', 'Router'].includes(category)

export function buildDevice(form: DeviceForm, stock: StockReceipt[], identity: { id: string; qrId: string }): DeviceInsert {
  const tag = form.tag.trim().toUpperCase()
  const brand = form.brand.trim(), model = form.model.trim()
  if (!tag || tag.length > 50) throw new Error('Enter an asset tag of 1–50 characters.')
  if (!deviceCategories.some(category => category === form.category)) throw new Error('Choose a device category.')
  if (!brand || !model) throw new Error('Brand and model are required.')
  if (brand.length > 100 || model.length > 100) throw new Error('Keep brand and model to 100 characters each.')
  if (!deviceStates.includes(form.state)) throw new Error('Choose a valid status.')
  const ip = supportsIp(form.category) ? form.ip.trim() || '—' : '—'
  if (!validIp(ip)) throw new Error('Enter a valid IPv4 address, or leave it blank.')
  const row: DeviceInsert = {
    id: identity.id, qr_id: identity.qrId, tag, name: `${brand} ${model}`, category: form.category, brand, model, state: form.state, ip,
    location: 'Unassigned', owner: 'Unassigned', processor: null, ram_capacity_gb: null, ram_modules: null, ssd_capacity_gb: null, ssd_count: null,
    assignment_floor_id: null, assignment_room_id: null, assignment_room_name: null, assignment_department_id: null,
    assigned_at: null, assigned_by: null, assignment_method: null,
  }
  if (form.category === 'System Unit') {
    if (!form.processor.trim()) throw new Error('Enter the processor model for this system unit.')
    if (form.processor.trim().length > 255) throw new Error('Keep the processor model to 255 characters.')
    row.processor = form.processor.trim()
    for (const kind of ['ram', 'ssd'] as const) {
      const source = kind === 'ram' ? form.ramReceiptId : form.ssdReceiptId
      const input = kind === 'ram' ? form.ramModules : form.ssdCount
      const count = Number(input)
      if (!/^\d+$/.test(input.trim()) || !Number.isSafeInteger(count) || count > 2147483647) throw new Error(`Enter a whole number for ${kind.toUpperCase()} quantity.`)
      if (!source && count !== 0) throw new Error(`Select ${kind.toUpperCase()} stock before entering an installed quantity.`)
      let capacity = 0
      if (source) {
        const receipt = stock.find(item => item.id === source)
        if (!receipt || receipt.category !== kind.toUpperCase() || receipt.unit !== 'pieces' || receipt.used_quantity === undefined) throw new Error(`Refresh and select a valid ${kind.toUpperCase()} stock receipt.`)
        capacity = receiptCapacity(receipt) || 0
        if (!capacity) throw new Error(`The selected ${kind.toUpperCase()} has no recorded capacity. Choose another receipt.`)
        if (count < 1 || count > availableStock(receipt)) throw new Error(`Enter a ${kind.toUpperCase()} quantity between 1 and ${availableStock(receipt)} available pieces.`)
        if (kind === 'ram') row.ram_receipt_id = source
        else row.ssd_receipt_id = source
      }
      if (kind === 'ram') { row.ram_capacity_gb = capacity; row.ram_modules = count }
      else { row.ssd_capacity_gb = capacity; row.ssd_count = count }
    }
  }
  return row
}

export class RegistrationError extends Error {
  constructor(message: string, readonly uncertain = false) { super(message) }
}
type Remote = { find: (id: string) => Promise<AssetRow | null>; insert: (row: DeviceInsert) => Promise<AssetRow> }

// A fixed ID makes retries safe even when the server committed but its response was lost.
export async function saveRegistration(remote: Remote, request: DeviceInsert): Promise<AssetRow> {
  let existing: AssetRow | null
  try { existing = await remote.find(request.id) }
  catch { throw new RegistrationError('Could not check this registration. Reconnect and retry the same save.', true) }
  if (existing) return existing
  try { return await remote.insert(request) }
  catch (error) {
    let lookupFailed = false
    try { const saved = await remote.find(request.id); if (saved) return saved } catch { lookupFailed = true }
    const failure = error as { code?: string; message?: string }
    if (failure.code === '23505' && lookupFailed) throw new RegistrationError('Could not confirm whether the original device was saved. Reconnect and retry the same save.', true)
    if (failure.code === '23505') throw new RegistrationError('This asset tag or QR identifier already exists. Check the inventory and use a unique tag.')
    if (failure.code === '42501' || failure.code === 'PGRST301') throw new RegistrationError('Your account cannot add devices. Sign in with an approved administrator account.')
    if (failure.code === 'PGRST204' || failure.code === '42703') throw new RegistrationError('The database needs the system-unit stock update before linked parts can be saved.')
    if (failure.code === 'P0001') throw new RegistrationError(failure.message || 'The selected stock is no longer available. Refresh stock and retry.')
    if (failure.code && /^(22|23)/.test(failure.code)) throw new RegistrationError('Some device details were rejected. Check the field lengths and quantities, then retry.')
    throw new RegistrationError('The save could not be confirmed. Keep these details and retry to check whether the device was saved.', true)
  }
}
