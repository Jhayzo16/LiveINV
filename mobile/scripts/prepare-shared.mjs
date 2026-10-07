import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises'
import { JSDOM } from '../../node_modules/jsdom/lib/api.js'

const root = new URL('../../', import.meta.url)
const output = new URL('../src/shared/', import.meta.url)
await mkdir(output, { recursive: true })
// Reuse the web PMS contract with the mobile authenticated Supabase client.
const pms = await readFile(new URL('src/lib/pms.ts', root), 'utf8')
await writeFile(new URL('pms.ts', output), '// Generated from src/lib/pms.ts by prepare-shared.mjs.\n' + pms.replace("from './supabase'", "from '../supabase'"))
for (const name of ['types.ts', 'assignments.ts', 'rooms.ts', 'room-catalog.json', 'consumable-capacity.ts']) {
  await copyFile(new URL(`src/lib/${name}`, root), new URL(name, output))
}
const catalog = JSON.parse(await readFile(new URL('room-catalog.json', output), 'utf8'))
const maps = {}
for (let floor = 1; floor <= 7; floor++) {
  const xml = await readFile(new URL(`public/floor-plans/floor-${floor}.svg`, root), 'utf8')
  const document = new JSDOM(xml, { contentType: 'image/svg+xml' }).window.document
  // Floor titles are outlined paths in the source artwork. The mobile screen
  // already identifies the floor above the map; retain every room label.
  for (const node of document.querySelectorAll('[id], text')) {
    if (/^(?:ground|first|second|third|fourth|fifth|sixth|seventh|[1-7](?:st|nd|rd|th)?)\s+floor$/i.test(node.id.trim())
      || (node.tagName === 'text' && /^(?:ground|first|second|third|fourth|fifth|sixth|seventh|[1-7](?:st|nd|rd|th)?)\s+floor$/i.test(node.textContent.trim()))) node.remove()
  }
  maps[floor] = {
    xml: document.documentElement.outerHTML,
    viewBox: document.documentElement.getAttribute('viewBox'),
    rooms: catalog[floor].rooms.map(room => {
      const shape = document.getElementById(room.shapeId) || (/^shape-\d+$/.test(room.shapeId)
        ? document.querySelectorAll('rect[fill="#D9D9D9"]')[Number(room.shapeId.split('-')[1]) - 1] : null)
      if (!shape) throw new Error(`Missing room shape: ${room.id}`)
      const transforms = []
      for (let node = shape; node && node !== document.documentElement; node = node.parentElement) {
        if (node.getAttribute('transform')) transforms.unshift(node.getAttribute('transform'))
      }
      return { ...room, x: Number(shape.getAttribute('x') || 0), y: Number(shape.getAttribute('y') || 0),
        width: Number(shape.getAttribute('width')), height: Number(shape.getAttribute('height')), transform: transforms.join(' ') }
    }),
  }
}
await writeFile(new URL('floor-maps.json', output), JSON.stringify(maps))
console.log('Prepared shared types, assignment rules, and seven native floor maps.')
