import { chromium, expect } from '@playwright/test'
import { PGlite } from '@electric-sql/pglite'
import { readFileSync, mkdirSync } from 'node:fs'
import { mockAdminAuth, signInMockAdmin } from './mock-admin-auth.mjs'

// Full UI workflow against a disposable database. Never writes live inventory.
const db = await PGlite.create()
const admin = '00000000-0000-4000-8000-000000000001'
await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role; CREATE PUBLICATION supabase_realtime;
  CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY, email text);
  CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql STABLE AS $$ SELECT nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
  GRANT USAGE ON SCHEMA auth TO authenticated, anon;
  INSERT INTO auth.users VALUES ('${admin}','tgmcimis@gmail.com');`)
for (const file of ['20240101000000_initial_schema.sql','20260902020000_create_consumable_receipts.sql','20260907000000_require_admin_login.sql','20260903010000_add_asset_assignment_backend.sql','20260908010000_link_system_unit_consumables.sql']) {
  await db.exec(readFileSync(new URL(`../supabase/migrations/${file}`, import.meta.url),'utf8'))
}
await db.query("SELECT set_config('request.jwt.claim.sub',$1,false)",[admin])
await db.exec('SET ROLE authenticated')
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await mockAdminAuth(page)
  const pageErrors = []
  page.on('pageerror', error => pageErrors.push(error.message))
  await page.route('**/rest/v1/**', async route => {
    const request = route.request(), url = new URL(request.url()), table = url.pathname.split('/').at(-1)
    if (table === 'admin_users') { await route.fallback(); return }
    if (!['assets','consumable_receipts','consumable_movements'].includes(table)) { await route.fulfill({json:[]}); return }
    try {
      let rows
      if (request.method() === 'POST') {
        const body = request.postDataJSON(), keys = Object.keys(body)
        if (!keys.every(key => /^[a-z_]+$/.test(key))) throw new Error('Invalid column')
        rows = (await db.query(`INSERT INTO public.${table} (${keys.join(',')}) VALUES (${keys.map((_,i)=>`$${i+1}`).join(',')}) RETURNING *`,keys.map(key=>body[key]))).rows
      } else if (request.method() === 'PATCH') {
        const body = request.postDataJSON(), keys = Object.keys(body)
        if (table !== 'assets' || !keys.every(key => /^[a-z_]+$/.test(key))) throw new Error('Unexpected update')
        rows = (await db.query(`UPDATE public.assets SET ${keys.map((key,i)=>`${key}=$${i+1}`).join(',')} WHERE tag=$${keys.length+1} RETURNING *`,[...keys.map(key=>body[key]),url.searchParams.get('tag').replace(/^eq\./,'')])).rows
      } else rows = (await db.query(`SELECT * FROM public.${table} ORDER BY created_at DESC, id`)).rows
      rows = rows.map(row => ({ ...row, ...(row.date_received ? { date_received: new Date(row.date_received).toISOString().slice(0,10) } : {}) }))
      await route.fulfill({ json: request.headers()['accept']?.includes('vnd.pgrst.object') ? rows[0] : rows })
    } catch (error) { await route.fulfill({status:400,json:{message:error.message,code:error.code}}) }
  })
  await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:5173')
  await signInMockAdmin(page)
  const navigate = name => page.getByRole('navigation').getByRole('button',{name: name === 'Assets' ? /^Assets/ : name,exact:true}).click()
  await navigate('Consumables')
  async function receive(category, name, count, capacity) {
    await page.getByRole('button',{name:'＋ Record received stock'}).click()
    const dialog = page.getByRole('dialog',{name:'Record received stock'})
    await dialog.getByLabel('Consumable type').selectOption(category)
    await dialog.getByLabel('Item name').fill(name)
    await dialog.getByLabel('Specification / description').fill(`${capacity} GB test stock`)
    await dialog.getByLabel('Capacity per piece (GB)').fill(String(capacity))
    await dialog.getByLabel('Quantity received').fill(String(count))
    await dialog.getByRole('button',{name:'Record received stock',exact:true}).click()
    await expect(dialog).toHaveCount(0)
  }
  await receive('RAM','Kingston RAM',10,16)
  await receive('SSD','Samsung SSD',5,512)
  const receipts = (await db.query('SELECT * FROM public.consumable_receipts')).rows
  const ram = receipts.find(row=>row.category==='RAM'), ssd = receipts.find(row=>row.category==='SSD')
  async function balances(ramUsed,ssdUsed) {
    await expect.poll(async () => (await db.query('SELECT used_quantity FROM public.consumable_receipts WHERE id=$1',[ram.id])).rows[0].used_quantity).toBe(ramUsed)
    await expect.poll(async () => (await db.query('SELECT used_quantity FROM public.consumable_receipts WHERE id=$1',[ssd.id])).rows[0].used_quantity).toBe(ssdUsed)
  }
  await navigate('Assets')
  await page.getByRole('button',{name:'＋ Add device'}).click()
  let dialog = page.getByRole('dialog',{name:'Add a new device'})
  await dialog.getByLabel('Asset tag',{exact:true}).fill('STOCK-UI-01')
  await dialog.getByLabel('Brand name').fill('Dell')
  await dialog.getByLabel('Model',{exact:true}).fill('Stock test unit')
  await dialog.getByLabel('Processor Type').fill('Intel Core i5')
  await dialog.getByLabel('RAM stock source',{exact:true}).selectOption(ram.id)
  await dialog.getByLabel('SSD stock source',{exact:true}).selectOption(ssd.id)
  await dialog.getByLabel('RAM modules installed').fill('2')
  await dialog.getByLabel('SSDs installed').fill('1')
  await expect(dialog.getByLabel('RAM modules installed')).toHaveCount(1)
  await expect(dialog.getByLabel('SSDs installed')).toHaveCount(1)
  await expect(dialog.getByLabel('RAM capacity per module')).toHaveCount(0)
  await expect(dialog.getByLabel('SSD capacity per drive')).toHaveCount(0)
  await expect(dialog.getByText('2 × 16 GB = 32 GB total',{exact:true})).toBeVisible()
  await expect(dialog.getByText('1 × 512 GB = 512 GB total',{exact:true})).toBeVisible()
  mkdirSync('.tmp',{recursive:true})
  await dialog.getByRole('region',{name:'RAM and SSD consumable stock'}).scrollIntoViewIfNeeded()
  await dialog.screenshot({path:'.tmp/stock-registration.png'})
  await page.setViewportSize({width:390,height:844})
  await dialog.getByLabel('SSD stock source',{exact:true}).scrollIntoViewIfNeeded()
  await page.screenshot({path:'.tmp/stock-registration-mobile.png'})
  expect(await dialog.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true)
  await page.setViewportSize({width:1440,height:1000})
  await dialog.getByLabel('RAM modules installed').fill('99')
  await dialog.getByRole('button',{name:'Save device & generate QR →'}).click()
  await expect(dialog.getByRole('alert').filter({hasText:'Not enough RAM stock available'})).toBeVisible()
  await expect(dialog.getByText('DEVICE REGISTERED',{exact:true})).toHaveCount(0)
  await balances(0,0)
  await dialog.getByLabel('RAM modules installed').fill('2')
  await dialog.getByRole('button',{name:'Save device & generate QR →'}).click()
  await expect(dialog.getByText('DEVICE REGISTERED',{exact:true})).toBeVisible()
  await balances(2,1)
  await dialog.getByRole('button',{name:'Done',exact:true}).click()
  async function openEditor() {
    await page.getByRole('button',{name:'Open full record for STOCK-UI-01'}).click()
    await page.getByRole('button',{name:'Edit device',exact:true}).click()
    return page.getByRole('dialog',{name:'Update asset record'})
  }
  async function saveEditor() {
    await dialog.getByRole('button',{name:'Save changes',exact:true}).click()
    await expect(dialog).toHaveCount(0)
    await page.getByRole('button',{name:'Close full device record'}).click()
  }
  dialog = await openEditor()
  await expect(dialog.getByLabel('RAM stock source',{exact:true})).toHaveValue(ram.id)
  await dialog.getByLabel('RAM modules installed').fill('3')
  await saveEditor(); await balances(3,1)
  dialog = await openEditor()
  await dialog.getByLabel('RAM modules installed').fill('2')
  await dialog.getByLabel('RAM removed stock action',{exact:true}).selectOption('return')
  await dialog.getByLabel('SSDs installed').fill('0')
  await dialog.getByLabel('SSD removed stock action',{exact:true}).selectOption('discard')
  await saveEditor(); await balances(2,1)
  dialog = await openEditor()
  await dialog.getByLabel('Model',{exact:true}).fill('Unrelated edit')
  await saveEditor(); await balances(2,1)
  dialog = await openEditor()
  await dialog.getByLabel('RAM modules installed').fill('99')
  await dialog.getByRole('button',{name:'Save changes',exact:true}).click()
  await expect(dialog.getByRole('alert').filter({hasText:'Not enough RAM stock available'})).toBeVisible()
  await balances(2,1)
  await expect(dialog).toBeVisible()
  await dialog.getByLabel('RAM modules installed').fill('2')
  await dialog.getByRole('button',{name:'Cancel',exact:true}).click()
  await page.reload(); await navigate('Consumables')
  const history = page.getByRole('region',{name:'Consumable usage history'})
  await expect(history).toContainText('STOCK-UI-01')
  await expect(history).toContainText('Returned')
  await expect(history).toContainText('Removed / used')
  await expect(page.getByText('8 available',{exact:true})).toBeVisible()
  await expect(page.getByText('4 available',{exact:true})).toBeVisible()
  await page.screenshot({path:'.tmp/stock-history-desktop.png',fullPage:true})
  await page.setViewportSize({width:390,height:844})
  await page.getByText('8 available',{exact:true}).scrollIntoViewIfNeeded()
  await expect(page.getByText('8 available',{exact:true})).toBeVisible()
  await page.screenshot({path:'.tmp/stock-history-mobile.png'})
  expect(await page.locator('.module-workspace').evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true)
  expect(pageErrors).toEqual([])
  console.log('Passed: stock receiving, linked RAM/SSD registration, automatic capacity, incremental edits, explicit returns/discards, no duplicate deduction, insufficient-stock rollback with visible error, saved history, desktop/mobile layout.')
} finally { await browser.close(); await db.close() }
