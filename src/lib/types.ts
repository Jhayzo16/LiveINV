export type AssetState = 'Active' | 'Maintenance' | 'Broken' | 'Inactive'
export type AssignmentMethod = 'manual' | 'qr'
export type DeviceCategory = 'Printer' | 'Monitor' | 'Keyboard' | 'System Unit' | 'UPS' | 'Scanner' | 'Router'

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
  networkProfile?: NetworkProfile
  assignment?: Assignment
}
