export type AssetState = 'Active' | 'Maintenance' | 'Broken' | 'Inactive'
export type AssignmentMethod = 'manual' | 'qr'
export type DeviceCategory = 'Printer' | 'Monitor' | 'Keyboard' | 'System Unit' | 'UPS' | 'Scanner' | 'Router'
export type ConsumableCategory = 'RAM' | 'SSD' | 'HDD' | 'Network Cable' | 'Ink / Toner' | 'Battery' | 'Other'

export interface NetworkProfile {
  hostname?: string
  ipv4Address?: string
  macAddress?: string
  addressMethod?: 'DHCP reservation' | 'Static' | 'Not applicable'
  networkName?: string
  verifiedAt?: string
}

export interface Assignment {
  floorId: string
  departmentId: string
  roomId: string
  roomName: string
  assignedAt: string
  assignedBy: string
  method: AssignmentMethod
}

export interface InventoryAsset {
  tag: string
  qrId: string
  name: string
  category: DeviceCategory | string
  location: string
  owner: string
  state: AssetState
  ip: string
  brand?: string
  model?: string
  ramCapacityGb?: number
  ramModules?: number
  ssdCapacityGb?: number
  ssdCount?: number
  processor?: string
  ramReceiptId?: string | null
  ssdReceiptId?: string | null
  stockVersion?: number
  returnRamToStock?: boolean
  returnSsdToStock?: boolean
  networkProfile?: NetworkProfile
  assignment?: Assignment
}

export interface ConsumableReceipt {
  id: string
  category: ConsumableCategory
  itemName: string
  brand?: string
  specification: string
  quantity: number
  usedQuantity?: number
  capacityGb?: number
  unit: string
  supplier?: string
  referenceNumber?: string
  dateReceived: string
  receivedBy?: string
  notes?: string
  createdAt: string
}

export type ConsumableMovement = {
  id: string
  receipt_id: string
  asset_id: string
  asset_tag: string
  category: 'RAM' | 'SSD'
  action: 'Installed' | 'Returned' | 'Removed / used'
  quantity: number
  performed_by: string
  created_at: string
}
