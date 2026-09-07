import { supabase } from './supabase'

export type PmsService = 'Preventive maintenance' | 'General cleaning'
export type PmsSession = {
  id: string; service_date: string; service_type: PmsService; technician: string; notes: string
  created_by: string; created_at: string; completed_at: string | null; completed_by: string | null
}
export type PmsRecord = {
  id: string; session_id: string; asset_id: string; asset_tag: string; qr_id: string; asset_name: string
  category: string; location: string; department: string; method: 'qr' | 'manual'; recorded_by: string; recorded_at: string
}
export type NewPmsSession = { id: string; date: string; service: PmsService; technician: string; notes: string }

export const localDate = (date = new Date()) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
export const formatPmsDate = (date: string) => new Intl.DateTimeFormat('en-PH', { dateStyle: 'medium' }).format(new Date(`${date}T12:00:00`))

function pmsError(error: { code?: string; message: string }): Error {
  if (['42P01', 'PGRST205', 'PGRST202'].includes(error.code || '')) {
    return new Error('PMS database setup is pending. Ask the administrator to apply the PMS setup script, then retry.')
  }
  return new Error(error.message || 'PMS could not be saved. Check your connection and retry.')
}

export class PmsRepository {
  static async sessions(): Promise<PmsSession[]> {
    const rows: PmsSession[] = []
    for (let start = 0; ; start += 500) {
      const { data, error } = await supabase.from('pms_sessions').select('*').order('service_date', { ascending: false }).order('created_at', { ascending: false }).order('id').range(start, start + 499)
      if (error) throw pmsError(error)
      rows.push(...data)
      if (data.length < 500) return rows
    }
  }
  static async records(sessionId: string): Promise<PmsRecord[]> {
    const rows: PmsRecord[] = []
    for (let start = 0; ; start += 500) {
      const { data, error } = await supabase.from('pms_records').select('*').eq('session_id', sessionId).order('recorded_at', { ascending: false }).order('id').range(start, start + 499)
      if (error) throw pmsError(error)
      rows.push(...data)
      if (data.length < 500) return rows
    }
  }
  static async create(input: NewPmsSession): Promise<PmsSession> {
    const { data, error } = await supabase.rpc('create_pms_session', { p_id: input.id, p_date: input.date, p_service: input.service, p_technician: input.technician.trim(), p_notes: input.notes.trim() })
    if (error) throw pmsError(error)
    return data
  }
  static async mark(sessionId: string, code: string, method: 'qr' | 'manual') {
    const { data, error } = await supabase.rpc('record_pms_asset', { p_session_id: sessionId, p_code: code.trim(), p_method: method })
    if (error) throw pmsError(error)
    return data
  }
  static async complete(sessionId: string): Promise<PmsSession> {
    const { data, error } = await supabase.rpc('complete_pms_session', { p_session_id: sessionId })
    if (error) throw pmsError(error)
    return data
  }
}
