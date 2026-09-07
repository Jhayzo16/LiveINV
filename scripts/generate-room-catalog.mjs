import { readFile, writeFile } from 'node:fs/promises'
import { createHash } from 'node:crypto'
import { chromium } from '@playwright/test'

// Extract only labels physically inside room shapes, never arbitrary SVG layer names.
const catalogPath = new URL('../src/lib/room-catalog.json', import.meta.url)
const previous = JSON.parse(await readFile(catalogPath, 'utf8').catch(() => '{}'))
const browser = await chromium.launch({ headless: true, ...(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {}) })
try {
  const page = await browser.newPage()
  const catalog = {}
  for (let floor = 1; floor <= 7; floor++) {
    const source = await readFile(new URL(`../public/floor-plans/floor-${floor}.svg`, import.meta.url), 'utf8')
    await page.setContent(source)
    const rooms = await page.evaluate(() => {
      const clean = value => value.replace(/_\d+$/, '').replace(/\s+/g, ' ').trim()
      const label = node => clean(node.tagName.toLowerCase() === 'text' ? node.textContent ?? '' : node.id)
      const structural = /^(?:Rectangle|Group|Circle|Ellipse|Line|Path|Vector|clip|paint|filter|mask|liveinv)/i
      const title = /^(?:GROUND|[1-7](?:ST|ND|RD|TH))\s+FLOOR$/i
      const labels = [...document.querySelectorAll('svg [id], svg text')].filter(node => label(node) && !structural.test(label(node)) && !title.test(label(node)))
      return [...document.querySelectorAll('rect[fill="#D9D9D9"]')].map((shape, index) => {
        const box = shape.getBoundingClientRect()
        const candidates = labels.filter(node => {
          const b = node.getBoundingClientRect()
          const x = b.left + b.width / 2, y = b.top + b.height / 2
          return b.width > 0 && b.height > 0 && x >= box.left - 2 && x <= box.right + 2 && y >= box.top - 2 && y <= box.bottom + 2
        }).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top || a.getBoundingClientRect().left - b.getBoundingClientRect().left)
        const text = candidates.filter(node => node.tagName.toLowerCase() === 'text')
        const names = [...new Set((text.length ? text : candidates).map(label))]
        const name = text.length ? names.join(' ').replace(/\s+([,.)])/g, '$1').replace(/([(])\s+/g, '$1') : names.join(' · ')
        return { shapeId: shape.id || `shape-${index + 1}`, name: name || `Unnamed space ${index + 1}` }
      })
    })
    catalog[floor] = {
      sourceHash: createHash('sha256').update(source).digest('hex'),
      rooms: rooms.map((room, index) => ({
        ...room,
        id: previous[floor]?.rooms.find(old => old.shapeId === room.shapeId)?.id || `f${floor}-space-${index + 1}`,
        legacyIds: previous[floor]?.rooms.find(old => old.shapeId === room.shapeId)?.legacyIds || [],
        floor,
      })),
    }
  }
  await writeFile(catalogPath, JSON.stringify(catalog, null, 2) + '\n')
  console.log(Object.entries(catalog).map(([floor, data]) => `Floor ${floor}: ${data.rooms.length} rooms`).join('\n'))
} finally {
  await browser.close()
}
