import { toAsset, type AssetRow, type PendingChange } from './domain'
import { isAssetAssigned } from './shared/assignments'

export function availableRoomDevices(rows: AssetRow[], pending: PendingChange[]) {
  const queued = new Set(pending.map(change => change.assetId))
  return rows.filter(row => !queued.has(row.id) && !row.assignment_room_id && !row.assignment_floor_id && !isAssetAssigned(toAsset(row)))
    .sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true }))
}

// Resolve against the latest room inventory so refreshes cannot leave details
// pointing at a device that has since been moved out of this room.
export function roomExplorerSelection(equipment: AssetRow[], category: string | null, selectedId: string | null) {
  const sorted = [...equipment].sort((a, b) => a.tag.localeCompare(b.tag, undefined, { numeric: true }) || a.id.localeCompare(b.id))
  const counts = new Map<string, number>()
  for (const row of sorted) counts.set(row.category, (counts.get(row.category) ?? 0) + 1)
  const filter = category && counts.has(category) ? category : null
  const filtered = filter ? sorted.filter(row => row.category === filter) : sorted
  return { sorted, counts, filter, filtered, selected: filtered.find(row => row.id === selectedId) ?? filtered[0] }
}
