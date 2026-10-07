import type { PmsRecord, PmsSession } from './shared/pms'
import { matchesWordPrefix } from './search'

export function validPmsDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || value < '1900-01-01' || value > '9999-12-31') return false
  const date = new Date(`${value}T12:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
}
export function sessionMatches(session: PmsSession, search: string) {
  return matchesWordPrefix(search, session.technician, session.service_date, session.service_type, session.notes)
}
export function recordMatches(record: PmsRecord, search: string) {
  return matchesWordPrefix(search, record.asset_tag, record.qr_id, record.asset_name, record.location, record.department)
}
export function mergePmsRecord(records: PmsRecord[] = [], saved: PmsRecord) {
  return [saved, ...records.filter(record => record.id !== saved.id)]
}
export type SessionRequest = { signature: string; id: string }
export function pmsSessionRequest(previous: SessionRequest | null, values: { date: string; service: string; technician: string; notes: string }, uuid: () => string): SessionRequest {
  const signature = JSON.stringify([values.date, values.service, values.technician.trim(), values.notes.trim()])
  return previous?.signature === signature ? previous : { signature, id: uuid() }
}
