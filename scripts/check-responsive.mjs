import { chromium, expect } from '@playwright/test'
import { mkdirSync, writeFileSync } from 'node:fs'
import { mockAdminAuth, signInMockAdmin } from './mock-admin-auth.mjs'

// Run against the local Vite server. All Supabase requests are intercepted fixtures.
// Optional: PLAYWRIGHT_CHANNEL=msedge, MOBILE_WIDTHS=390, MOBILE_HEIGHT=844.
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? {channel:process.env.PLAYWRIGHT_CHANNEL} : {}) })
const rows = [
 {tag:'QA-PC-001',name:'Hospital workstation with a long descriptive equipment name',category:'System Unit',state:'Active',location:'F1 · Laboratory',owner:'Laboratory',ip:'10.20.1.10',processor:'Intel Core i5',ram_capacity_gb:16,ram_modules:1,ssd_capacity_gb:512,ssd_count:1},
 {tag:'QA-MONITOR-002',name:'Diagnostic monitor',category:'Monitor',state:'Broken',location:'F1 · Laboratory',owner:'Laboratory',ip:'—'},
 {tag:'QA-SPARE-003',name:'Spare keyboard',category:'Keyboard',state:'Active',location:'Unassigned',owner:'Unassigned',ip:'—'}
].map((row,i)=>({...row,id:`00000000-0000-4000-8000-00000000000${i+2}`,qr_id:`LIV-MOBILE00${i}`,brand:'Test brand',model:row.name,created_at:'2026-09-08T00:00:00Z'}))
const receipts=[{id:'receipt-1',category:'RAM',item_name:'Kingston memory for hospital workstations',brand:'Kingston',specification:'16 GB DDR4 3200 MHz',quantity:20,used_quantity:3,capacity_gb:16,unit:'pieces',date_received:'2026-09-08',supplier:'Hospital equipment and technology supplier',reference_number:'PO-2026-RECEIVING-001',received_by:'Inventory receiving personnel',notes:'Checked on receipt',created_at:'2026-09-08T00:00:00Z'}]
const sessions=[{id:'session-1',service_date:'2026-09-08',service_type:'Preventive maintenance',technician:'Hospital IT maintenance personnel',notes:'Routine inspection',status:'In Progress',created_at:'2026-09-08T00:00:00Z',created_by:'00000000-0000-4000-8000-000000000001',completed_at:null}]
const records=[{id:'record-1',session_id:'session-1',asset_id:rows[0].id,asset_tag:rows[0].tag,qr_id:rows[0].qr_id,asset_name:rows[0].name,category:rows[0].category,location:rows[0].location,department:rows[0].owner,method:'manual',recorded_by:'00000000-0000-4000-8000-000000000001',recorded_at:'2026-09-08T00:00:00Z'}]
const results=[]
mkdirSync('.tmp/responsive',{recursive:true})
try {
for (const width of (process.env.MOBILE_WIDTHS || '320,390,768,1024,1280,1440').split(',').map(Number)) {
 const page=await browser.newPage({viewport:{width,height:Number(process.env.MOBILE_HEIGHT || (width>=1280?1000:844))},isMobile:width<768,hasTouch:width<=1024,reducedMotion:'reduce'})
 page.setDefaultTimeout(10000)
 const errors=[];page.on('pageerror',e=>errors.push(e.message))
 await page.routeWebSocket('**/*.supabase.co/**', socket=>socket.close())
 await page.route('**/*.supabase.co/**', r=>r.fulfill({status:200,json:[]}))
 await mockAdminAuth(page)
 await page.route('**/rest/v1/**',async r=>{const table=new URL(r.request().url()).pathname.split('/').at(-1);if(table==='admin_users') return r.fallback(); if(r.request().method()!=='GET') return r.fulfill({status:400,json:{message:'Read-only mobile fixture'}});return r.fulfill({json:({assets:rows,consumable_receipts:receipts,pms_sessions:sessions,pms_records:records,consumable_movements:[{id:'movement-1',receipt_id:'receipt-1',asset_tag:'QA-PC-001',category:'RAM',action:'Installed',quantity:1,created_at:'2026-09-08T00:00:00Z'}]})[table]||[]})})
 const inspect=async name=>{
  await page.screenshot({path:`.tmp/responsive/${width}-${name}.png`,animations:'disabled',fullPage:!(await page.getByRole('dialog').count() || await page.getByRole('alertdialog').count())})
  const layout=await page.evaluate(()=>({viewportWidth:innerWidth,scroll:document.documentElement.scrollWidth,overflow:[...document.querySelectorAll('body *')].filter(e=>{const r=e.getBoundingClientRect();return r.width>0 && (r.right>innerWidth+2||r.left< -2) && !e.closest('svg,canvas,.map-canvas,.hospital-canvas,.data-table,.work-orders,.consumable-table') && getComputedStyle(e).position!=='absolute'}).slice(0,12).map(e=>({tag:e.tagName,cls:e.className,right:Math.round(e.getBoundingClientRect().right)}))}))
  results.push({width,page:name,...layout,errors:[...errors]});console.log(JSON.stringify(results.at(-1)))
  expect(layout.viewportWidth, `${name}: mobile viewport is configured`).toBe(width)
  expect(layout.scroll, `${name}: no sideways page scrolling`).toBeLessThanOrEqual(width + 1)
  expect(layout.overflow, `${name}: content fits or scrolls inside its own container`).toEqual([])
  expect(errors, `${name}: no browser errors`).toEqual([])
  for (const modal of await page.locator('[role="dialog"], [role="alertdialog"], dialog[open]').filter({visible:true}).all()) {
   const box=await modal.boundingBox()
   expect(box.y, `${name}: modal top is reachable`).toBeGreaterThanOrEqual(-1)
   expect(box.y+box.height, `${name}: modal fits screen height`).toBeLessThanOrEqual(page.viewportSize().height+1)
  }
 }
 const nav=async name=>{if(width<=1024)await page.getByRole('button',{name:'Open navigation',exact:true}).click();await page.getByRole('navigation',{name:'Primary navigation'}).filter({visible:true}).getByRole('button',{name,exact:typeof name==='string'}).click();await page.waitForTimeout(120)}
 await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:5173');await inspect('login');await signInMockAdmin(page)
 for(const name of ['Dashboard','Assets','Consumables','Assignments','PMS','QR Scanner','Reports','Manual','Live Mapping']){
  await nav(name==='Assets'?/^Assets/:name);await inspect(name.replaceAll(' ','-'))
  if(name==='PMS') {
   await page.locator('.pms-session-list button').first().click()
   await expect(page.getByRole('region',{name:'Current PMS session'})).toBeVisible()
   await page.getByRole('button',{name:'View record for QA-PC-001'}).click();await inspect('pms-record')
   await page.getByRole('button',{name:'Complete session',exact:true}).click();await inspect('pms-confirm');await page.getByRole('alertdialog').getByRole('button',{name:'Cancel',exact:true}).click()
   await page.getByRole('button',{name:'New PMS session',exact:false}).click();await inspect('pms-new-session')
  }
  if(name==='QR Scanner') {
   await page.getByRole('button',{name:'Enter code manually',exact:true}).click()
   await page.locator('.manual-scan-form input').fill('LIV-MOBILE000')
   await page.locator('.manual-scan-form button').click()
   await expect(page.locator('.qr-asset-result')).toBeVisible();await inspect('qr-result')
  }
  if(name==='Assignments') {
   await page.locator('select[name="floor"]').selectOption('1')
   await inspect('assignment-destination')
   await page.locator('.assigned-transfer-row').first().getByRole('button',{name:'Unassign',exact:true}).click();await inspect('unassign-confirm');await page.getByRole('alertdialog').getByRole('button',{name:'Cancel',exact:true}).click()
  }
  if(name==='Live Mapping') {
   const explore = async floor => {
    await page.locator('.mobile-floor-selector:visible, .floor-panel-main:visible').first().waitFor()
    if(await page.locator('.mobile-floor-selector').isVisible()) {
     await page.locator('.mobile-floor-selector').getByRole('button',{name:String(floor),exact:true}).click()
     await page.locator('.mobile-selected-floor button').click()
    } else {
     await page.locator('.floor-panel-main').filter({hasText:`Floor ${floor}`}).click()
     await page.getByRole('button',{name:`Explore Floor ${floor}`,exact:true}).click()
    }
    await page.locator('.floor-svg-layer svg').waitFor()
   }
   await explore(1);await inspect('floor-map')
   await page.getByRole('button',{name:'Show directory',exact:false}).click()
   await page.locator('.floor-room-directory').scrollIntoViewIfNeeded();await inspect('room-directory')
   await page.locator('.directory-list button').filter({hasText:'Laboratory'}).first().click()
   await page.getByRole('dialog').waitFor();await inspect('room-equipment')
   await page.getByRole('button',{name:'View record for QA-PC-001',exact:true}).click();await inspect('room-device-record');await page.getByLabel('Close full device record').click()
   await page.getByLabel('Close equipment popup').click()
   for(let floor=2;floor<=7;floor++) {
    await page.getByRole('button',{name:'← All floors',exact:true}).click()
    await explore(floor);await inspect(`floor-${floor}-map`)
    await page.getByRole('button',{name:'Show directory',exact:false}).click()
    await inspect(`floor-${floor}-directory`)
   }
  }
  if(name==='Assets'){
   await page.getByRole('button',{name:'＋ Add device',exact:true}).click();await inspect('registration')
   const save=page.getByRole('button',{name:'Save device & generate QR →',exact:true})
   await save.scrollIntoViewIfNeeded();await expect(save).toBeInViewport({ratio:1});await inspect('registration-footer')
   await page.locator('input[name="tag"]').fill('QA-QR-MOBILE')
   await page.locator('select[name="category"]').selectOption('Monitor')
   await page.locator('input[name="brand"]').fill('Test brand')
   await page.locator('input[name="model"]').fill('Hospital monitoring display')
   const createStub=r=>r.request().method()==='POST'?r.fulfill({status:201,json:[]}):r.fallback()
   await page.route('**/rest/v1/assets*',createStub)
   await save.click();await expect(page.locator('.generated-qr img')).toBeVisible()
   await expect.poll(()=>page.locator('.device-dialog').evaluate(element=>element.scrollTop)).toBe(0)
   await inspect('generated-qr')
   const download=page.getByRole('link',{name:'Download QR',exact:true})
   await download.scrollIntoViewIfNeeded();await expect(download).toBeInViewport({ratio:1});await inspect('qr-label-actions')
   await page.getByRole('button',{name:'Done',exact:true}).click();await page.unroute('**/rest/v1/assets*',createStub)
   await page.getByRole('button',{name:'Open full record for QA-PC-001'}).click();await inspect('device-record');await page.getByRole('button',{name:'Edit device',exact:true}).click();await inspect('edit-device');await page.getByLabel('Close asset editor').click()
  }
  if(name==='Consumables'){await page.getByRole('button',{name:'＋ Record received stock',exact:true}).click();await inspect('receipt-form');const save=page.getByRole('button',{name:'Record received stock',exact:true});await save.scrollIntoViewIfNeeded();await expect(save).toBeInViewport({ratio:1});await inspect('receipt-footer');await page.getByLabel('Close consumable receipt').click()}
 }
 if(width<=1024){
  const menu=page.getByRole('button',{name:'Open navigation',exact:true})
  await menu.click();await inspect('navigation')
  await page.keyboard.press('Tab')
  expect(await page.evaluate(()=>Boolean(document.activeElement?.closest('#mobile-navigation')))).toBe(true)
  await page.keyboard.press('Escape');await expect(menu).toBeFocused();await expect(menu).toHaveAttribute('aria-expanded','false')
  await menu.click();await page.mouse.click(width-2,10);await expect(menu).toHaveAttribute('aria-expanded','false')
  await menu.click()
  const original=page.viewportSize();await page.setViewportSize({width:1440,height:1000});await expect(page.locator('#mobile-navigation')).not.toBeVisible();await page.setViewportSize(original)
  await menu.click();await page.getByRole('button',{name:'Sign out',exact:true}).click();await page.getByRole('button',{name:'Sign in',exact:true}).waitFor()
 }
 await page.close()
}
} finally {writeFileSync('.tmp/responsive/results.json',JSON.stringify(results,null,2));await browser.close()}
