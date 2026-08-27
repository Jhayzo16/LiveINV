import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { ContactShadows, OrbitControls, RoundedBox } from '@react-three/drei'
import { useCallback, useEffect, useMemo, useRef, useState, type ComponentRef, type MutableRefObject } from 'react'
import { MathUtils, Object3D, Quaternion, Spherical, Vector3 } from 'three'
import { createFloorAnchorStore, type FloorAnchorStore } from '../topology/floor-anchor-store'
import { FloorTopologyOverlay } from '../topology/FloorTopologyOverlay'
import type { FloorAnchorSnapshot, HospitalFloorModel } from '../topology/topology-types'

export type { HospitalFloorModel } from '../topology/topology-types'

type HospitalBuilding3DProps = {
  floors: HospitalFloorModel[]
  onExplore: (floor: number) => void
}

const FLOOR_HEIGHT = 0.69
const FIRST_FLOOR_Y = 0.82
const HOSPITAL_SALMON = '#d79a91'
const HOSPITAL_SALMON_LIGHT = '#e2ada4'
const HOSPITAL_SALMON_DARK = '#bd776f'
const HOSPITAL_WHITE = '#f8f6f2'
const HOSPITAL_GLASS = '#11191f'
const HOSPITAL_METAL = '#657178'

export function HospitalBuilding3D({ floors, onExplore }: HospitalBuilding3DProps) {
  const [selectedFloorId, setSelectedFloorId] = useState<number | null>(null)
  const [hoveredFloorId, setHoveredFloorId] = useState<number | null>(null)
  const [resetToken, setResetToken] = useState(0)
  const anchorStore = useMemo(() => createFloorAnchorStore(), [])
  const panelRotateRef = useRef<(deltaX: number) => void>(() => {})
  const hoverClearTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const handleFloorSelect = (floorId: number) => setSelectedFloorId(floorId)
  const handleFloorHover = useCallback((floorId: number, isHovering: boolean) => {
    if (hoverClearTimer.current) {
      clearTimeout(hoverClearTimer.current)
      hoverClearTimer.current = null
    }

    if (isHovering) {
      setHoveredFloorId(floorId)
      return
    }

    // The trigger and its portalled card have a small physical gap. Keep the
    // current floor alive while the pointer crosses it, and only clear the
    // exact floor that emitted the leave event. A stale leave from another
    // floor must never cancel the floor the user has just entered.
    hoverClearTimer.current = setTimeout(() => {
      setHoveredFloorId(current => current === floorId ? null : current)
      hoverClearTimer.current = null
    }, 180)
  }, [])
  useEffect(() => () => { if (hoverClearTimer.current) clearTimeout(hoverClearTimer.current) }, [])

  return <div className="hospital-3d-shell">
    <div className="hospital-canvas-wrap" aria-label="Seven-floor 3D hospital building">
      <Canvas shadows camera={{ position: [9.2, 6.9, 9.8], fov: 37, near: 0.1, far: 80 }} dpr={[1, 1.6]}>
        <color attach="background" args={['#eef3f4']} />
        <fog attach="fog" args={['#eef3f4', 20, 34]} />
        <ambientLight intensity={0.58} />
        <hemisphereLight args={['#ffffff', '#60756c', 0.72]} />
        <directionalLight castShadow position={[7, 11, 6]} intensity={1.55} color="#fffdf8" shadow-mapSize-width={2048} shadow-mapSize-height={2048} />
        <directionalLight position={[-7, 5, -5]} intensity={0.48} color="#cde4ff" />
        <HospitalModel floors={floors} selectedFloorId={selectedFloorId} hoveredFloorId={hoveredFloorId} anchorStore={anchorStore} />
        <ContactShadows position={[0, -0.31, 0]} opacity={0.26} scale={13} blur={2.6} far={8} color="#52625a" />
        <CameraControls resetToken={resetToken} rotationHandlerRef={panelRotateRef} />
      </Canvas>
    </div>
    <FloorTopologyOverlay floors={floors} anchorStore={anchorStore} selectedFloorId={selectedFloorId} hoveredFloorId={hoveredFloorId} resetToken={resetToken} onSelect={handleFloorSelect} onHover={handleFloorHover} onExplore={onExplore} onRotate={deltaX => panelRotateRef.current(deltaX)} />
    <button className="hospital-reset-view" type="button" onClick={() => setResetToken(token => token + 1)}><span aria-hidden="true">↻</span> Reset view</button>
    <div className="hospital-controls-hint"><span>↔</span> Drag to rotate <i /> Scroll to zoom <i /> Hover a floor panel to highlight it</div>
  </div>
}

function CameraControls({ resetToken, rotationHandlerRef }: { resetToken: number; rotationHandlerRef: MutableRefObject<(deltaX: number) => void> }) {
  const controlsRef = useRef<ComponentRef<typeof OrbitControls>>(null)
  const { camera } = useThree()
  const orbitOffset = useMemo(() => new Vector3(), [])
  const spherical = useMemo(() => new Spherical(), [])
  useEffect(() => { if (resetToken > 0) controlsRef.current?.reset() }, [resetToken])
  useEffect(() => {
    rotationHandlerRef.current = deltaX => {
      const controls = controlsRef.current
      if (!controls) return
      orbitOffset.copy(camera.position).sub(controls.target)
      spherical.setFromVector3(orbitOffset)
      spherical.theta -= deltaX * .009
      orbitOffset.setFromSpherical(spherical)
      camera.position.copy(controls.target).add(orbitOffset)
      controls.update()
    }
    return () => { rotationHandlerRef.current = () => {} }
  }, [camera, orbitOffset, rotationHandlerRef, spherical])
  return <OrbitControls ref={controlsRef} makeDefault enablePan={false} enableDamping dampingFactor={0.08} minDistance={7.2} maxDistance={15.5} minPolarAngle={Math.PI * 0.23} maxPolarAngle={Math.PI * 0.49} target={[0.3, 2.18, 0]} />
}

function HospitalModel({ floors, selectedFloorId, hoveredFloorId, anchorStore }: {
  floors: HospitalFloorModel[]
  selectedFloorId: number | null
  hoveredFloorId: number | null
  anchorStore: FloorAnchorStore
}) {
  const orderedFloors = useMemo(() => [...floors].sort((a, b) => a.id - b.id), [floors])
  const floorRefs = useRef<Record<number, Object3D | null>>({})
  const floorWidths = useMemo(() => Object.fromEntries(orderedFloors.map((floor, index) => [floor.id, 5.05 - index * 0.13])), [orderedFloors])

  return <group position={[0.34, 0.03, 0]} rotation={[0, -0.38, 0]} scale={0.84}>
    <HospitalGround />
    <HospitalLobby />
    {orderedFloors.map((floor, index) => <HospitalFloor key={floor.id} ref={(node: Object3D | null) => { floorRefs.current[floor.id] = node }} floor={floor} index={index} selected={floor.id === selectedFloorId} hovered={floor.id === hoveredFloorId} />)}
    <FloorAnchorProjector floors={orderedFloors} floorRefs={floorRefs} floorWidths={floorWidths} selectedFloorId={selectedFloorId} hoveredFloorId={hoveredFloorId} anchorStore={anchorStore} />
    <HospitalRoof />
  </group>
}

function FloorAnchorProjector({ floors, floorRefs, floorWidths, selectedFloorId, hoveredFloorId, anchorStore }: {
  floors: HospitalFloorModel[]
  floorRefs: React.RefObject<Record<number, Object3D | null>>
  floorWidths: Record<number, number>
  selectedFloorId: number | null
  hoveredFloorId: number | null
  anchorStore: FloorAnchorStore
}) {
  const { camera, size } = useThree()
  const lastPublished = useRef<FloorAnchorSnapshot>({})
  const lastUpdate = useRef(0)
  const center = useMemo(() => new Vector3(), [])
  const leftCandidate = useMemo(() => new Vector3(), [])
  const rightCandidate = useMemo(() => new Vector3(), [])
  const localEdge = useMemo(() => new Vector3(), [])
  const projected = useMemo(() => new Vector3(), [])
  const quaternion = useMemo(() => new Quaternion(), [])

  useFrame((state, delta) => {
    floors.forEach(floor => {
      const object = floorRefs.current?.[floor.id]
      if (!object) return
      const selected = floor.id === selectedFloorId
      const hovered = floor.id === hoveredFloorId
      const targetScale = selected ? 1.035 : hovered ? 1.018 : 1
      const ease = 1 - Math.exp(-delta * 10)
      object.scale.x = MathUtils.lerp(object.scale.x, targetScale, ease)
      object.scale.y = MathUtils.lerp(object.scale.y, selected ? 1.025 : 1, ease)
      object.scale.z = MathUtils.lerp(object.scale.z, targetScale, ease)
      object.position.x = MathUtils.lerp(object.position.x, selected ? 0.13 : 0, ease)
    })

    if (state.clock.elapsedTime - lastUpdate.current < 0.045) return
    lastUpdate.current = state.clock.elapsedTime
    const next: FloorAnchorSnapshot = {}
    let materiallyChanged = false
    floors.forEach(floor => {
      const object = floorRefs.current?.[floor.id]
      if (!object) return
      object.updateWorldMatrix(true, false)
      object.getWorldPosition(center)
      object.getWorldQuaternion(quaternion)
      localEdge.set((floorWidths[floor.id] / 2) + .16, 0, 0).applyQuaternion(quaternion)
      rightCandidate.copy(center).add(localEdge)
      leftCandidate.copy(center).sub(localEdge)
      const prefersRight = floor.id === 1 || floor.id === 2 || floor.id === 4 || floor.id === 7
      const anchorWorld = prefersRight ? rightCandidate : leftCandidate
      const chosenDistance = anchorWorld.distanceToSquared(camera.position)
      const alternateDistance = (prefersRight ? leftCandidate : rightCandidate).distanceToSquared(camera.position)
      projected.copy(anchorWorld).project(camera)
      const visible = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.12 && Math.abs(projected.y) < 1.12
      const facingOpacity = chosenDistance <= alternateDistance ? 1 : .62
      const anchor = { floorId: floor.id, x: (projected.x * .5 + .5) * size.width, y: (-projected.y * .5 + .5) * size.height, visible, depth: projected.z, opacity: visible ? MathUtils.clamp(facingOpacity - Math.max(0, projected.z) * .06, .58, 1) : 0 }
      next[floor.id] = anchor
      const previous = lastPublished.current[floor.id]
      if (!previous || Math.abs(previous.x - anchor.x) > .7 || Math.abs(previous.y - anchor.y) > .7 || previous.visible !== anchor.visible) materiallyChanged = true
    })
    if (materiallyChanged || Object.keys(lastPublished.current).length !== Object.keys(next).length) {
      lastPublished.current = next
      anchorStore.update(next)
    }
  })
  return null
}

function HospitalFloor({ floor, index, selected, hovered, ref }: {
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
    <RoundedBox castShadow receiveShadow args={[width + 0.14, 0.56, depth + 0.14]} radius={0.19} smoothness={5}><meshStandardMaterial color={shell} roughness={0.46} metalness={0.03} emissive={selected ? '#155b2e' : '#000000'} emissiveIntensity={selected ? 0.11 : 0} /></RoundedBox>
    <TintedWindowBands width={width} depth={depth} selected={selected} />
    <RoundedBox castShadow args={[width + 0.29, 0.11, depth + 0.29]} radius={0.11} smoothness={4} position={[0, 0.285, 0]}><meshStandardMaterial color={HOSPITAL_WHITE} roughness={0.3} /></RoundedBox>
    <RoundedBox castShadow args={[width + 0.2, 0.09, depth + 0.2]} radius={0.1} smoothness={4} position={[0, -0.29, 0]}><meshStandardMaterial color={selected ? '#dff6e6' : HOSPITAL_SALMON_DARK} roughness={0.39} /></RoundedBox>
    <WindowMullions width={width} depth={depth} color={selected ? '#d8f7e2' : HOSPITAL_METAL} />
  </group>
}

function TintedGlassMaterial({ selected }: { selected: boolean }) {
  return <meshPhysicalMaterial color={HOSPITAL_GLASS} roughness={0.12} metalness={0.42} clearcoat={0.58} clearcoatRoughness={0.16} emissive={selected ? '#092116' : '#000000'} emissiveIntensity={selected ? 0.18 : 0} />
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
  return <>{front.map((x, index) => <group key={`f-${index}`}><mesh position={[x, 0, depth / 2 + 0.115]}><boxGeometry args={[0.035, 0.22, 0.035]} /><meshStandardMaterial color={color} roughness={0.4} /></mesh><mesh position={[x, 0, -depth / 2 - 0.115]}><boxGeometry args={[0.035, 0.22, 0.035]} /><meshStandardMaterial color={color} roughness={0.4} /></mesh></group>)}{sides.map((z, index) => <group key={`s-${index}`}><mesh position={[width / 2 + 0.115, 0, z]}><boxGeometry args={[0.035, 0.22, 0.035]} /><meshStandardMaterial color={color} roughness={0.4} /></mesh><mesh position={[-width / 2 - 0.115, 0, z]}><boxGeometry args={[0.035, 0.22, 0.035]} /><meshStandardMaterial color={color} roughness={0.4} /></mesh></group>)}</>
}

function HospitalLobby() {
  return <group><RoundedBox castShadow receiveShadow args={[5.55, 0.58, 4.2]} radius={0.24} smoothness={5} position={[0, 0.29, 0]}><meshStandardMaterial color={HOSPITAL_SALMON} roughness={0.44} /></RoundedBox><RoundedBox castShadow args={[5.7, 0.12, 4.34]} radius={0.14} smoothness={4} position={[0, 0.58, 0]}><meshStandardMaterial color={HOSPITAL_WHITE} roughness={0.3} /></RoundedBox><mesh position={[0, 0.26, 2.13]} castShadow><boxGeometry args={[1.5, 0.52, 0.07]} /><meshPhysicalMaterial color={HOSPITAL_GLASS} roughness={0.1} metalness={0.45} clearcoat={0.6} clearcoatRoughness={0.14} /></mesh><mesh position={[0, 0.64, 2.42]} castShadow><boxGeometry args={[2.45, 0.1, 0.78]} /><meshStandardMaterial color={HOSPITAL_WHITE} roughness={0.3} /></mesh><mesh position={[-1.02, 0.34, 2.4]} castShadow><boxGeometry args={[0.11, 0.68, 0.11]} /><meshStandardMaterial color={HOSPITAL_WHITE} /></mesh><mesh position={[1.02, 0.34, 2.4]} castShadow><boxGeometry args={[0.11, 0.68, 0.11]} /><meshStandardMaterial color={HOSPITAL_WHITE} /></mesh></group>
}

function HospitalRoof() {
  const roofY = FIRST_FLOOR_Y + 6 * FLOOR_HEIGHT + 0.63
  return <group position={[0, roofY, 0]}><RoundedBox castShadow args={[4.24, 0.34, 3.05]} radius={0.22} smoothness={5}><meshStandardMaterial color={HOSPITAL_SALMON_LIGHT} roughness={0.44} /></RoundedBox><mesh position={[0, 0.19, 0]} receiveShadow><cylinderGeometry args={[1.05, 1.05, 0.05, 48]} /><meshStandardMaterial color="#c9cccb" roughness={0.5} /></mesh><mesh position={[0, 0.27, 0]}><boxGeometry args={[0.24, 0.06, 1.18]} /><meshStandardMaterial color="#1b6c24" emissive="#1b6c24" emissiveIntensity={0.12} /></mesh><mesh position={[0, 0.27, 0]}><boxGeometry args={[0.88, 0.06, 0.24]} /><meshStandardMaterial color="#1b6c24" emissive="#1b6c24" emissiveIntensity={0.12} /></mesh><mesh position={[0, 0.26, 0]} rotation={[-Math.PI / 2, 0, 0]}><torusGeometry args={[0.84, 0.055, 12, 48]} /><meshStandardMaterial color="#1b6c24" /></mesh></group>
}

function HospitalGround() {
  const trees = [[-3.05, 1.7], [-2.65, -1.75], [2.95, 1.55], [2.75, -1.72], [-1.65, 2.18], [1.75, 2.15]]
  return <group><mesh receiveShadow position={[0, -0.27, 0]}><cylinderGeometry args={[5.25, 5.45, 0.18, 64]} /><meshStandardMaterial color="#eee9e5" roughness={0.8} /></mesh>{trees.map(([x, z], index) => <group key={index} position={[x, -0.02, z]}><mesh castShadow position={[0, 0.18, 0]}><cylinderGeometry args={[0.035, 0.055, 0.36, 8]} /><meshStandardMaterial color="#7b6750" /></mesh><mesh castShadow position={[0, 0.47, 0]}><sphereGeometry args={[0.25, 16, 12]} /><meshStandardMaterial color={index % 2 ? '#4d8b50' : '#66a85f'} roughness={0.9} /></mesh></group>)}</group>
}
