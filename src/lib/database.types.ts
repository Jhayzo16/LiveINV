import { InventoryAsset } from './types'

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      assets: {
        Row: InventoryAsset & {
          id: string
          created_at: string
          updated_at: string
        }
        Insert: Omit<InventoryAsset, 'id' | 'created_at' | 'updated_at'>
        Update: Partial<Omit<InventoryAsset, 'id' | 'created_at' | 'updated_at'>>
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
      }
    }
  }
}
