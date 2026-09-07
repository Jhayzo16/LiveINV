import { chromium, expect } from '@playwright/test'
import { readFileSync } from 'node:fs'

// Browser regression with an intercepted database; no live inventory writes.
const catalog = JSON.parse(readFileSync(new URL('../src/lib/room-catalog.json', import.meta.url), 'utf8'))
const roomId = (floor, name) => catalog[floor].rooms.find(room => room.name === name).id
const rows = [
  { tag: 'AP-OR-03', name: 'Aruba AP-515', category: 'Router', location: 'F2 · Operating Room', state: 'Active', owner: 'IT Department', ip: '10.20.2.11' },
  { tag: 'MON-HR-04', name: 'Dell Monitor', category: 'Monitor', location: 'F5 · HR Office', state: 'Active', owner: 'Human Resources', ip: '—' },
  { tag: 'UPS-LAB-02', name: 'APC UPS', category: 'UPS', location: 'F1 · Laboratory', state: 'Inactive', owner: 'Laboratory', ip: '—' },
  { tag: 'TEST-NEW', name: 'Test PC', category: 'System Unit', location: 'Unassigned', state: 'Active', owner: 'Unassigned', ip: '—' },
].map((row, index) => ({ ...row, id: String(index), qr_id: `LIV-TEST${index}`, created_at: '2026-09-05T00:00:00Z' }))
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/rest/v1/assets?*', async route => {
    const request = route.request()
    if (request.method() === 'PATCH') {
      const tag = new URL(request.url()).searchParams.get('tag').replace(/^eq\./, '')
      const row = rows.find(row => row.tag === tag)
      Object.assign(row, request.postDataJSON())
      await route.fulfill({ json: [{ tag: row.tag }] })
    } else {
      await route.fulfill({ json: rows })
    }
  })
  const openFloor = async floor => {
    await page.getByRole('button', { name: new RegExp(`Select Floor ${floor},`) }).hover()
    await page.getByRole('button', { name: `Explore Floor ${floor}`, exact: true }).click()
    await expect(page.locator('.svg-room-hit-target')).toHaveCount(catalog[floor].rooms.length)
  }
  await page.goto(process.env.TEST_BASE_URL || 'http://localhost:5173')
  await expect(page.getByRole('status').filter({ hasText: 'Loading shared inventory' })).toHaveCount(0)
  await openFloor(2)
  await expect(page.getByRole('region', { name: 'Assets needing a room' })).toContainText('AP-OR-03')
  await page.getByLabel('Exact room for AP-OR-03').selectOption(roomId(2, 'MAJOR OR 1'))
  await page.getByRole('button', { name: 'Save room', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Assets needing a room' })).toHaveCount(0)
  await expect(page.locator(`.svg-room-node[data-room-id="${roomId(2, 'MAJOR OR 1')}"]`)).toHaveClass(/has-device/)
  await page.locator(`.svg-room-hit-target[data-room-id="${roomId(2, 'MAJOR OR 1')}"]`).press('Enter')
  await expect(page.getByRole('dialog')).toContainText('AP-OR-03')
  await expect(page.getByRole('dialog')).toContainText('IT Department')
  await page.reload()
  await openFloor(2)
  await expect(page.locator(`.svg-room-node[data-room-id="${roomId(2, 'MAJOR OR 1')}"]`)).toHaveClass(/has-device/)
  await page.getByRole('button', { name: '← All floors', exact: true }).click()
  await openFloor(1)
  await page.locator(`.svg-room-hit-target[data-room-id="${roomId(1, 'LABORATORY EQUIPMENT AREA')}"]`).click()
  await expect(page.getByRole('dialog')).toContainText('UPS-LAB-02')
  await expect(page.getByRole('dialog')).toContainText('Inactive')
  await page.reload()
  await page.getByRole('button', { name: 'Assignments', exact: true }).click()
  await expect(page.getByRole('heading', {name:'Assign and transfer devices'})).toBeVisible()
  await page.locator('select[name="floor"]').selectOption('5')
  const privateRooms = catalog[5].rooms.filter(room => room.name === 'PRIVATE ROOM')
  await page.getByLabel('Room name or office').selectOption(privateRooms[1].id)
  await page.getByRole('button', { name: 'Assign device →', exact: true }).click()
  await expect(page.getByText('TEST-NEW', { exact: true }).first()).toBeVisible()
  await expect.poll(() => rows.find(row => row.tag === 'TEST-NEW').assignment_room_id).toBe(privateRooms[1].id)
  await page.getByRole('navigation').getByRole('button', { name: 'Live Mapping', exact: true }).click()
  await openFloor(5)
  await expect(page.getByRole('region', { name: 'Assets needing a room' })).toContainText('MON-HR-04')
  await expect(page.locator(`.svg-room-node[data-room-id="${privateRooms[1].id}"]`)).toHaveClass(/has-device/)
  await expect(page.locator(`.svg-room-node[data-room-id="${privateRooms[0].id}"]`)).not.toHaveClass(/has-device/)
  expect(errors).toEqual([])
  console.log('Passed: missing-room visibility, assignment save, reload, highlighting, inactive equipment, duplicate room names, shared assignment IDs; no browser errors.')
} finally {
  await browser.close()
}
