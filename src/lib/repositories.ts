import { type InventoryAsset } from './types'
import type { Database } from './database.types'
import { supabase } from './supabase'

const createQrId = () => `LIV-${crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}`

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
      return seedAssets
    }
    return (data || []).map(mapFromDB)
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
      console.error('Failed to update asset:', error)
      throw new Error(error.message)
    }
  }
}
