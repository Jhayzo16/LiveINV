import type { AssetState, ConsumableCategory, DeviceCategory } from './types'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

type AssetRow = {
  id: string
  tag: string
  qr_id: string
  name: string
  category: DeviceCategory
  location: string
  owner: string
  state: AssetState
  ip: string
  brand: string | null
  model: string | null
  processor: string | null
  ram_capacity_gb: number | null
  ram_modules: number | null
  ssd_capacity_gb: number | null
  ssd_count: number | null
  assignment_floor_id: string | null
  assignment_department_id: string | null
  assignment_room_id: string | null
  assignment_room_name: string | null
  assigned_at: string | null
  assigned_by: string | null
  assignment_method: 'manual' | 'qr' | null
  created_at: string
  updated_at: string
}

type AssetInsert = {
  id?: string
  tag: string
  qr_id: string
  name: string
  category: DeviceCategory
  location?: string
  owner?: string
  state?: AssetState
  ip?: string
  brand?: string | null
  model?: string | null
  processor?: string | null
  ram_capacity_gb?: number | null
  ram_modules?: number | null
  ssd_capacity_gb?: number | null
  ssd_count?: number | null
  assignment_floor_id?: string | null
  assignment_department_id?: string | null
  assignment_room_id?: string | null
  assignment_room_name?: string | null
  assigned_at?: string | null
  assigned_by?: string | null
  assignment_method?: 'manual' | 'qr' | null
  created_at?: string
  updated_at?: string
}

type ConsumableReceiptRow = {
  id: string
  category: ConsumableCategory
  item_name: string
  brand: string | null
  specification: string
  quantity: number
  unit: string
  supplier: string | null
  reference_number: string | null
  date_received: string
  received_by: string | null
  notes: string | null
  created_at: string
}

type ConsumableReceiptInsert = {
  id?: string
  category: ConsumableCategory
  item_name: string
  brand?: string | null
  specification: string
  quantity: number
  unit: string
  supplier?: string | null
  reference_number?: string | null
  date_received: string
  received_by?: string | null
  notes?: string | null
  created_at?: string
}

export interface Database {
  public: {
    Tables: {
      admin_users: {
        Row: { user_id: string; created_at: string }
        Insert: { user_id: string; created_at?: string }
        Update: { user_id?: string; created_at?: string }
        Relationships: []
      }
      assets: {
        Row: AssetRow
        Insert: AssetInsert
        Update: Partial<AssetInsert>
        Relationships: []
      }
      consumable_receipts: {
        Row: ConsumableReceiptRow
        Insert: ConsumableReceiptInsert
        Update: Partial<ConsumableReceiptInsert>
        Relationships: []
      }
      audit_logs: {
        Row: {
          id: string
          asset_id: string
          action: string
          previous_location: string | null
          new_location: string | null
          performed_by: string | null
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>
        Update: Partial<Omit<Database['public']['Tables']['audit_logs']['Row'], 'id' | 'created_at'>>
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
  }
}
