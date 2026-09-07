export type HospitalFloorModel = {
  id: number
  label: string
  rooms: number
  assets: number
  activeAssets?: number
  maintenanceAssets?: number
  brokenAssets?: number
  inactiveAssets?: number
}

export type FloorScreenAnchor = {
  floorId: number
  x: number
  y: number
  visible: boolean
  depth: number
  opacity: number
}

export type FloorAnchorSnapshot = Record<number, FloorScreenAnchor>
