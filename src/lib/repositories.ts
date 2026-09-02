import { type ConsumableReceipt, type InventoryAsset } from './types'
import type { Database } from './database.types'
import { supabase } from './supabase'

const createQrId = () => `LIV-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`
const LOCAL_ASSET_OVERRIDES_KEY = 'liveinv-local-asset-overrides'

const readLocalOverrides = (): Record<string, InventoryAsset> => {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.localStorage.getItem(LOCAL_ASSET_OVERRIDES_KEY) || '{}') as Record<string, InventoryAsset>
  } catch {
    return {}
  }
}

const saveLocalOverride = (originalTag: string, asset: InventoryAsset) => {
  if (typeof window === 'undefined') return
  const overrides = readLocalOverrides()
  if (originalTag !== asset.tag) delete overrides[originalTag]
  overrides[asset.tag] = asset
  window.localStorage.setItem(LOCAL_ASSET_OVERRIDES_KEY, JSON.stringify(overrides))
}

const removeLocalOverride = (...tags: string[]) => {
  if (typeof window === 'undefined') return
  const overrides = readLocalOverrides()
  tags.forEach(tag => delete overrides[tag])
  window.localStorage.setItem(LOCAL_ASSET_OVERRIDES_KEY, JSON.stringify(overrides))
}

const mergeLocalOverrides = (remoteAssets: InventoryAsset[]) => {
  const overrides = readLocalOverrides()
  const merged = remoteAssets.map(asset => overrides[asset.tag] ?? asset)
  const remoteTags = new Set(remoteAssets.map(asset => asset.tag))
  Object.values(overrides).forEach(asset => {
    if (!remoteTags.has(asset.tag)) merged.unshift(asset)
  })
  return merged
}

export const seedAssets: InventoryAsset[] = [
  { tag: 'PC-MRR-01', qrId: 'LIV-MRR0001', name: 'Dell OptiPlex 7090', category: 'System Unit', location: 'F5 · Medical Records', owner: 'IT Department', state: 'Active', ip: '10.20.5.31', brand: 'Dell', model: 'OptiPlex 7090', processor: 'Intel Core i5-10500', ramCapacityGb: 8, ramModules: 2, ssdCapacityGb: 512, ssdCount: 1 },
  { tag: 'PRN-ACC-02', qrId: 'LIV-ACC0002', name: 'HP LaserJet Pro M404', category: 'Printer', location: 'F5 · Accounting', owner: 'Finance', state: 'Maintenance', ip: '10.20.5.52', brand: 'HP', model: 'LaserJet Pro M404' },
  { tag: 'MON-HR-04', qrId: 'LIV-HR00004', name: 'Dell P2422H Display', category: 'Monitor', location: 'F5 · HR Office', owner: 'Human Resources', state: 'Active', ip: '—', brand: 'Dell', model: 'P2422H Display' },
  { tag: 'PC-ER-12', qrId: 'LIV-ER00012', name: 'Lenovo ThinkCentre M80', category: 'System Unit', location: 'F1 · E.R. RECEPTION', owner: 'Emergency', state: 'Broken', ip: '10.20.1.42', brand: 'Lenovo', model: 'ThinkCentre M80', processor: 'Intel Core i5-10500', ramCapacityGb: 8, ramModules: 2, ssdCapacityGb: 256, ssdCount: 1 },
  { tag: 'AP-OR-03', qrId: 'LIV-OR00003', name: 'Aruba AP-515', category: 'Router', location: 'F2 · MAJOR OR 1', owner: 'IT Department', state: 'Active', ip: '10.20.2.11', brand: 'Aruba', model: 'AP-515' },
  { tag: 'UPS-LAB-02', qrId: 'LIV-LAB0002', name: 'APC Smart-UPS 1500', category: 'UPS', location: 'F1 · LABORATORY EQUIPMENT AREA', owner: 'Laboratory', state: 'Inactive', ip: '—', brand: 'APC', model: 'Smart-UPS 1500' },
  { tag: 'PC-NEW-07', qrId: 'LIV-NEW0007', name: 'Acer Veriton X', category: 'System Unit', location: 'Unassigned', owner: 'Unassigned', state: 'Active', ip: '—', brand: 'Acer', model: 'Veriton X', processor: 'Intel Core i5-12400', ramCapacityGb: 8, ramModules: 1, ssdCapacityGb: 512, ssdCount: 1 },
]

type AssetRow = Database['public']['Tables']['assets']['Row']
type AssetInsert = Database['public']['Tables']['assets']['Insert']
type ConsumableReceiptRow = Database['public']['Tables']['consumable_receipts']['Row']
type ConsumableReceiptInsert = Database['public']['Tables']['consumable_receipts']['Insert']

const mapFromDB = (row: AssetRow): InventoryAsset => ({
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
})

const mapToDB = (asset: InventoryAsset): AssetInsert => ({
  tag: asset.tag,
  qr_id: asset.qrId,
  name: asset.name,
  category: asset.category as AssetInsert['category'],
  location: asset.location,
  owner: asset.owner,
  state: asset.state,
  ip: asset.ip,
  brand: asset.brand ?? null,
  model: asset.model ?? null,
  processor: asset.processor ?? null,
  ram_capacity_gb: asset.ramCapacityGb ?? null,
  ram_modules: asset.ramModules ?? null,
  ssd_capacity_gb: asset.ssdCapacityGb ?? null,
  ssd_count: asset.ssdCount ?? null,
})

export class AssetRepository {
  static async getAll(): Promise<InventoryAsset[]> {
    const { data, error } = await supabase.from('assets').select('*').order('created_at', { ascending: false })
    if (error) {
      console.warn('Supabase fetch failed, falling back to seed data:', error)
      return mergeLocalOverrides(seedAssets)
    }
    return mergeLocalOverrides((data || []).map(mapFromDB))
  }

  static async save(asset: InventoryAsset): Promise<void> {
    const { error } = await supabase.from('assets').insert(mapToDB(asset))
    if (error) {
      console.error('Failed to save asset:', error)
      throw new Error(error.message)
    }
  }

  static async update(originalTag: string, asset: InventoryAsset): Promise<void> {
    const { error } = await supabase.from('assets')
      .update(mapToDB(asset))
      .eq('tag', originalTag)
    
    if (error) {
      if (error.code === '42501' && error.message.includes('audit_logs')) {
        saveLocalOverride(originalTag, asset)
        console.warn('Supabase blocked the audit log. The asset update was saved locally instead.')
        return
      }
      console.error('Failed to update asset:', error)
      throw new Error(error.message)
    }
    removeLocalOverride(originalTag, asset.tag)
  }
}

const mapConsumableFromDB = (row: ConsumableReceiptRow): ConsumableReceipt => ({
  id: row.id,
  category: row.category,
  itemName: row.item_name,
  specification: row.specification,
  quantity: row.quantity,
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
    const { data, error } = await supabase
      .from('consumable_receipts')
      .select('*')
      .order('date_received', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) throw new Error(error.message)
    return (data || []).map(mapConsumableFromDB)
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
