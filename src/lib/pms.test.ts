// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it } from 'vitest'

const admin = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
let db: PGlite
beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    INSERT INTO auth.users VALUES ('${admin}', 'tgmcimis@gmail.com'), ('${other}', 'other@example.test');`)
  for (const name of ['20240101000000_initial_schema.sql', '20260902020000_create_consumable_receipts.sql', '20260907000000_require_admin_login.sql', '20260907010000_create_pms.sql', '20260907010000_create_pms.sql']) {
    await db.exec(readFileSync(`supabase/migrations/${name}`, 'utf8'))
  }
}, 30000)
beforeEach(async () => { await db.exec('BEGIN'); await authenticate(admin) })
afterEach(async () => { await db.exec('ROLLBACK; RESET ROLE;') })
afterAll(async () => { await db.close() })
async function authenticate(id: string) {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id])
  await db.exec('SET ROLE authenticated')
}
async function create(id = randomUUID(), date = '2026-08-12') {
  await db.query("SELECT public.create_pms_session($1, $2, 'General cleaning', 'IT Team', 'Test session')", [id, date])
  return id
}
async function mark(id: string, code = 'liveinv:qr:LIV-OR00003', method = 'qr') {
  const { rows } = await db.query<{ result: { record: { id: string; asset_tag: string; qr_id: string; location: string; recorded_by: string }; already_recorded: boolean } }>('SELECT public.record_pms_asset($1, $2, $3) AS result', [id, code, method])
  return rows[0].result
}

describe('PMS database workflow and authorization', () => {
  it('records a known QR once per session without changing its inventory state or assignment', async () => {
    const session = await create()
    const before = (await db.query("SELECT * FROM public.assets WHERE tag = 'AP-OR-03'")).rows
    const first = await mark(session)
    const again = await mark(session, ' AP-OR-03 ', 'manual')
    expect(first.already_recorded).toBe(false)
    expect(first.record.asset_tag).toBe('AP-OR-03')
    expect(first.record.recorded_by).toBe(admin)
    expect(again.already_recorded).toBe(true)
    expect(again.record.id).toBe(first.record.id)
    expect((await db.query('SELECT * FROM public.pms_records')).rows).toHaveLength(1)
    expect((await db.query("SELECT * FROM public.assets WHERE tag = 'AP-OR-03'")).rows).toEqual(before)
  })
  it('allows another maintenance event in a different dated session and preserves snapshots after renaming', async () => {
    const first = await mark(await create())
    await db.query("UPDATE public.assets SET tag = 'RENAMED', location = 'F1 · Test room' WHERE tag = 'AP-OR-03'")
    const second = await mark(await create(randomUUID(), '2026-09-07'))
    expect(second.record.asset_tag).toBe('RENAMED')
    expect(second.record.location).toBe('F1 · Test room')
    expect((await db.query('SELECT asset_tag, location FROM public.pms_records WHERE id = $1', [first.record.id])).rows).toEqual([{ asset_tag: 'AP-OR-03', location: first.record.location }])
  })
  it('keeps the chosen calendar date and makes retried session creation idempotent', async () => {
    const id = await create(randomUUID(), '2030-01-01')
    await create(id, '2030-01-01')
    expect((await db.query('SELECT service_date::text, created_by FROM public.pms_sessions')).rows).toEqual([{ service_date: '2030-01-01', created_by: admin }])
  })
  it('rejects unknown codes without adding maintenance', async () => {
    const session = await create()
    await expect(mark(session, 'UNKNOWN')).rejects.toThrow(/No registered asset/)
  })
  it('rejects ambiguous manual codes but resolves the namespaced QR exactly', async () => {
    await db.query("INSERT INTO public.assets(tag,qr_id,name,category) VALUES ('LIV-OR00003','LIV-OTHER','Other','Router')")
    const session = await create()
    expect((await mark(session)).record.asset_tag).toBe('AP-OR-03')
    await expect(mark(session, 'LIV-OR00003', 'manual')).rejects.toThrow(/more than one asset/)
  })
  it('rejects empty session completion', async () => {
    await expect(db.query('SELECT public.complete_pms_session($1)', [await create()])).rejects.toThrow(/at least one maintained asset/)
  })
  it('locks completed sessions against further scans and repeated completion is safe', async () => {
    const session = await create()
    await mark(session)
    await db.query('SELECT public.complete_pms_session($1)', [session])
    await db.query('SELECT public.complete_pms_session($1)', [session])
    expect((await db.query('SELECT completed_by FROM public.pms_sessions WHERE id=$1', [session])).rows).toEqual([{ completed_by: admin }])
    await expect(mark(session, 'PC-MRR-01', 'manual')).rejects.toThrow(/session is completed/)
  })
  it('denies direct writes even for an admin, preventing fabricated asset snapshots', async () => {
    await expect(db.query("INSERT INTO public.pms_records (asset_tag) VALUES ('FAKE')")).rejects.toThrow(/permission denied/)
  })
  it('denies anonymous reads and RPC execution', async () => {
    await db.exec('SET ROLE anon')
    await expect(db.query('SELECT * FROM public.pms_sessions')).rejects.toThrow(/permission denied/)
  })
  it('denies anonymous maintenance calls', async () => {
    const session = await create()
    await db.exec('SET ROLE anon')
    await expect(mark(session)).rejects.toThrow(/permission denied/)
  })
  it('hides history from non-admins and rejects their scans', async () => {
    const session = await create()
    await mark(session)
    await authenticate(other)
    expect((await db.query('SELECT * FROM public.pms_sessions')).rows).toEqual([])
    expect((await db.query('SELECT * FROM public.pms_records')).rows).toEqual([])
    await expect(mark(session)).rejects.toThrow(/Administrator access/)
  })
  it('rejects session creation by a non-admin', async () => {
    await authenticate(other)
    await expect(create()).rejects.toThrow(/Administrator access/)
  })
})
