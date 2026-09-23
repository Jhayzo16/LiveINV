import { chromium, expect } from '@playwright/test'
import { mockAdminAuth, signInMockAdmin } from './mock-admin-auth.mjs'

// All authentication and inventory requests are intercepted; no live data is changed.
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
const errors = []
async function openMap(context) {
  const page = await context.newPage()
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }))
  await mockAdminAuth(page)
  await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:5173')
  await signInMockAdmin(page)
  await page.getByRole('navigation').getByRole('button', { name: 'Live Mapping', exact: true }).click()
  await page.getByRole('button', { name: /Select Floor 1,/ }).hover()
  await page.getByRole('button', { name: 'Explore Floor 1', exact: true }).click()
  await expect(page.locator('.svg-room-hit-target').first()).toBeAttached()
  await page.locator('.map-viewport').evaluate(async element => {
    await Promise.all(element.closest('.floor-workspace').getAnimations({ subtree: true }).map(animation => animation.finished))
  })
  return page
}
const view = page => page.locator('.map-canvas').evaluate(element => {
  const matrix = new DOMMatrix(getComputedStyle(element).transform)
  const rect = element.getBoundingClientRect()
  return { zoom: matrix.a, x: matrix.e, y: matrix.f, left: rect.left, top: rect.top, width: rect.width, height: rect.height }
})
const normalized = (state, point) => ({ x: (point.x - state.left) / state.width, y: (point.y - state.top) / state.height })
async function roomPoint(page) {
  return page.locator('.map-viewport').evaluate(viewport => {
    const clip = viewport.getBoundingClientRect()
    for (const room of viewport.querySelectorAll('.svg-room-hit-target')) {
      const rect = room.getBoundingClientRect()
      const x = rect.left + rect.width / 2, y = rect.top + rect.height / 2
      if (x > clip.left + 20 && x < clip.right - 60 && y > clip.top + 20 && y < clip.bottom - 60
        && document.elementFromPoint(x, y)?.closest('[data-room-id]')) return { x, y }
    }
    throw new Error('No visible room found')
  })
}
try {
  const desktop = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await openMap(desktop)
  const rect = await page.locator('.map-viewport').boundingBox()
  const anchor = { x: rect.x + rect.width * .6, y: rect.y + rect.height * .4 }
  const before = await view(page)
  const scrollBefore = await page.evaluate(() => window.scrollY)
  await page.mouse.move(anchor.x, anchor.y)
  await page.mouse.wheel(0, -240)
  await expect.poll(async () => (await view(page)).zoom).toBeGreaterThan(1)
  const after = await view(page)
  expect(normalized(after, anchor).x).toBeCloseTo(normalized(before, anchor).x, 3)
  expect(normalized(after, anchor).y).toBeCloseTo(normalized(before, anchor).y, 3)
  expect(await page.evaluate(() => window.scrollY)).toBe(scrollBefore)
  await page.mouse.wheel(0, 240)
  await expect.poll(async () => (await view(page)).zoom).toBeCloseTo(1, 3)
  const room = await roomPoint(page)
  const dragBefore = await view(page)
  await page.mouse.move(room.x, room.y)
  await page.mouse.down()
  await page.mouse.move(room.x + 45, room.y + 35, { steps: 5 })
  await page.mouse.up()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  expect((await view(page)).x - dragBefore.x).toBeCloseTo(45, 0)
  expect((await view(page)).y - dragBefore.y).toBeCloseTo(35, 0)
  await page.getByRole('button', { name: 'Reset zoom' }).click()
  expect((await view(page)).zoom).toBe(1)
  expect((await view(page)).x).toBe(0)
  const tap = await roomPoint(page)
  await page.mouse.click(tap.x, tap.y)
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('dialog').press('Escape')
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click()
  expect((await view(page)).zoom).toBeCloseTo(1.2, 3)
  await page.getByRole('button', { name: 'Reset zoom' }).click()
  for (let i = 0; i < 8; i++) await page.locator('.map-viewport').dispatchEvent('wheel', { deltaY: -500, clientX: anchor.x, clientY: anchor.y })
  await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeDisabled()
  for (let i = 0; i < 8; i++) await page.locator('.map-viewport').dispatchEvent('wheel', { deltaY: 500, clientX: anchor.x, clientY: anchor.y })
  await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeDisabled()
  console.log('Desktop passed: wheel zoom in/out, cursor anchor, page stays still, room drag vs click, reset, buttons, zoom limits.')

  const mobile = await browser.newContext({ viewport: { width: 1440, height: 1000 }, isMobile: true, hasTouch: true })
  const phone = await openMap(mobile)
  await phone.setViewportSize({ width: 390, height: 844 })
  await phone.locator('.map-viewport').scrollIntoViewIfNeeded()
  const box = await phone.locator('.map-viewport').boundingBox()
  const center = { x: box.x + box.width / 2, y: box.y + box.height / 2 }
  const cdp = await mobile.newCDPSession(phone)
  const touch = (type, points) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: points.map((point, index) => ({ id: index + 1, ...point })) })
  const pair = spread => [{ x: center.x - spread, y: center.y }, { x: center.x + spread, y: center.y }]
  const pinchBefore = await view(phone)
  await touch('touchStart', pair(40))
  await touch('touchMove', pair(80))
  await expect.poll(async () => (await view(phone)).zoom).toBeCloseTo(2, 2)
  const pinchAfter = await view(phone)
  expect(normalized(pinchAfter, center).x).toBeCloseTo(normalized(pinchBefore, center).x, 2)
  expect(normalized(pinchAfter, center).y).toBeCloseTo(normalized(pinchBefore, center).y, 2)
  await touch('touchMove', pair(30))
  await expect.poll(async () => (await view(phone)).zoom).toBeCloseTo(.75, 2)
  // Lift one finger, then continue dragging with the other without a jump or room activation.
  await touch('touchEnd', [pair(30)[1]].map(point => ({ ...point, id: 2 })))
  const singleBefore = await view(phone)
  await touch('touchMove', [{ x: center.x - 10, y: center.y + 15 }])
  await expect.poll(async () => (await view(phone)).x - singleBefore.x).toBeCloseTo(20, 0)
  expect((await view(phone)).y - singleBefore.y).toBeCloseTo(15, 0)
  await touch('touchEnd', [])
  await expect(phone.getByRole('dialog')).toHaveCount(0)
  expect(await phone.evaluate(() => window.visualViewport.scale)).toBe(1)
  await phone.getByRole('button', { name: 'Reset zoom' }).tap()
  const mobileRoom = await roomPoint(phone)
  await phone.touchscreen.tap(mobileRoom.x, mobileRoom.y)
  await expect(phone.getByRole('dialog')).toBeVisible()
  await phone.getByRole('dialog').press('Escape')
  await touch('touchStart', [center])
  await touch('touchCancel', [])
  await expect(phone.locator('.map-viewport')).toHaveAttribute('data-dragging', 'false')
  await expect(phone.getByRole('dialog')).toHaveCount(0)
  expect(errors).toEqual([])
  console.log('Mobile passed: native two-finger pinch in/out, midpoint anchor, pinch-to-drag transition, tap room, cancel recovery, no page zoom or browser errors.')
} finally {
  await browser.close()
}
