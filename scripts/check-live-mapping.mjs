import { chromium, expect } from '@playwright/test'
import { mkdirSync, readFileSync } from 'node:fs'
import { mockAdminAuth, signInMockAdmin } from './mock-admin-auth.mjs'

// Browser regression with an intercepted database; no live inventory writes.
const catalog = JSON.parse(readFileSync(new URL('../src/lib/room-catalog.json', import.meta.url), 'utf8'))
const roomId = (floor, name) => catalog[floor].rooms.find(room => room.name === name).id
const rows = [
  { tag: 'AP-OR-03', name: 'Aruba AP-515', category: 'Router', location: 'F2 · Operating Room', state: 'Active', owner: 'IT Department', ip: '10.20.2.11' },
  { tag: 'MON-HR-04', name: 'Dell Monitor', category: 'Monitor', location: 'F5 · HR Office', state: 'Active', owner: 'Human Resources', ip: '—' },
  { tag: 'UPS-LAB-02', name: 'APC UPS', category: 'UPS', location: 'F1 · Laboratory', state: 'Inactive', owner: 'Laboratory', ip: '—' },
  { tag: 'TEST-NEW', name: 'Test PC', category: 'System Unit', location: 'Unassigned', state: 'Active', owner: 'Unassigned', ip: '—', processor: 'Intel Core i5 test processor' },
].map((row, index) => ({ ...row, id: String(index), qr_id: `LIV-TEST${index}`, created_at: '2026-09-05T00:00:00Z' }))
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  await mockAdminAuth(page)
  const errors = []
  let rejectNextUpdate = false
  let updateCount = 0
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/rest/v1/assets?*', async route => {
    const request = route.request()
    if (request.method() === 'PATCH') {
      updateCount++
      if (rejectNextUpdate) {
        rejectNextUpdate = false
        await route.fulfill({ status: 500, json: { message: 'Test save failure' } })
        return
      }
      const tag = new URL(request.url()).searchParams.get('tag').replace(/^eq\./, '')
      const row = rows.find(row => row.tag === tag)
      Object.assign(row, request.postDataJSON())
      await route.fulfill({ json: [{ tag: row.tag }] })
    } else {
      await route.fulfill({ json: rows })
    }
  })
  const openFloor = async floor => {
    await page.getByRole('navigation').getByRole('button', { name: 'Live Mapping', exact: true }).click()
    await page.getByRole('button', { name: new RegExp(`Select Floor ${floor},`) }).hover()
    await page.getByRole('button', { name: `Explore Floor ${floor}`, exact: true }).click()
    await expect(page.locator('.svg-room-hit-target')).toHaveCount(catalog[floor].rooms.length)
  }
  await page.goto(process.env.TEST_BASE_URL || 'http://localhost:5173')
  await signInMockAdmin(page)
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
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('img', { name: 'QR code for AP-OR-03', exact: true })).toBeVisible()
  await expect(dialog).toContainText('LIV-TEST0')
  const originalQr = await dialog.getByRole('img', { name: 'QR code for AP-OR-03', exact: true }).getAttribute('src')
  await dialog.getByRole('button', { name: 'Select AP-OR-03', exact: true }).click()
  await expect(page.getByRole('dialog')).toHaveCount(1)
  await expect(page.locator('.device-record-dialog')).toHaveCount(0)
  await expect(dialog.getByText('View record →', { exact: true })).toHaveCount(0)
  const savesBeforeCancel = updateCount
  await dialog.getByRole('button', { name: 'Unassign from room', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(updateCount).toBe(savesBeforeCancel)
  await expect(dialog).toBeVisible()
  await dialog.getByRole('button', { name: 'Unassign from room', exact: true }).click()
  await page.getByRole('alertdialog').press('Escape')
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(dialog).toBeVisible()
  expect(updateCount).toBe(savesBeforeCancel)

  // A rejected save leaves both the record and room intact and allows retry.
  rejectNextUpdate = true
  await dialog.getByRole('button', { name: 'Unassign from room', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm unassign', exact: true }).click()
  await expect(page.getByRole('alertdialog').getByRole('alert')).toContainText('Test save failure')
  expect(rows[0].assignment_room_id).toBe(roomId(2, 'MAJOR OR 1'))
  await page.getByRole('alertdialog').getByRole('button', { name: 'Cancel', exact: true }).click()

  // Removing the last device in the selected category selects the remaining device.
  await dialog.getByLabel('Available asset or device').selectOption('TEST-NEW')
  await dialog.getByRole('button', { name: 'Assign to this room', exact: true }).click()
  await expect(dialog.getByRole('button', { name: 'All 2', exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Select TEST-NEW', exact: true }).click()
  await expect(dialog.locator('.room-focus-selected').getByRole('heading', { name: 'TEST-NEW', exact: true })).toBeVisible()
  await expect(dialog.getByRole('img', { name: 'QR code for TEST-NEW', exact: true })).toBeVisible()
  await expect(page.locator('.device-record-dialog')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Routers 1', exact: true }).click()
  await dialog.getByRole('button', { name: 'Unassign from room', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm unassign', exact: true }).click()
  await expect(page.getByRole('alertdialog')).toHaveCount(0)
  await expect(dialog.getByRole('status')).toContainText('AP-OR-03 was unassigned')
  await expect(dialog.getByRole('img', { name: 'QR code for TEST-NEW', exact: true })).toBeVisible()
  await expect(dialog.getByRole('button', { name: 'All 1', exact: true })).toHaveAttribute('aria-pressed', 'true')
  expect(rows[0].location).toBe('Unassigned')
  expect(rows[0].assignment_room_id).toBeNull()
  expect(rows[0].qr_id).toBe('LIV-TEST0')
  await expect(dialog.getByLabel('Available asset or device').locator('option[value="AP-OR-03"]')).toHaveCount(1)

  // Empty rooms lose their map highlight; both devices remain available.
  await dialog.getByRole('button', { name: 'Unassign from room', exact: true }).click()
  await page.getByRole('alertdialog').getByRole('button', { name: 'Confirm unassign', exact: true }).click()
  await expect(dialog).toContainText('No equipment assigned')
  await expect(page.locator(`.svg-room-node[data-room-id="${roomId(2, 'MAJOR OR 1')}"]`)).not.toHaveClass(/has-device/)
  await page.reload()
  await openFloor(2)
  await page.locator(`.svg-room-hit-target[data-room-id="${roomId(2, 'MAJOR OR 1')}"]`).press('Enter')
  await expect(dialog).toContainText('No equipment assigned')
  await dialog.getByLabel('Available asset or device').selectOption('AP-OR-03')
  await dialog.getByRole('button', { name: 'Assign to this room', exact: true }).click()
  await expect(dialog.getByRole('img', { name: 'QR code for AP-OR-03', exact: true })).toHaveAttribute('src', originalQr)
  if (process.env.CAPTURE_MAPPING_UI) {
    mkdirSync('.tmp', { recursive: true })
    await page.screenshot({ path: '.tmp/room-device-desktop.png' })
    await page.setViewportSize({ width: 390, height: 844 })
    await dialog.locator('.asset-qr-copy').scrollIntoViewIfNeeded()
    expect(await dialog.locator('.room-focus-layout').evaluate(element => element.scrollWidth <= element.clientWidth + 1)).toBe(true)
    await page.screenshot({ path: '.tmp/room-device-mobile.png' })
    await dialog.getByRole('button', { name: 'Select AP-OR-03', exact: true }).click()
    await expect(page.locator('.device-record-dialog')).toHaveCount(0)
    await page.setViewportSize({ width: 1440, height: 1000 })
  }
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
  await page.getByRole('navigation').getByRole('button', { name: /^Assets/ }).click()
  await page.locator('.asset-device-card').filter({ hasText: 'AP-OR-03' }).click()
  await expect(page.getByRole('dialog').getByRole('img', { name: 'QR code for AP-OR-03', exact: true })).toHaveAttribute('src', originalQr)
  await expect(page.getByRole('dialog').getByRole('img', { name: 'QR code for AP-OR-03', exact: true })).toBeInViewport({ ratio: 1 })
  expect(errors).toEqual([])
  console.log('Passed: room device selection without opening records, QR labels, room unassignment, cancel, Escape, failed save, category fallback, empty room, reassignment, persistence, missing-room visibility, highlighting, inactive equipment, duplicate room names; no browser errors.')
} finally {
  await browser.close()
}
