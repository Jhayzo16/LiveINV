import { chromium, expect } from '@playwright/test'
import { mkdirSync } from 'node:fs'
import { mockAdminAuth, signInMockAdmin } from './mock-admin-auth.mjs'

// Local, intercepted data only. Never writes to the live inventory.
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
mkdirSync('.tmp/asset-health', { recursive: true })
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'no-preference' })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  let states = []
  await page.routeWebSocket('**/*.supabase.co/**', socket => socket.close())
  await page.route('**/*.supabase.co/**', route => route.fulfill({ json: [] }))
  await mockAdminAuth(page)
  await page.route('**/rest/v1/assets?*', route => route.fulfill({ json: states.map((state, i) => ({
    id: `00000000-0000-4000-8000-${String(i + 2).padStart(12, '0')}`, tag: `HEALTH-${i}`, qr_id: `LIV-HEALTH${i}`,
    name: 'Health chart fixture', category: 'System Unit', state, location: 'Unassigned', owner: 'Unassigned', ip: '—',
    created_at: '2026-09-16T00:00:00Z',
  })) }))
  await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:5173')
  await signInMockAdmin(page)
  const nav = name => page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name, exact: true }).click()
  await nav('Dashboard')
  const ring = page.locator('.health-ring')
  const progress = page.locator('.health-ring-progress')
  await expect(ring).toHaveAccessibleName('No assets registered: 0% operational')
  await expect(progress).toHaveCSS('stroke-dashoffset', '100px')
  await page.locator('.asset-health').screenshot({ path: '.tmp/asset-health/empty.png' })

  for (const [label, fixture, percent] of [
    ['quarter', ['Active', 'Maintenance', 'Broken', 'Inactive'], 25],
    ['full', ['Active', 'Active'], 100],
    ['none-active', ['Broken', 'Maintenance'], 0],
  ]) {
    states = fixture
    await page.reload()
    await expect(ring).toContainText(`${percent}%`)
    await expect(progress).toHaveCSS('stroke-dashoffset', `${100 - percent}px`)
    if (percent > 0) {
      // Sample the actual browser animation at deterministic positions.
      const offsets = await progress.evaluate(element => {
        const animation = element.getAnimations()[0]
        animation.pause()
        return [0, 550, 1100].map(time => {
          animation.currentTime = time
          return parseFloat(getComputedStyle(element).strokeDashoffset)
        })
      })
      expect(offsets[0]).toBe(100)
      expect(offsets[1]).toBeLessThan(100)
      expect(offsets[1]).toBeGreaterThan(100 - percent)
      expect(offsets[2]).toBe(100 - percent)
    }
    await page.locator('.asset-health').screenshot({ path: `.tmp/asset-health/${label}.png` })
    console.log(`PASS: ${label} shows ${percent}% with the matching ring`)
  }

  states = ['Active', 'Broken']
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.reload()
  await expect(ring).toContainText('50%')
  await expect(progress).toHaveCSS('animation-name', 'none')
  await expect(progress).toHaveCSS('stroke-dashoffset', '50px')
  await page.setViewportSize({ width: 390, height: 844 })
  await expect(ring).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390)
  await page.locator('.asset-health').screenshot({ path: '.tmp/asset-health/mobile.png' })
  expect(errors).toEqual([])
  console.log('PASS: reduced motion uses the final value immediately; mobile fits; no browser errors')
} finally {
  await browser.close()
}
