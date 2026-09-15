import { chromium, expect } from '@playwright/test'
import { mockAdminAuth, signInMockAdmin } from './mock-admin-auth.mjs'

// Exercise the actual loaders with intercepted records; no production data is changed.
const browser = await chromium.launch({ headless: true, channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge' })
try {
  for (const reducedMotion of ['no-preference', 'reduce']) {
    const page = await browser.newPage({ reducedMotion, viewport: { width: 1440, height: 1000 } })
    await page.route('**/rest/v1/**', route => route.fulfill({ json: [] }))
    await mockAdminAuth(page)
    await page.goto(process.env.TEST_BASE_URL || 'http://127.0.0.1:5174')
    await signInMockAdmin(page)

    const checkRotation = async label => {
      const spinner = page.getByRole('status', { name: label }).locator('.ui-spinner')
      await expect(spinner).toBeVisible()
      const initial = await spinner.evaluate(node => ({
        transform: getComputedStyle(node).transform,
        animation: getComputedStyle(node).animationName,
      }))
      console.log(JSON.stringify({ reducedMotion, label, ...initial }))
      expect(initial.animation).toBe('ui-spinner-rotate')
      await expect.poll(() => spinner.evaluate(node => getComputedStyle(node).transform), { timeout: 1500 }).not.toBe(initial.transform)
    }

    await checkRotation('Loading inventory…')
    await expect(page.getByRole('status', { name: 'Loading inventory…' })).toHaveCount(0)
    await page.getByRole('navigation', { name: 'Primary navigation' }).getByRole('button', { name: 'Live Mapping', exact: true }).click()
    await checkRotation('Loading hospital 3D model…')
    await expect(page.getByRole('status', { name: 'Loading hospital 3D model…' })).toHaveCount(0, { timeout: 15000 })
    await page.close()
  }
  console.log('Record and hospital spinners rotate under both motion preferences.')
} finally {
  await browser.close()
}
