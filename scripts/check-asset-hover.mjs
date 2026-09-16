import { chromium, expect } from '@playwright/test'
import { mockAdminAuth, signInMockAdmin } from './mock-admin-auth.mjs'

// Intercepted fixtures only; no live inventory reads or writes.
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  await page.routeWebSocket('**/*.supabase.co/**', socket => socket.close())
  await page.route('**/*.supabase.co/**', route => route.fulfill({ json: [] }))
  await mockAdminAuth(page)
  await page.route('**/rest/v1/assets?*', route => route.fulfill({ json: [{
    id: '00000000-0000-4000-8000-000000000002', tag: 'HOVER-TEST', qr_id: 'LIV-HOVERTEST',
    name: 'Hospital workstation', category: 'System Unit', state: 'Active',
    location: 'Unassigned', owner: 'Unassigned', ip: '—', brand: 'Test', model: 'Workstation',
    created_at: '2026-09-16T00:00:00Z',
  }] }))
  await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:5173')
  await signInMockAdmin(page)
  await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: /^Assets/ }).click()
  const card = page.getByRole('button', { name: 'Open full record for HOVER-TEST' })
  await expect(card).toBeVisible()
  for (const mode of ['grid', 'list']) {
    if (mode === 'list') await page.getByRole('button', { name: 'Switch to list view' }).click()
    for (const motion of ['no-preference', 'reduce']) {
      await page.emulateMedia({ reducedMotion: motion })
      await page.mouse.move(0, 0)
      await expect(card).toHaveCSS('transform', 'none')
      const before = await card.boundingBox()
      const shadowBefore = await card.evaluate(element => getComputedStyle(element).boxShadow)
      await card.hover()
      await expect(card, `${mode}, ${motion}: the card must visibly lift`).toHaveCSS('transform', 'matrix(1, 0, 0, 1, 0, -3)')
      const after = await card.boundingBox()
      expect(before.y - after.y).toBeCloseTo(3)
      expect(await card.evaluate(element => getComputedStyle(element).boxShadow)).not.toBe(shadowBefore)
      if (motion === 'reduce') await expect(card).toHaveCSS('transition-duration', '0s')
      await page.mouse.move(0, 0)
      await expect(card).toHaveCSS('transform', 'none')
      console.log(`PASS: ${mode}, ${motion}: lifts 3px, changes shadow, and returns on pointer exit`)
    }
  }
  await card.click()
  await expect(page.getByRole('dialog')).toBeVisible()
  expect(errors).toEqual([])
} finally {
  await browser.close()
}
