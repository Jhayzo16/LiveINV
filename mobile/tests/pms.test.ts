import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { mergePmsRecord, pmsSessionRequest, recordMatches, sessionMatches, validPmsDate } from '../src/pms'

const api = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn() }))
vi.mock('../src/supabase', () => ({ supabase: api }))
import { PmsRepository, type PmsRecord, type PmsSession } from '../src/shared/pms'

const session: PmsSession = { id: 'session-1', service_date: '2026-10-01', service_type: 'General cleaning', technician: 'IT Team', notes: 'Floor 2 cleaning', created_at: '2026-10-01T00:00:00Z', created_by: 'admin', completed_at: null, completed_by: null }
const record: PmsRecord = { id: 'record-1', session_id: session.id, asset_id: 'asset-id', asset_tag: 'UNIT_ADAM', qr_id: 'LIV-123', asset_name: 'HP 101', category: 'System Unit', location: 'Ground Floor · IT', department: 'IT', method: 'qr', recorded_by: 'admin', recorded_at: session.created_at }
beforeEach(() => vi.clearAllMocks())

describe('mobile PMS matches the existing web contract', () => {
  it('uses the web repository verbatim apart from its authenticated client import', () => {
    const web = readFileSync('../src/lib/pms.ts', 'utf8')
    expect(readFileSync('src/shared/pms.ts', 'utf8')).toBe('// Generated from src/lib/pms.ts by prepare-shared.mjs.\n' + web.replace("from './supabase'", "from '../supabase'"))
    const webIcon = readFileSync('../src/pages/PmsPage.tsx', 'utf8').match(/export function PmsIcon\(\) \{([\s\S]*?)\n\}/)?.[1] || ''
    const paths = (xml: string) => [...xml.matchAll(/\bd="([^"]+)"/g)].map(match => match[1])
    expect(paths(readFileSync('src/components/PmsIcon.tsx', 'utf8'))).toEqual(paths(webIcon))
    expect(paths(webIcon)).toHaveLength(2)
  })
  it('reads every page of sessions and records using stable ordering', async () => {
    const query = { select: vi.fn(), order: vi.fn(), eq: vi.fn(), range: vi.fn() }
    query.select.mockReturnValue(query); query.order.mockReturnValue(query); query.eq.mockReturnValue(query)
    api.from.mockReturnValue(query)
    query.range.mockResolvedValueOnce({ data: Array(500).fill(session), error: null }).mockResolvedValueOnce({ data: [session], error: null })
    expect(await PmsRepository.sessions()).toHaveLength(501)
    expect(query.range.mock.calls).toEqual([[0, 499], [500, 999]])
    expect(query.order.mock.calls.map(call => call[0])).toContain('id')
    query.range.mockReset().mockResolvedValueOnce({ data: Array(500).fill(record), error: null }).mockResolvedValueOnce({ data: [], error: null })
    expect(await PmsRepository.records(session.id)).toHaveLength(500)
    expect(query.eq).toHaveBeenCalledWith('session_id', session.id)
    expect(api.from.mock.calls.map(call => call[0])).toEqual(['pms_sessions', 'pms_sessions', 'pms_records', 'pms_records'])
  })
  it('creates sessions with the same RPC, trimmed fields, date and retry ID', async () => {
    api.rpc.mockResolvedValue({ data: session, error: null })
    await expect(PmsRepository.create({ id: session.id, date: session.service_date, service: 'General cleaning', technician: ' IT Team ', notes: ' Floor 2 cleaning ' })).resolves.toEqual(session)
    expect(api.rpc).toHaveBeenCalledWith('create_pms_session', { p_id: session.id, p_date: '2026-10-01', p_service: 'General cleaning', p_technician: 'IT Team', p_notes: 'Floor 2 cleaning' })
  })
  it('sends exact QR and manual codes to server resolution and preserves duplicate results', async () => {
    api.rpc.mockResolvedValue({ data: { record, already_recorded: true }, error: null })
    expect((await PmsRepository.mark(session.id, ' liveinv:qr:LIV-123 ', 'qr')).already_recorded).toBe(true)
    expect(api.rpc).toHaveBeenLastCalledWith('record_pms_asset', { p_session_id: session.id, p_code: 'liveinv:qr:LIV-123', p_method: 'qr' })
    await PmsRepository.mark(session.id, ' UNIT_ADAM ', 'manual')
    expect(api.rpc).toHaveBeenLastCalledWith('record_pms_asset', { p_session_id: session.id, p_code: 'UNIT_ADAM', p_method: 'manual' })
    expect(mergePmsRecord([record], record)).toEqual([record])
    expect(api.from).not.toHaveBeenCalled()
  })
  it('completes through the server and surfaces locked-session and unknown-code errors', async () => {
    api.rpc.mockResolvedValueOnce({ data: { ...session, completed_at: session.created_at }, error: null })
    expect((await PmsRepository.complete(session.id)).completed_at).toBeTruthy()
    expect(api.rpc).toHaveBeenCalledWith('complete_pms_session', { p_session_id: session.id })
    for (const message of ['This PMS session is completed.', 'No registered asset matches this code.', 'Administrator access is required.']) {
      api.rpc.mockResolvedValueOnce({ data: null, error: { message } })
      await expect(PmsRepository.mark(session.id, 'UNKNOWN', 'manual')).rejects.toThrow(message)
    }
  })
  it('shows the web setup guidance when PMS is unavailable', async () => {
    api.rpc.mockResolvedValue({ data: null, error: { code: 'PGRST202', message: 'missing function' } })
    await expect(PmsRepository.complete(session.id)).rejects.toThrow('PMS database setup is pending')
  })
})

describe('mobile PMS input and history', () => {
  it('retains the request ID on retry and changes it only when session details change', () => {
    const uuid = vi.fn().mockReturnValueOnce('first').mockReturnValueOnce('changed')
    const values = { date: '2026-10-01', service: 'General cleaning', technician: ' IT Team ', notes: '' }
    const request = pmsSessionRequest(null, values, uuid)
    expect(pmsSessionRequest(request, { ...values, technician: 'IT Team' }, uuid)).toBe(request)
    expect(pmsSessionRequest(request, { ...values, date: '2026-10-02' }, uuid).id).toBe('changed')
    expect(uuid).toHaveBeenCalledTimes(2)
  })
  it('rejects impossible calendar dates and respects the server date range', () => {
    for (const value of ['2026-02-29', '2026-04-31', '2026-13-01', '2026-00-01', '1899-12-31', '2026-1-1', 'bad']) expect(validPmsDate(value)).toBe(false)
    for (const value of ['2028-02-29', '1900-01-01', '9999-12-31', '2026-10-01']) expect(validPmsDate(value)).toBe(true)
  })
  it('searches saved session details and service-time asset snapshots', () => {
    expect(sessionMatches(session, ' IT TEAM ')).toBe(true)
    expect(sessionMatches(session, '2026-10')).toBe(true)
    expect(sessionMatches(session, 'floor 2')).toBe(true)
    expect(recordMatches(record, 'liv-123')).toBe(true)
    expect(recordMatches(record, 'ground floor')).toBe(true)
    expect(recordMatches(record, 'unrelated')).toBe(false)
  })
})
