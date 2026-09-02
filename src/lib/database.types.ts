import type { AssetState, DeviceCategory } from './types'

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
  created_at?: string
  updated_at?: string
}

export interface Database {
  public: {
    Tables: {
      assets: {
        Row: AssetRow
        Insert: AssetInsert
        Update: Partial<AssetInsert>
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
