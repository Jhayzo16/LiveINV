import { chromium, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { mockAdminAuth, signInMockAdmin } from './mock-admin-auth.mjs'

// Intercepted fixtures only: these checks never modify production inventory.
const rows = [
  { tag: 'QA-ROUTER', name: 'Network router', category: 'Router', state: 'Active', ip: '10.20.1.10', location: 'F1 · Laboratory', owner: 'Laboratory' },
  { tag: 'QA-REPAIR', name: 'Repair monitor', category: 'Monitor', state: 'Broken', ip: '—', location: 'F1 · Laboratory', owner: 'Laboratory' },
  { tag: 'QA-STOCK', name: 'Spare keyboard', category: 'Keyboard', state: 'Active', ip: '—', location: 'Unassigned', owner: 'Unassigned' },
].map((row, index) => ({ ...row, id: String(index), qr_id: `LIV-BUTTON${index}`, brand: 'QA', model: row.name, created_at: '2026-09-08T00:00:00Z' }))
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
let page
try {
  page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  page.setDefaultTimeout(10000)
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await mockAdminAuth(page)
  await page.route('**/rest/v1/assets?*', route => route.fulfill({ json: rows }))
  await page.route('**/rest/v1/consumable_receipts?*', route => route.fulfill({ json: [] }))
  await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:5173')
  await signInMockAdmin(page)
  const navigate = name => page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name, exact: true }).click()
  const search = page.getByRole('button', { name: '⌕ Search', exact: true })
  await expect(search).toBeVisible()
  await search.hover()
  await expect(search).toHaveCSS('filter', 'brightness(0.94)')
  await page.mouse.move(0, 0)
  await page.keyboard.press('Tab')
  await search.focus()
  await expect(search).toHaveCSS('outline-style', 'solid')
  await search.press('Enter')
  const searchDialog = page.getByRole('dialog', { name: 'Search inventory' })
  await expect(searchDialog.getByLabel('Find an asset')).toBeFocused()
  await searchDialog.getByLabel('Find an asset').fill('no such device')
  await expect(searchDialog).toContainText('No matching assets.')
  await searchDialog.getByLabel('Find an asset').fill('liv-button0')
  await searchDialog.getByRole('button', { name: /QA-ROUTER/ }).click()
  await expect(page.getByRole('dialog', { name: 'QA-ROUTER', exact: true })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()

  await page.getByRole('button', { name: 'Notifications', exact: true }).click()
  const alerts = page.getByRole('dialog', { name: 'Inventory alerts' })
  await expect(alerts).toContainText('2 devices needing attention')
  await expect(alerts.getByRole('button', { name: /QA-ROUTER/ })).toHaveCount(0)
  await alerts.getByRole('button', { name: /QA-REPAIR/ }).click()
  await expect(page.getByRole('dialog', { name: 'QA-REPAIR', exact: true })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
  await navigate('Dashboard')
  await page.getByRole('button', { name: '＋ Add new asset', exact: true }).click()
  await expect(page.getByRole('dialog', { name: 'Add a new device' })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  await navigate('Dashboard')
  await navigate(/^Assets/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await navigate('Dashboard')
  await page.locator('.recent').getByRole('button', { name: /QA-STOCK/ }).click()
  await expect(page.getByRole('dialog', { name: 'QA-STOCK', exact: true })).toBeVisible()
  await page.getByRole('dialog').getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'Switch to list view' }).click()
  await expect(page.locator('.asset-list-view')).toBeVisible()
  await page.getByRole('button', { name: 'Switch to grid view' }).click()
  await expect(page.locator('.asset-list-view')).toHaveCount(0)

  await navigate('Reports')
  const download = async button => {
    const pending = page.waitForEvent('download')
    await button.click()
    const file = await pending, stream = await file.createReadStream(), chunks = []
    for await (const chunk of stream) chunks.push(chunk)
    return Buffer.concat(chunks).toString('utf8')
  }
  for (const [title, tags] of [
    ['Inventory master list', ['QA-ROUTER', 'QA-REPAIR', 'QA-STOCK']],
    ['Network assignment', ['QA-ROUTER']],
    ['Maintenance status', ['QA-REPAIR']],
    ['Unassigned devices', ['QA-STOCK']],
  ]) {
    const csv = await download(page.locator('.report-tile').filter({ hasText: title }))
    expect(csv.split('\n')).toHaveLength(tags.length + 1)
    for (const row of rows) expect(csv.includes(row.tag)).toBe(tags.includes(row.tag))
  }
  const networkCsv = await download(page.locator('.exports-card button').filter({ hasText: 'Network Devices' }))
  expect(networkCsv).toContain('QA-ROUTER')
  expect(networkCsv).not.toContain('QA-REPAIR')
  mkdirSync('.tmp/button-actions', { recursive: true })
  await page.screenshot({ path: '.tmp/button-actions/reports-desktop.png' })
  await search.click()
  await searchDialog.press('Escape')
  await expect(search).toBeFocused()

  await page.setViewportSize({ width: 390, height: 844 })
  await search.click()
  await searchDialog.getByLabel('Find an asset').fill('QA-STOCK')
  await expect(searchDialog.getByRole('button', { name: /QA-STOCK/ })).toBeVisible()
  expect(await searchDialog.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true)
  await page.screenshot({ path: '.tmp/button-actions/search-mobile.png' })
  await searchDialog.getByRole('button', { name: 'Close', exact: true }).click()
  await page.getByRole('button', { name: 'Notifications', exact: true }).click()
  await expect(alerts).toContainText('QA-REPAIR')
  await alerts.getByRole('button', { name: 'Close', exact: true }).click()
  expect(errors).toEqual([])
  console.log('PASS: search, alerts, quick registration, recent records, grid/list toggle, all report cards, filtered exports, hover/focus, Escape, and mobile dialogs.')
} catch (error) {
  mkdirSync('.tmp/button-actions', { recursive: true })
  await page?.screenshot({ path: '.tmp/button-actions/failure.png' })
  console.log(await page?.locator('body').innerText())
  throw error
} finally {
  await browser.close()
}
