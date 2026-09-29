import type { InventoryAsset, AssetState } from './shared/types'

export type AssetRow = {
  id: string; tag: string; qr_id: string; name: string; category: string;
  state: AssetState; ip: string; location: string; owner: string;
  brand: string | null; model: string | null; processor: string | null;
  ram_capacity_gb: number | null; ram_modules: number | null;
  ssd_capacity_gb: number | null; ssd_count: number | null;
  assignment_floor_id: string | null; assignment_room_id: string | null;
  assignment_room_name: string | null; assignment_department_id: string | null;
  assigned_at: string | null; assigned_by: string | null; assignment_method: 'qr' | 'manual' | null;
  updated_at: string;
}
// Mobile field updates never replace the full asset or modify stock accounting.
export type AssetPatch = Partial<Pick<AssetRow, 'state' | 'ip' | 'location' | 'owner' |
  'assignment_floor_id' | 'assignment_room_id' | 'assignment_room_name' |
  'assignment_department_id' | 'assigned_at' | 'assigned_by' | 'assignment_method'>>
export type PendingChange = {
  id: string; userId: string; assetId: string; tag: string; baseVersion: string;
  patch: AssetPatch; createdAt: string; status: 'pending' | 'conflict' | 'error'; message?: string;
}
export function toAsset(row: AssetRow): InventoryAsset {
  return {
    tag: row.tag, qrId: row.qr_id, name: row.name, category: row.category, state: row.state,
    ip: row.ip, location: row.location, owner: row.owner, brand: row.brand ?? undefined,
    model: row.model ?? undefined, processor: row.processor ?? undefined,
    ramCapacityGb: row.ram_capacity_gb ?? undefined, ramModules: row.ram_modules ?? undefined,
    ssdCapacityGb: row.ssd_capacity_gb ?? undefined, ssdCount: row.ssd_count ?? undefined,
    ...(row.assignment_floor_id && row.assignment_room_id && row.assignment_room_name ? {
      assignment: { floorId: row.assignment_floor_id, roomId: row.assignment_room_id,
        roomName: row.assignment_room_name, departmentId: row.assignment_department_id || row.owner,
        assignedAt: row.assigned_at || '', assignedBy: row.assigned_by || '', method: row.assignment_method || 'manual' },
    } : {}),
  }
}
export function normalizeCode(code: string) {
  return code.trim().replace(/^liveinv:(?:qr|asset):/i, '').toUpperCase()
}
export function findAsset(rows: AssetRow[], code: string) {
  const key = normalizeCode(code)
  return key ? rows.find(row => row.tag.toUpperCase() === key || row.qr_id.toUpperCase() === key) : undefined
}
export function patchMatches(row: AssetRow, patch: AssetPatch) {
  return Object.entries(patch).every(([key, value]) => key === 'assigned_at' && value && row.assigned_at
    ? Date.parse(row.assigned_at) === Date.parse(value)
    : row[key as keyof AssetRow] === value)
}
export function validIp(value: string) {
  return value === '—' || /^(\d{1,3}\.){3}\d{1,3}$/.test(value) && value.split('.').every(part => Number(part) <= 255)
}
export function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!)
}
