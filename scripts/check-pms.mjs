import { chromium, expect } from '@playwright/test'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, mkdirSync } from 'node:fs'
import { mockAdminAuth, signInMockAdmin } from './mock-admin-auth.mjs'

// End-to-end UI against a disposable PostgreSQL database. No live inventory writes.
const db = await PGlite.create()
const admin = '00000000-0000-4000-8000-000000000001'
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
  CREATE SCHEMA auth; CREATE TABLE auth.users (id uuid PRIMARY KEY, email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO authenticated, anon;
  INSERT INTO auth.users VALUES ('${admin}', 'tgmcimis@gmail.com');`)
for (const file of ['20240101000000_initial_schema.sql', '20260902020000_create_consumable_receipts.sql', '20260907000000_require_admin_login.sql', '20260907010000_create_pms.sql']) await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url), 'utf8'))
await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)", [admin])
await db.exec('SET ROLE authenticated')
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await mockAdminAuth(page)
  let failNextScan = false
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.route('**/rest/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), table = url.pathname.split('/').at(-1)
    if (table === 'admin_users') { await route.fallback(); return }
    try {
      let rows
      if (url.pathname.includes('/rpc/')) {
        const body = request.postDataJSON()
        if (table === 'record_pms_asset' && failNextScan) { failNextScan = false; await route.fulfill({ status: 503, json: { message: 'Test connection failure' } }); return }
        const args = table === 'create_pms_session' ? [body.p_id, body.p_date, body.p_service, body.p_technician, body.p_notes] : table === 'record_pms_asset' ? [body.p_session_id, body.p_code, body.p_method] : [body.p_session_id]
        if (!['create_pms_session', 'record_pms_asset', 'complete_pms_session'].includes(table)) throw new Error('Unexpected RPC')
        const result = await db.query(`SELECT to_jsonb(public.${table}(${args.map((_, index) => `$${index + 1}`).join(',')})) AS data`, args)
        await route.fulfill({ json: result.rows[0].data }); return
      }
      if (table === 'assets') rows = (await db.query('SELECT * FROM public.assets ORDER BY created_at DESC')).rows
      else if (table === 'pms_sessions') rows = (await db.query('SELECT to_jsonb(s) AS data FROM public.pms_sessions s ORDER BY service_date DESC, created_at DESC, id')).rows.map(row => row.data)
      else if (table === 'pms_records') rows = (await db.query('SELECT * FROM public.pms_records WHERE session_id = $1 ORDER BY recorded_at DESC, id', [url.searchParams.get('session_id').replace(/^eq\./, '')])).rows
      else rows = []
      await route.fulfill({ json: rows })
    } catch (error) { console.log(`Test database ${table}: ${error.message}`); await route.fulfill({ status: 400, json: { message: error.message, code: error.code } }) }
  })
  await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:5173')
  await signInMockAdmin(page)
  const openPms = () => page.getByRole('navigation').getByRole('button', { name: 'PMS', exact: true }).click()
  await openPms()
  await expect(page.getByRole('heading', { name: 'PMS', exact: true })).toBeVisible()
  await page.getByLabel('Maintenance date').fill('2026-08-12')
  await page.getByLabel('IT personnel / technician').fill('IT Maintenance Team')
  await page.getByRole('button', { name: 'Start session', exact: true }).click()
  const detail = page.getByRole('region', { name: 'Current PMS session' })
  await expect(detail).toContainText('Aug 12, 2026')
  await expect(detail.getByRole('button', { name: 'Complete session' })).toBeDisabled()
  const input = detail.getByLabel('QR number or asset tag')
  const mark = async code => { await input.fill(code); await detail.getByRole('button', { name: 'Mark maintained' }).click() }
  const assetBefore = (await db.query("SELECT * FROM public.assets WHERE tag='AP-OR-03'")).rows
  await mark('UNKNOWN')
  await expect(detail.getByRole('alert')).toContainText('No registered asset')
  await expect(detail.getByRole('heading', { name: 'No assets maintained yet' })).toBeVisible()
  await mark('liveinv:qr:LIV-OR00003')
  await expect(detail.getByRole('status')).toContainText('AP-OR-03 marked maintained')
  await expect(detail.locator('tbody tr')).toHaveCount(1)
  await mark('AP-OR-03')
  await expect(detail.getByRole('status')).toContainText('already maintained')
  await expect(detail.locator('tbody tr')).toHaveCount(1)
  failNextScan = true
  await mark('PC-MRR-01')
  await expect(detail.getByRole('alert')).toContainText('Test connection failure')
  await expect(detail.locator('tbody tr')).toHaveCount(1)
  await mark('PC-MRR-01')
  await expect(detail.locator('tbody tr')).toHaveCount(2)
  expect((await db.query("SELECT * FROM public.assets WHERE tag='AP-OR-03'")).rows).toEqual(assetBefore)
  await page.reload(); await openPms()
  await expect(detail.locator('tbody tr')).toHaveCount(2)
  mkdirSync('.tmp', { recursive: true })
  await page.screenshot({ path: '.tmp/pms-desktop.png', animations: 'disabled' })
  await page.setViewportSize({ width: 390, height: 844 })
  await detail.getByRole('button', { name: 'Scan asset QR' }).click({ trial: true })
  await detail.getByRole('heading', { name: 'Maintained assets' }).scrollIntoViewIfNeeded()
  await detail.getByLabel('Search maintained assets').click()
  await page.screenshot({ path: '.tmp/pms-mobile.png', animations: 'disabled' })
  expect(await page.locator('.pms-module').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
  await page.setViewportSize({ width: 1440, height: 1000 })
  await detail.getByRole('button', { name: 'Complete session' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel' }).click()
  await expect(detail.getByRole('button', { name: 'Scan asset QR' })).toBeVisible()
  await detail.getByRole('button', { name: 'Complete session' }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm completion' }).click()
  await expect(detail).toContainText('This session is complete')
  await expect(detail.getByRole('button', { name: 'Mark maintained' })).toHaveCount(0)
  await page.getByRole('button', { name: '＋ New PMS session' }).click()
  await page.getByLabel('Maintenance date').fill('2026-09-07')
  await page.getByLabel('Service', { exact: true }).selectOption('General cleaning')
  await page.getByLabel('IT personnel / technician').fill('Cleaning Team')
  await page.getByRole('button', { name: 'Start session', exact: true }).click()
  await mark('AP-OR-03')
  await expect(detail.locator('tbody tr')).toHaveCount(1)
  expect((await db.query('SELECT * FROM public.pms_records')).rows).toHaveLength(3)
  await page.getByRole('complementary', { name: 'PMS session history' }).getByRole('button').filter({ hasText: 'Aug 12, 2026' }).click()
  await expect(detail.locator('tbody tr')).toHaveCount(2)
  await expect(detail).toContainText('This session is complete')
  expect(pageErrors).toEqual([])
  console.log('Passed: PMS navigation, selected service date, durable sessions, registered-code validation, duplicate protection, failed save, session history, completion, repeat maintenance in a new session, unchanged inventory, desktop/mobile layout.')
} finally { await browser.close(); await db.close() }
