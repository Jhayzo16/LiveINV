// Generated from the web hospital model by scripts/prepare-design.mjs.
import type { Object3D } from 'three'
import { RoundedBox } from '../components/RoundedBox'
import { NativeMaterial } from '../components/NativeMaterial'
type HospitalFloorModel = { id: number }
const FLOOR_HEIGHT = 0.69
const FIRST_FLOOR_Y = 0.82
const HOSPITAL_SALMON = '#d79a91'
const HOSPITAL_SALMON_LIGHT = '#e2ada4'
const HOSPITAL_SALMON_DARK = '#bd776f'
const HOSPITAL_WHITE = '#f8f6f2'
const HOSPITAL_GLASS = '#11191f'
const HOSPITAL_METAL = '#657178'

export function HospitalFloor({ floor, index, selected, hovered, ref }: {
  floor: HospitalFloorModel
  index: number
  selected: boolean
  hovered: boolean
  ref: (node: Object3D | null) => void
}) {
  const width = 5.05 - index * 0.13
  const depth = 3.72 - index * 0.08
  const y = FIRST_FLOOR_Y + index * FLOOR_HEIGHT
  const shell = selected ? '#e8b9b0' : hovered ? HOSPITAL_SALMON_LIGHT : HOSPITAL_SALMON
  return <group ref={ref} position={[0, y, 0]}>
    {selected && <pointLight position={[0, 0.15, 1.9]} intensity={4.5} distance={4.8} color="#39d978" />}
    <RoundedBox castShadow receiveShadow args={[width + 0.14, 0.56, depth + 0.14]} radius={0.19} smoothness={5}><NativeMaterial color={shell} roughness={0.46} metalness={0.03} emissive={selected ? '#155b2e' : '#000000'} emissiveIntensity={selected ? 0.11 : 0} /></RoundedBox>
    <TintedWindowBands width={width} depth={depth} selected={selected} />
    <RoundedBox castShadow args={[width + 0.29, 0.11, depth + 0.29]} radius={0.11} smoothness={4} position={[0, 0.285, 0]}><NativeMaterial color={HOSPITAL_WHITE} roughness={0.3} /></RoundedBox>
    <RoundedBox castShadow args={[width + 0.2, 0.09, depth + 0.2]} radius={0.1} smoothness={4} position={[0, -0.29, 0]}><NativeMaterial color={selected ? '#dff6e6' : HOSPITAL_SALMON_DARK} roughness={0.39} /></RoundedBox>
    <WindowMullions width={width} depth={depth} color={selected ? '#d8f7e2' : HOSPITAL_METAL} />
  </group>
}

function TintedGlassMaterial({ selected }: { selected: boolean }) {
  return <NativeMaterial color={HOSPITAL_GLASS} roughness={0.12} metalness={0.42} emissive={selected ? '#092116' : '#000000'} emissiveIntensity={selected ? 0.18 : 0} />
}

function TintedWindowBands({ width, depth, selected }: { width: number; depth: number; selected: boolean }) {
  const faceOffset = depth / 2 + 0.105
  const sideOffset = width / 2 + 0.105
  return <>
    <mesh castShadow position={[0, 0, faceOffset]}><boxGeometry args={[width - 0.2, 0.24, 0.045]} /><TintedGlassMaterial selected={selected} /></mesh>
    <mesh castShadow position={[0, 0, -faceOffset]}><boxGeometry args={[width - 0.2, 0.24, 0.045]} /><TintedGlassMaterial selected={selected} /></mesh>
    <mesh castShadow position={[sideOffset, 0, 0]}><boxGeometry args={[0.045, 0.24, depth - 0.2]} /><TintedGlassMaterial selected={selected} /></mesh>
    <mesh castShadow position={[-sideOffset, 0, 0]}><boxGeometry args={[0.045, 0.24, depth - 0.2]} /><TintedGlassMaterial selected={selected} /></mesh>
  </>
}

function WindowMullions({ width, depth, color }: { width: number; depth: number; color: string }) {
  const front = Array.from({ length: 11 }, (_, index) => -width / 2 + 0.32 + index * ((width - 0.64) / 10))
  const sides = Array.from({ length: 7 }, (_, index) => -depth / 2 + 0.3 + index * ((depth - 0.6) / 6))
  return <>{front.map((x, index) => <group key={`f-${index}`}><mesh position={[x, 0, depth / 2 + 0.115]}><boxGeometry args={[0.035, 0.22, 0.035]} /><NativeMaterial color={color} roughness={0.4} /></mesh><mesh position={[x, 0, -depth / 2 - 0.115]}><boxGeometry args={[0.035, 0.22, 0.035]} /><NativeMaterial color={color} roughness={0.4} /></mesh></group>)}{sides.map((z, index) => <group key={`s-${index}`}><mesh position={[width / 2 + 0.115, 0, z]}><boxGeometry args={[0.035, 0.22, 0.035]} /><NativeMaterial color={color} roughness={0.4} /></mesh><mesh position={[-width / 2 - 0.115, 0, z]}><boxGeometry args={[0.035, 0.22, 0.035]} /><NativeMaterial color={color} roughness={0.4} /></mesh></group>)}</>
}

export function HospitalLobby() {
  return <group><RoundedBox castShadow receiveShadow args={[5.55, 0.58, 4.2]} radius={0.24} smoothness={5} position={[0, 0.29, 0]}><NativeMaterial color={HOSPITAL_SALMON} roughness={0.44} /></RoundedBox><RoundedBox castShadow args={[5.7, 0.12, 4.34]} radius={0.14} smoothness={4} position={[0, 0.58, 0]}><NativeMaterial color={HOSPITAL_WHITE} roughness={0.3} /></RoundedBox><mesh position={[0, 0.26, 2.13]} castShadow><boxGeometry args={[1.5, 0.52, 0.07]} /><NativeMaterial color={HOSPITAL_GLASS} roughness={0.1} metalness={0.45} /></mesh><mesh position={[0, 0.64, 2.42]} castShadow><boxGeometry args={[2.45, 0.1, 0.78]} /><NativeMaterial color={HOSPITAL_WHITE} roughness={0.3} /></mesh><mesh position={[-1.02, 0.34, 2.4]} castShadow><boxGeometry args={[0.11, 0.68, 0.11]} /><NativeMaterial color={HOSPITAL_WHITE} /></mesh><mesh position={[1.02, 0.34, 2.4]} castShadow><boxGeometry args={[0.11, 0.68, 0.11]} /><NativeMaterial color={HOSPITAL_WHITE} /></mesh></group>
}

export function HospitalRoof() {
  const roofY = FIRST_FLOOR_Y + 6 * FLOOR_HEIGHT + 0.63
  return <group position={[0, roofY, 0]}><RoundedBox castShadow args={[4.24, 0.34, 3.05]} radius={0.22} smoothness={5}><NativeMaterial color={HOSPITAL_SALMON_LIGHT} roughness={0.44} /></RoundedBox><mesh position={[0, 0.19, 0]} receiveShadow><cylinderGeometry args={[1.05, 1.05, 0.05, 48]} /><NativeMaterial color="#c9cccb" roughness={0.5} /></mesh><mesh position={[0, 0.27, 0]}><boxGeometry args={[0.24, 0.06, 1.18]} /><NativeMaterial color="#1b6c24" emissive="#1b6c24" emissiveIntensity={0.12} /></mesh><mesh position={[0, 0.27, 0]}><boxGeometry args={[0.88, 0.06, 0.24]} /><NativeMaterial color="#1b6c24" emissive="#1b6c24" emissiveIntensity={0.12} /></mesh><mesh position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.84, 0.055, 12, 48]} /><NativeMaterial color="#1b6c24" /></mesh></group>
}

export function HospitalGround() {
  const trees = [[-3.05, 1.7], [-2.65, -1.75], [2.95, 1.55], [2.75, -1.72], [-1.65, 2.18], [1.75, 2.15]]
  return <group><mesh receiveShadow position={[0, -0.27, 0]}><cylinderGeometry args={[5.25, 5.45, 0.18, 64]} /><NativeMaterial color="#eee9e5" roughness={0.8} /></mesh>{trees.map(([x, z], index) => <group key={index} position={[x, -0.02, z]}><mesh castShadow position={[0, 0.18, 0]}><cylinderGeometry args={[0.035, 0.055, 0.36, 8]} /><NativeMaterial color="#7b6750" /></mesh><mesh castShadow position={[0, 0.47, 0]}><sphereGeometry args={[0.25, 16, 12]} /><NativeMaterial color={index % 2 ? '#4d8b50' : '#66a85f'} roughness={0.9} /></mesh></group>)}</group>
}
