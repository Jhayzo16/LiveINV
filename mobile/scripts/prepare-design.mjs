import { readFile, writeFile, copyFile, mkdir } from 'node:fs/promises'
const root = new URL('../../', import.meta.url)
const assets = new URL('../assets/', import.meta.url)
for (const folder of ['', 'metrics/', 'sidebar/', 'room-icons/']) await mkdir(new URL(folder, assets), { recursive: true })
for (const name of ['system-unit', 'printer', 'monitor', 'keyboard', 'ups', 'scanner', 'router']) {
  await copyFile(new URL(`src/assets/room-icons/${name}.png`, root), new URL(`room-icons/${name}.png`, assets))
}
for (const name of ['liveinv-logo.png', 'asset-card-logo.png', 'device-system-unit.png', 'device-printer.png', 'device-monitor.png', 'device-keyboard.png', 'device-ups.png', 'device-scanner.png', 'device-router.png', 'floor-panel-building.png', 'metrics/registered-assets.png', 'metrics/active-ready.png', 'metrics/needs-attention.png', 'metrics/rooms-verified.png', 'sidebar/dashboard.png', 'sidebar/live-mapping.png', 'sidebar/assets.png', 'sidebar/qr-scanner.png']) {
  await copyFile(new URL(`src/assets/${name}`, root), new URL(name, assets))
}
const source = await readFile(new URL('src/components/ui/hospital-building-3d.tsx', root), 'utf8')
const constants = source.slice(source.indexOf('const FLOOR_HEIGHT'), source.indexOf('export function HospitalBuilding3D'))
const geometry = source.slice(source.indexOf('function HospitalFloor('))
  .replace(/function (HospitalFloor|HospitalLobby|HospitalRoof|HospitalGround)\(/g, 'export function $1(')
  // Native GL does not need the physical glass shader's costly clearcoat/dispersion.
  .replaceAll('meshPhysicalMaterial', 'meshStandardMaterial')
  .replace(/ clearcoat=\{[^}]+\}| clearcoatRoughness=\{[^}]+\}/g, '')
  .replaceAll('meshStandardMaterial', 'NativeMaterial')
if (!geometry.includes('export function HospitalGround')) throw new Error('Web hospital model structure changed; review the native adapter.')
await writeFile(new URL('../src/shared/hospital-geometry.tsx', import.meta.url),
  '// Generated from the web hospital model by scripts/prepare-design.mjs.\n' +
  "import type { Object3D } from 'three'\nimport { RoundedBox } from '../components/RoundedBox'\nimport { NativeMaterial } from '../components/NativeMaterial'\ntype HospitalFloorModel = { id: number }\n" + constants + geometry)
console.log('Copied LiveINV artwork and hospital geometry from the website.')
