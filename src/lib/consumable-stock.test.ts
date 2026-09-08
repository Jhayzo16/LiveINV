// @vitest-environment node
import { PGlite } from '@electric-sql/pglite'
import { readFileSync } from 'node:fs'
import { beforeAll, beforeEach, afterAll, afterEach, describe, expect, it } from 'vitest'

const admin = '00000000-0000-4000-8000-000000000001'
const other = '00000000-0000-4000-8000-000000000002'
let db: PGlite
let ram: string, ssd: string
beforeAll(async () => {
  db = await PGlite.create()
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    GRANT USAGE ON SCHEMA auth TO authenticated, anon;
    INSERT INTO auth.users VALUES ('${admin}', 'tgmcimis@gmail.com'), ('${other}', 'other@example.test');`)
  for (const file of ['20240101000000_initial_schema.sql', '20260902020000_create_consumable_receipts.sql', '20260907000000_require_admin_login.sql', '20260908010000_link_system_unit_consumables.sql', '20260908010000_link_system_unit_consumables.sql']) {
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'))
  }
}, 30000)
beforeEach(async () => {
  await db.exec('BEGIN')
  await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [admin])
  await db.exec('SET ROLE authenticated')
  ram = await receive('RAM', 10, 8)
  ssd = await receive('SSD', 5, 512)
})
afterEach(async () => { await db.exec('ROLLBACK; RESET ROLE;') })
afterAll(async () => { await db.close() })
async function receive(category: string, quantity: number, capacity: number, unit = 'pieces') {
  const { rows } = await db.query<{ id: string }>("INSERT INTO public.consumable_receipts(category,item_name,specification,quantity,unit,date_received,capacity_gb) VALUES ($1,'Test stock','Test specification',$2,$3,'2026-09-08',$4) RETURNING id", [category, quantity, unit, capacity])
  return rows[0].id
}
async function create(tag = 'STOCK-PC') {
  await db.query("INSERT INTO public.assets(tag,qr_id,name,category,ram_modules,ram_capacity_gb,ssd_count,ssd_capacity_gb,ram_receipt_id,ssd_receipt_id) VALUES ($1,$1,'Test unit','System Unit',2,8,1,512,$2,$3)", [tag, ram, ssd])
}
async function used(id: string) { return (await db.query<{ used_quantity: number }>('SELECT used_quantity FROM public.consumable_receipts WHERE id=$1', [id])).rows[0].used_quantity }
async function edit(sql: string, values: unknown[] = []) {
  return db.query(`UPDATE public.assets SET ${sql} WHERE tag='STOCK-PC'`, values)
}
async function rejectsWithoutChanges(action: () => Promise<unknown>, message: RegExp) {
  await db.exec('SAVEPOINT expected_failure')
  await expect(action()).rejects.toThrow(message)
  await db.exec('ROLLBACK TO SAVEPOINT expected_failure')
}
describe('system unit consumable stock', () => {
  it('deducts RAM and SSD together and records the asset and authenticated actor', async () => {
    await create()
    expect(await used(ram)).toBe(2); expect(await used(ssd)).toBe(1)
    const rows = (await db.query('SELECT asset_tag, action, performed_by FROM public.consumable_movements')).rows
    expect(rows).toHaveLength(2)
    expect(rows[0]).toEqual({ asset_tag: 'STOCK-PC', action: 'Installed', performed_by: admin })
  })
  it('does not deduct twice for repeated edits or unrelated changes', async () => {
    await create()
    await edit("ram_modules=2, ssd_count=1, name='Renamed unit'")
    await edit("ram_modules=2, ssd_count=1, state='Maintenance'")
    expect(await used(ram)).toBe(2); expect(await used(ssd)).toBe(1)
    expect((await db.query('SELECT * FROM public.consumable_movements')).rows).toHaveLength(2)
  })
  it('deducts only the extra installed parts', async () => {
    await create(); await edit('ram_modules=3, ssd_count=2')
    expect(await used(ram)).toBe(3); expect(await used(ssd)).toBe(2)
  })
  it('returns only parts explicitly marked usable and records discarded parts without restoring stock', async () => {
    await create()
    await edit('ram_modules=1, return_ram_to_stock=true, ssd_receipt_id=NULL, ssd_count=0, return_ssd_to_stock=false')
    expect(await used(ram)).toBe(1); expect(await used(ssd)).toBe(1)
    const actions = (await db.query<{ action: string }>('SELECT action FROM public.consumable_movements')).rows.map(row => row.action)
    expect(actions).toContain('Returned'); expect(actions).toContain('Removed / used')
    // Return is a single-save choice and never leaks into a later edit.
    expect((await db.query<{ return_ram_to_stock: boolean }>("SELECT return_ram_to_stock FROM public.assets WHERE tag='STOCK-PC'")).rows[0].return_ram_to_stock).toBe(false)
  })
  it('replaces a source, retaining discarded stock and deducting the replacement', async () => {
    await create()
    const replacement = await receive('RAM', 4, 16)
    await edit('ram_receipt_id=$1, ram_capacity_gb=16', [replacement])
    expect(await used(ram)).toBe(2); expect(await used(replacement)).toBe(2)
  })
  it('rolls back the entire registration if either component is short of stock', async () => {
    ssd = await receive('SSD', 1, 512)
    await create('FIRST-PC')
    await rejectsWithoutChanges(() => create(), /Not enough SSD/)
    expect(await used(ram)).toBe(2)
    expect((await db.query("SELECT * FROM public.assets WHERE tag='STOCK-PC'")).rows).toHaveLength(0)
    expect((await db.query('SELECT * FROM public.consumable_movements')).rows).toHaveLength(2)
  })
  it('rolls back returns and edits when replacement stock is unavailable', async () => {
    await create()
    const replacement = await receive('RAM', 1, 8)
    await rejectsWithoutChanges(() => edit('ram_receipt_id=$1, return_ram_to_stock=true', [replacement]), /Not enough RAM/)
    expect(await used(ram)).toBe(2); expect(await used(replacement)).toBe(0)
    expect((await db.query<{ ram_receipt_id: string }>("SELECT ram_receipt_id FROM public.assets WHERE tag='STOCK-PC'")).rows[0].ram_receipt_id).toBe(ram)
  })
  it('rejects stale component edits', async () => {
    await create()
    const version = (await db.query<{ stock_version: number }>("SELECT stock_version FROM public.assets WHERE tag='STOCK-PC'")).rows[0].stock_version
    await edit('ram_modules=3')
    await rejectsWithoutChanges(() => edit('ram_modules=4, stock_version=$1', [version]), /another session/)
    expect(await used(ram)).toBe(3)
  })
  it('rejects category mismatches, boxes, capacity mismatches, and non-system units', async () => {
    await rejectsWithoutChanges(() => { const original = ram; ram = ssd; const result = create(); ram = original; return result }, /valid RAM/)
    const boxes = await receive('RAM', 2, 8, 'boxes')
    await create()
    await rejectsWithoutChanges(() => edit('ram_receipt_id=$1', [boxes]), /pieces/)
    await rejectsWithoutChanges(() => edit('ram_capacity_gb=16'), /capacity must match/)
    await rejectsWithoutChanges(() => edit("category='Monitor'"), /only be installed/)
  })
  it('preserves pre-existing device specifications without automatically consuming receipts', async () => {
    await db.query("UPDATE public.assets SET ram_modules=4 WHERE tag='PC-MRR-01'")
    expect(await used(ram)).toBe(0)
    expect((await db.query('SELECT * FROM public.consumable_movements')).rows).toHaveLength(0)
  })
  it('prevents forged stock balances and usage history', async () => {
    await rejectsWithoutChanges(() => db.query('UPDATE public.consumable_receipts SET used_quantity=0'), /permission denied/)
    await rejectsWithoutChanges(() => db.query("INSERT INTO public.consumable_receipts(category,item_name,specification,quantity,date_received,used_quantity) VALUES ('RAM','Fake','Fake',10,'2026-09-08',0)"), /permission denied/)
    await rejectsWithoutChanges(() => db.query("INSERT INTO public.consumable_movements(action) VALUES ('Returned')"), /permission denied/)
  })
  it('blocks non-admin writes and hides stock movements', async () => {
    await create()
    await db.query("SELECT set_config('request.jwt.claim.sub', $1, false)", [other])
    expect((await db.query('SELECT * FROM public.consumable_movements')).rows).toHaveLength(0)
    await rejectsWithoutChanges(() => create('OTHER-PC'), /Administrator access|row-level security/)
  })
})
