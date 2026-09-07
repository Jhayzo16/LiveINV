// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'

const adminId = '00000000-0000-4000-8000-000000000001'
const otherId = '00000000-0000-4000-8000-000000000002'
let db: PGlite
const migration = readFileSync('supabase/migrations/20260907000000_require_admin_login.sql', 'utf8')

beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(`
    CREATE ROLE anon;
    CREATE ROLE authenticated;
    CREATE ROLE service_role;
    CREATE SCHEMA auth;
    CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS
      $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    INSERT INTO auth.users VALUES ('${adminId}', 'tgmcimis@gmail.com'), ('${otherId}', 'other@example.test');
  `)
  for (const file of ['20240101000000_initial_schema.sql', '20260902000000_fix_audit_log_trigger_rls.sql', '20260902020000_create_consumable_receipts.sql']) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))
  }
  await db.exec(migration)
}, 30000)

afterEach(async () => { await db.exec('RESET ROLE') })
afterAll(async () => { await db.close() })
const authenticate = async (id: string) => {
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [id])
  await db.exec('SET ROLE authenticated')
}

describe('admin database authorization', () => {
  it('denies anonymous reads and writes, even with the public API key', async () => {
    await db.exec('SET ROLE anon')
    for (const table of ['assets', 'audit_logs', 'consumable_receipts', 'admin_users']) {
      await expect(db.query(`SELECT * FROM public.${table}`)).rejects.toThrow(/permission denied/)
    }
    await expect(db.query("UPDATE public.assets SET name = 'Unauthorized'")).rejects.toThrow(/permission denied/)
  })

  it('denies non-admin reads, writes, and self-enrollment', async () => {
    await authenticate(otherId)
    for (const table of ['assets', 'audit_logs', 'consumable_receipts', 'admin_users']) {
      expect((await db.query(`SELECT * FROM public.${table}`)).rows).toEqual([])
    }
    expect((await db.query("UPDATE public.assets SET name = 'Unauthorized' RETURNING tag")).rows).toEqual([])
    await expect(db.query("INSERT INTO public.assets (tag, qr_id, name, category) VALUES ('BAD', 'BAD', 'Bad', 'Router')")).rejects.toThrow(/row-level security/)
    await expect(db.query('INSERT INTO public.admin_users (user_id) VALUES ($1)', [otherId])).rejects.toThrow(/permission denied/)
  })

  it('lets the approved admin read and update assets while logging their real user ID', async () => {
    await authenticate(adminId)
    expect((await db.query('SELECT * FROM public.assets')).rows.length).toBeGreaterThan(0)
    await db.query("UPDATE public.assets SET location = 'F2 · MAJOR OR 1' WHERE tag = 'AP-OR-03'")
    const logs = await db.query<{ performed_by: string }>('SELECT performed_by FROM public.audit_logs')
    expect(logs.rows).toContainEqual({ performed_by: adminId })
    await expect(db.query("INSERT INTO public.audit_logs (action) VALUES ('FAKE')")).rejects.toThrow(/permission denied/)
  })

  it('allows admin registration and consumable receipts without granting deletion', async () => {
    await authenticate(adminId)
    await db.query("INSERT INTO public.assets (tag, qr_id, name, category) VALUES ('ADMIN-TEST', 'LIV-ADMINTEST', 'New device', 'Router')")
    await db.query("INSERT INTO public.consumable_receipts (category, item_name, specification, quantity, date_received) VALUES ('RAM', 'Memory', '8 GB', 2, CURRENT_DATE)")
    expect((await db.query('SELECT * FROM public.consumable_receipts')).rows).toHaveLength(1)
    await expect(db.query('DELETE FROM public.assets')).rejects.toThrow(/permission denied/)
    await expect(db.query('DELETE FROM public.admin_users')).rejects.toThrow(/permission denied/)
  })

  it('revokes access immediately when the admin allowlist entry is removed', async () => {
    await db.query('DELETE FROM public.admin_users WHERE user_id = $1', [adminId])
    await authenticate(adminId)
    expect((await db.query('SELECT * FROM public.assets')).rows).toEqual([])
    await db.exec('RESET ROLE')
    await db.exec(migration)
  })
})
