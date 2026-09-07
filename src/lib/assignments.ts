import type { Assignment, AssignmentMethod, InventoryAsset } from './types'

export const UNASSIGNED = 'Unassigned'

export type AssignAssetInput = {
  floorId: string
  roomId: string
  roomName: string
  departmentId: string
  assignedBy?: string
  method?: AssignmentMethod
}

export function normalizeRoomName(value: string) {
  return value
    .normalize('NFKD')
    .replace(/[’']/g, '')
    .replace(/&/g, 'and')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase()
}

function comparableRoomName(value: string) {
  return normalizeRoomName(value)
    .replace('accouting', 'accounting')
    .replace(/(?:equipmentarea|office|room)$/, '')
}

export function formatAssetLocation(floorId: string, roomName: string) {
  return `F${floorId} · ${roomName}`
}

export function roomNameFromLocation(location: string) {
  const match = location.match(/^F\s*([1-7])\s*[·|-]\s*(.+)$/i)
  return match?.[2]?.trim() ?? ''
}

export function floorIdFromLocation(location: string) {
  return location.match(/^F\s*([1-7])\b/i)?.[1] ?? ''
}

export function isAssetAssigned(asset: InventoryAsset) {
  if (asset.assignment) {
    return Boolean(asset.assignment.floorId && asset.assignment.roomName && asset.assignment.departmentId)
  }
  return Boolean(floorIdFromLocation(asset.location) && roomNameFromLocation(asset.location))
}

export function assignAsset(asset: InventoryAsset, input: AssignAssetInput, assignedAt = new Date().toISOString()): InventoryAsset {
  const assignment: Assignment = {
    floorId: input.floorId,
    roomId: input.roomId,
    roomName: input.roomName,
    departmentId: input.departmentId,
    assignedAt,
    assignedBy: input.assignedBy ?? 'Admin',
    method: input.method ?? 'manual',
  }

  return {
    ...asset,
    location: formatAssetLocation(input.floorId, input.roomName),
    owner: input.departmentId,
    assignment,
  }
}

export function unassignAsset(asset: InventoryAsset): InventoryAsset {
  const unassignedAsset = {
    ...asset,
    location: UNASSIGNED,
    owner: UNASSIGNED,
  }

  delete unassignedAsset.assignment
  return unassignedAsset
}

export type MappableRoom = { id: string; floor: number; name: string; code?: string; legacyIds?: string[] }

export function assetBelongsToRoom(asset: InventoryAsset, room: MappableRoom) {
  const assignmentFloor = asset.assignment?.floorId || floorIdFromLocation(asset.location)
  if (assignmentFloor !== String(room.floor)) return false
  if (asset.assignment?.roomId && asset.assignment.roomId === room.id) return true

  const assignedRoomName = asset.assignment?.roomName || roomNameFromLocation(asset.location)
  const assignedKey = normalizeRoomName(assignedRoomName)
  const comparableAssignedKey = comparableRoomName(assignedRoomName)
  return Boolean(assignedKey) && [room.name, room.code ?? ''].some(value => {
    const roomKey = normalizeRoomName(value)
    return roomKey === assignedKey || (Boolean(comparableAssignedKey) && comparableRoomName(value) === comparableAssignedKey)
  })
}

export function resolveAssetRoom(asset: InventoryAsset, rooms: MappableRoom[]) {
  const floor = asset.assignment?.floorId || floorIdFromLocation(asset.location)
  const onFloor = rooms.filter(room => String(room.floor) === floor)
  const id = asset.assignment?.roomId
  if (id) {
    const exact = onFloor.find(room => room.id === id || room.legacyIds?.includes(id))
    if (exact) return exact
    // Current catalog IDs are authoritative. A stale ID must not jump to a namesake.
    if (/^f\d+-space-\d+$/.test(id)) return undefined
  }
  const matches = onFloor.filter(room => assetBelongsToRoom(asset, room))
  return matches.length === 1 ? matches[0] : undefined
}
