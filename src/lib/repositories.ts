import { type ConsumableMovement, type ConsumableReceipt, type InventoryAsset } from './types'
import type { Database } from './database.types'
import { supabase } from './supabase'
import { formatAssetLocation } from './assignments'

const createQrId = () => `LIV-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`
const LOCAL_ASSET_OVERRIDES_KEY = 'liveinv-local-asset-overrides'

const readLocalOverrides = (): Record<string, InventoryAsset> => {
  if (typeof window === 'undefined') return {}
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOCAL_ASSET_OVERRIDES_KEY) || '{}')
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, InventoryAsset> : {}
  } catch {
    return {}
  }
}

const removeLocalOverride = (...tags: string[]) => {
  if (typeof window === 'undefined') return
  const overrides = readLocalOverrides()
  tags.forEach(tag => delete overrides[tag])
  window.localStorage.setItem(LOCAL_ASSET_OVERRIDES_KEY, JSON.stringify(overrides))
}

export const seedAssets: InventoryAsset[] = [
  { tag: 'PC-MRR-01', qrId: 'LIV-MRR0001', name: 'Dell OptiPlex 7090', category: 'System Unit', location: 'F5 · Medical Records', owner: 'IT Department', state: 'Active', ip: '10.20.5.31', brand: 'Dell', model: 'OptiPlex 7090', processor: 'Intel Core i5-10500', ramCapacityGb: 8, ramModules: 2, ssdCapacityGb: 512, ssdCount: 1 },
  { tag: 'PRN-ACC-02', qrId: 'LIV-ACC0002', name: 'HP LaserJet Pro M404', category: 'Printer', location: 'F5 · Accounting', owner: 'Finance', state: 'Maintenance', ip: '10.20.5.52', brand: 'HP', model: 'LaserJet Pro M404' },
  { tag: 'MON-HR-04', qrId: 'LIV-HR00004', name: 'Dell P2422H Display', category: 'Monitor', location: 'F5 · HR Office', owner: 'Human Resources', state: 'Active', ip: '—', brand: 'Dell', model: 'P2422H Display' },
  { tag: 'PC-ER-12', qrId: 'LIV-ER00012', name: 'Lenovo ThinkCentre M80', category: 'System Unit', location: 'F1 · E.R. RECEPTION', owner: 'Emergency', state: 'Broken', ip: '10.20.1.42', brand: 'Lenovo', model: 'ThinkCentre M80', processor: 'Intel Core i5-10500', ramCapacityGb: 8, ramModules: 2, ssdCapacityGb: 256, ssdCount: 1 },
  { tag: 'AP-OR-03', qrId: 'LIV-OR00003', name: 'Aruba AP-515', category: 'Router', location: 'F2 · Operating Room', owner: 'IT Department', state: 'Active', ip: '10.20.2.11', brand: 'Aruba', model: 'AP-515' },
  { tag: 'UPS-LAB-02', qrId: 'LIV-LAB0002', name: 'APC Smart-UPS 1500', category: 'UPS', location: 'F1 · LABORATORY EQUIPMENT AREA', owner: 'Laboratory', state: 'Inactive', ip: '—', brand: 'APC', model: 'Smart-UPS 1500' },
  { tag: 'PC-NEW-07', qrId: 'LIV-NEW0007', name: 'Acer Veriton X', category: 'System Unit', location: 'Unassigned', owner: 'Unassigned', state: 'Active', ip: '—', brand: 'Acer', model: 'Veriton X', processor: 'Intel Core i5-12400', ramCapacityGb: 8, ramModules: 1, ssdCapacityGb: 512, ssdCount: 1 },
]

type AssetRow = Database['public']['Tables']['assets']['Row']
type AssetInsert = Database['public']['Tables']['assets']['Insert']
type ConsumableReceiptRow = Database['public']['Tables']['consumable_receipts']['Row']
type ConsumableReceiptInsert = Database['public']['Tables']['consumable_receipts']['Insert']

const mapFromDB = (row: AssetRow): InventoryAsset => ({
  ...(row.stock_version != null ? { ramReceiptId: row.ram_receipt_id, ssdReceiptId: row.ssd_receipt_id, stockVersion: row.stock_version } : {}),
  tag: row.tag,
  qrId: row.qr_id,
  name: row.name,
  category: row.category,
  location: row.location,
  owner: row.owner,
  state: row.state,
  ip: row.ip,
  ...(row.brand ? { brand: row.brand } : {}),
  ...(row.model ? { model: row.model } : {}),
  ...(row.processor ? { processor: row.processor } : {}),
  ...(row.ram_capacity_gb != null ? { ramCapacityGb: row.ram_capacity_gb } : {}),
  ...(row.ram_modules != null ? { ramModules: row.ram_modules } : {}),
  ...(row.ssd_capacity_gb != null ? { ssdCapacityGb: row.ssd_capacity_gb } : {}),
  ...(row.ssd_count != null ? { ssdCount: row.ssd_count } : {}),
  ...(row.assignment_floor_id && row.assignment_department_id && row.assignment_room_id && row.assignment_room_name && row.assigned_at && row.assigned_by && row.assignment_method ? {
    assignment: {
      floorId: row.assignment_floor_id,
      departmentId: row.assignment_department_id,
      roomId: row.assignment_room_id,
      roomName: row.assignment_room_name,
      assignedAt: row.assigned_at,
      assignedBy: row.assigned_by,
      method: row.assignment_method,
    },
  } : {}),
})

const mapToDB = (asset: InventoryAsset): AssetInsert => ({
  ...(asset.ramReceiptId !== undefined ? { ram_receipt_id: asset.ramReceiptId } : {}),
  ...(asset.ssdReceiptId !== undefined ? { ssd_receipt_id: asset.ssdReceiptId } : {}),
  ...(asset.stockVersion !== undefined ? { stock_version: asset.stockVersion } : {}),
  ...(asset.returnRamToStock !== undefined ? { return_ram_to_stock: asset.returnRamToStock } : {}),
  ...(asset.returnSsdToStock !== undefined ? { return_ssd_to_stock: asset.returnSsdToStock } : {}),
  tag: asset.tag,
  qr_id: asset.qrId,
  name: asset.name,
  category: asset.category as AssetInsert['category'],
  location: asset.assignment ? formatAssetLocation(asset.assignment.floorId, asset.assignment.roomName) : asset.location,
  owner: asset.assignment?.departmentId ?? asset.owner,
  state: asset.state,
  ip: asset.ip,
  brand: asset.brand ?? null,
  model: asset.model ?? null,
  processor: asset.processor ?? null,
  ram_capacity_gb: asset.ramCapacityGb ?? null,
  ram_modules: asset.ramModules ?? null,
  ssd_capacity_gb: asset.ssdCapacityGb ?? null,
  ssd_count: asset.ssdCount ?? null,
  assignment_floor_id: asset.assignment?.floorId ?? null,
  assignment_department_id: asset.assignment?.departmentId ?? null,
  assignment_room_id: asset.assignment?.roomId ?? null,
  assignment_room_name: asset.assignment?.roomName ?? null,
  assigned_at: asset.assignment?.assignedAt ?? null,
  assigned_by: asset.assignment?.assignedBy ?? null,
  assignment_method: asset.assignment?.method ?? null,
})

const assignmentColumns = [
  'assignment_floor_id', 'assignment_department_id', 'assignment_room_id', 'assignment_room_name',
  'assigned_at', 'assigned_by', 'assignment_method',
] as const

const mapToLegacyDB = (asset: InventoryAsset): AssetInsert => {
  const row = mapToDB(asset)
  assignmentColumns.forEach(column => { delete row[column] })
  return row
}

const assignmentSchemaIsUnavailable = (error: { code?: string; message?: string }) =>
  (error.code === 'PGRST204' || error.code === '42703') &&
  assignmentColumns.some(column => error.message?.includes(column))

const requireAssignmentSchema = (asset: InventoryAsset) => {
  if (asset.assignment) throw new Error('Room assignment could not be saved. Apply the asset assignment database migration, then try again.')
}

export class AssetRepository {
  static getUnsyncedAssetTags(): string[] {
    // Retain old browser-only drafts for recovery without masking shared records.
    return Object.keys(readLocalOverrides())
  }

  static async getAll(): Promise<InventoryAsset[]> {
    const { data, error } = await supabase.from('assets').select('*').order('created_at', { ascending: false })
    if (error) {
      throw new Error('Could not load the shared inventory. Please retry when the connection is available.')
    }
    return (data || []).map(mapFromDB)
  }

  static async save(asset: InventoryAsset): Promise<void> {
    let { error } = await supabase.from('assets').insert(mapToDB(asset))
    if (error && assignmentSchemaIsUnavailable(error)) {
      requireAssignmentSchema(asset)
      ;({ error } = await supabase.from('assets').insert(mapToLegacyDB(asset)))
    }
    if (error) {
      console.error('Failed to save asset:', error)
      throw new Error(error.message)
    }
  }

  static async update(originalTag: string, asset: InventoryAsset): Promise<void> {
    let { data, error } = await supabase.from('assets')
      .update(mapToDB(asset))
      .eq('tag', originalTag)
      .select('tag')

    if (error && assignmentSchemaIsUnavailable(error)) {
      requireAssignmentSchema(asset)
      ;({ data, error } = await supabase.from('assets')
        .update(mapToLegacyDB(asset))
        .eq('tag', originalTag)
        .select('tag'))
    }
    
    if (error) {
      console.error('Failed to update asset:', error)
      throw new Error(error.message)
    }
    if (!data?.length) throw new Error('The asset was not updated. It may have been removed or you may not have permission to change it.')
    removeLocalOverride(originalTag, asset.tag)
  }

  static subscribe(onChange: () => void): () => void {
    const channel = supabase
      .channel(`liveinv-assets-${crypto.randomUUID()}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, onChange)
      .subscribe()

    return () => { void supabase.removeChannel(channel) }
  }
}

const mapConsumableFromDB = (row: ConsumableReceiptRow): ConsumableReceipt => ({
  id: row.id,
  category: row.category,
  itemName: row.item_name,
  specification: row.specification,
  quantity: row.quantity,
  ...(row.used_quantity !== undefined ? { usedQuantity: row.used_quantity } : {}),
  ...(row.capacity_gb ? { capacityGb: row.capacity_gb } : {}),
  unit: row.unit,
  dateReceived: row.date_received,
  createdAt: row.created_at,
  ...(row.brand ? { brand: row.brand } : {}),
  ...(row.supplier ? { supplier: row.supplier } : {}),
  ...(row.reference_number ? { referenceNumber: row.reference_number } : {}),
  ...(row.received_by ? { receivedBy: row.received_by } : {}),
  ...(row.notes ? { notes: row.notes } : {}),
})

const mapConsumableToDB = (receipt: Omit<ConsumableReceipt, 'id' | 'createdAt'>): ConsumableReceiptInsert => ({
  ...(receipt.capacityGb ? { capacity_gb: receipt.capacityGb } : {}),
  category: receipt.category,
  item_name: receipt.itemName,
  brand: receipt.brand ?? null,
  specification: receipt.specification,
  quantity: receipt.quantity,
  unit: receipt.unit,
  supplier: receipt.supplier ?? null,
  reference_number: receipt.referenceNumber ?? null,
  date_received: receipt.dateReceived,
  received_by: receipt.receivedBy ?? null,
  notes: receipt.notes ?? null,
})

export class ConsumableRepository {
  static async getAll(): Promise<ConsumableReceipt[]> {
    const rows: ConsumableReceipt[] = []
    for (let start = 0; ; start += 500) {
      const { data, error } = await supabase.from('consumable_receipts').select('*')
        .order('date_received', { ascending: false }).order('created_at', { ascending: false }).order('id').range(start, start + 499)
      if (error) throw new Error(error.message)
      rows.push(...(data || []).map(mapConsumableFromDB))
      if (!data || data.length < 500) return rows
    }
  }

  static async movements(): Promise<ConsumableMovement[]> {
    const rows: ConsumableMovement[] = []
    for (let start = 0; ; start += 500) {
      const { data, error } = await supabase.from('consumable_movements').select('*')
        .order('created_at', { ascending: false }).order('id').range(start, start + 499)
      if (error) throw new Error('Stock usage could not be loaded. Apply the system unit consumables database migration, then retry.')
      rows.push(...(data || []))
      if (!data || data.length < 500) return rows
    }
  }

  static async save(receipt: Omit<ConsumableReceipt, 'id' | 'createdAt'>): Promise<ConsumableReceipt> {
    const { data, error } = await supabase
      .from('consumable_receipts')
      .insert(mapConsumableToDB(receipt))
      .select('*')
      .single()

    if (error) throw new Error(error.message)
    return mapConsumableFromDB(data)
  }
}
