import { Component, memo, useCallback, useEffect, useImperativeHandle, useRef, useState, type PropsWithChildren, type Ref, type RefObject } from 'react'
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import Svg, { Circle, G, Path } from 'react-native-svg'
import { Vector3 } from 'three'
import { Canvas, useFrame, useThree } from './fiber'
import { HospitalFloor, HospitalGround, HospitalLobby, HospitalRoof } from '../shared/hospital-geometry'
import { hospitalFloors } from '../shared/rooms'
import { Button, colors, styles } from '../ui'
import { fonts } from '../design'
import { clamp, type Point } from '../map-gestures'
import { useMapTouch } from './useMapTouch'
import { layoutFloorPanels, leftFloorIds, stepFloorPanels, type FloorAnchor, type FloorPanel } from '../floor-panels'
import { dragOrbit, initialOrbit, orbitAtRest, resetOrbit, stepOrbit, type Orbit } from '../hospital-orbit'

class ModelBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <View style={{ padding: 24, gap: 10 }}><Text style={styles.heading}>3D view unavailable on this device</Text><Text style={styles.subtitle}>Select a floor using the floating buttons and open its floor plan.</Text><Button title="Retry 3D view" secondary onPress={() => this.setState({ failed: false })} /></View> : this.props.children }
}

const stageHeight = 380
const cameraOptions = { position: [10, 8, 12] as [number, number, number], fov: 38, near: 0.1, far: 80 }
const rendererOptions = { antialias: false }
const ignoreRef = () => {}
type FloorScene = { anchors: Record<number, FloorAnchor>; panels: FloorPanel[] }
type OverlayHandle = { update: (scene: FloorScene) => void }
const anchorPoints = hospitalFloors.map((floor, index) => {
  const x = ((5.05 - index * 0.13) / 2 + 0.16) * (leftFloorIds.includes(floor.id) ? -1 : 1)
  const axis = new Vector3(0, 1, 0)
  return { id: floor.id, world: new Vector3(x, 0.82 + index * 0.69, 0).applyAxisAngle(axis, -0.38),
    opposite: new Vector3(-x, 0.82 + index * 0.69, 0).applyAxisAngle(axis, -0.38) }
})

function CameraOrbit({ target, wakeRef, onScene }: {
  target: RefObject<Orbit>; wakeRef: RefObject<(() => void) | null>; onScene: (scene: FloorScene) => void
}) {
  const { camera, size, invalidate } = useThree()
  const current = useRef({ ...initialOrbit })
  const panels = useRef<FloorPanel[]>([])
  const placements = useRef<FloorPanel[]>([])
  const point = useRef(new Vector3())
  const dirty = useRef(true)
  useEffect(() => {
    wakeRef.current = invalidate
    dirty.current = true
    invalidate()
    return () => { wakeRef.current = null }
  }, [camera, invalidate, size.width, size.height, wakeRef])
  useFrame((_, delta) => {
    const orbit = stepOrbit(current.current, target.current, delta)
    const changed = !orbitAtRest(current.current, orbit)
    current.current = orbit
    const moving = !orbitAtRest(orbit, target.current)
    if (!dirty.current && !changed && !moving) return
    const radius = Math.max(19, 18 * size.height / Math.max(size.width, 1)) / orbit.zoom
    camera.position.set(radius * Math.sin(orbit.phi) * Math.sin(orbit.theta), 2.35 + radius * Math.cos(orbit.phi), radius * Math.sin(orbit.phi) * Math.cos(orbit.theta))
    camera.lookAt(0, 2.35, 0)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld()
    const anchors: Record<number, FloorAnchor> = {}
    for (const { id, world, opposite } of anchorPoints) {
      const facingOpacity = world.distanceToSquared(camera.position) <= opposite.distanceToSquared(camera.position) ? 1 : 0.62
      const projected = point.current.copy(world).project(camera)
      anchors[id] = { x: (projected.x / 2 + 0.5) * size.width, y: (-projected.y / 2 + 0.5) * size.height,
        visible: projected.z > -1 && projected.z < 1, opacity: clamp(facingOpacity - Math.max(0, projected.z) * 0.06, 0.58, 1) }
    }
    placements.current = layoutFloorPanels(anchors, size.width, size.height, placements.current)
    panels.current = stepFloorPanels(panels.current, placements.current, delta)
    const panelsMoving = panels.current.some((panel, index) => panel.x !== placements.current[index].x || panel.y !== placements.current[index].y)
    dirty.current = panelsMoving
    onScene({ anchors, panels: panels.current })
    // Continue through the final eased pose after the finger lifts, then idle.
    if (moving || panelsMoving) invalidate()
  })
  return null
}

const Building = memo(function Building({ floor }: { floor: number }) {
  return <group rotation={[0, -0.38, 0]}><HospitalGround /><HospitalLobby />
    {hospitalFloors.map((item, index) => <HospitalFloor key={item.id} floor={item} index={index} selected={floor === item.id} hovered={false} ref={ignoreRef} />)}
    <HospitalRoof />
  </group>
})

function FloorOverlay({ ref, width, floor, onSelectFloor }: {
  ref: Ref<OverlayHandle>; width: number; floor: number; onSelectFloor: (id: number) => void
}) {
  const [scene, setScene] = useState<FloorScene>({ anchors: {}, panels: [] })
  useImperativeHandle(ref, () => ({ update: setScene }), [])
  const { anchors } = scene
  const panels = scene.panels.length ? scene.panels : layoutFloorPanels({}, width, stageHeight)
  // Keep the whole overlay in front of GLView. Perspective/rotateY can put
  // half of an iOS native view behind that surface even when it is a sibling.
  return <View collapsable={false} pointerEvents="box-none" style={model.overlay}>
    <Svg pointerEvents="none" width={width} height={stageHeight} style={StyleSheet.absoluteFill}>
      {panels.map(panel => {
        const anchor = anchors[panel.id]
        if (!anchor?.visible) return null
        const x = panel.left ? panel.x + panel.width : panel.x
        const y = panel.y + panel.height / 2
        const bend = panel.left ? 20 : -20
        const active = panel.id === floor
        return <G key={panel.id} opacity={panel.opacity}><Path d={`M ${x} ${y} C ${x + bend} ${y}, ${anchor.x - bend} ${anchor.y}, ${anchor.x} ${anchor.y}`} fill="none" stroke={active ? '#40955C' : '#B9C8C4'} strokeWidth={active ? 1.5 : 1} /><Circle cx={anchor.x} cy={anchor.y} r={active ? 4 : 3} fill={active ? '#40955C' : '#9EAFAA'} /></G>
      })}
    </Svg>
    {panels.map(panel => <Pressable key={panel.id} hitSlop={4} accessibilityRole="button" accessibilityLabel={`Select Floor ${panel.id}`} accessibilityState={{ selected: floor === panel.id }}
      onPress={() => onSelectFloor(panel.id)}
      style={({ pressed }) => [model.floor, { left: panel.x, top: panel.y, width: panel.width, height: panel.height, opacity: pressed ? 0.75 : panel.opacity, transform: [{ scale: panel.scale }] }, floor === panel.id && model.selected]}>
      <View style={[model.icon, floor === panel.id && { backgroundColor: colors.green }]}><Ionicons name="business-outline" size={12} color={floor === panel.id ? '#FFF' : '#71817A'} /></View>
      <Text numberOfLines={1} style={[model.floorText, floor === panel.id && { color: colors.green }]}>Floor {panel.id}</Text>
    </Pressable>)}
  </View>
}

export function HospitalModel({ floor, onSelectFloor, onInteractionChange }: {
  floor: number; onSelectFloor: (floor: number) => void; onInteractionChange: (active: boolean) => void
}) {
  const target = useRef({ ...initialOrbit })
  const wake = useRef<(() => void) | null>(null)
  const overlay = useRef<OverlayHandle>(null)
  const [zoom, setZoom] = useState(initialOrbit.zoom)
  const [width, setWidth] = useState(0)
  const scene = useRef<FloorScene>({ anchors: {}, panels: [] })
  const stage = useRef<View>(null)
  const stageOrigin = useRef({ x: 0, y: 0 })
  const selection = useRef({ width, onSelectFloor })
  useEffect(() => { selection.current = { width, onSelectFloor } }, [width, onSelectFloor])
  const onScene = useCallback((next: FloorScene) => {
    scene.current = next
    overlay.current?.update(next)
  }, [])
  const onPan = useCallback((x: number, y: number) => {
    target.current = dragOrbit(target.current, x, y)
    wake.current?.()
  }, [])
  const changeZoom = useCallback((next: number) => {
    target.current = { ...target.current, zoom: clamp(next, 0.8, 1.5) }
    setZoom(target.current.zoom)
    wake.current?.()
  }, [])
  const onPinch = useCallback((scale: number) => changeZoom(target.current.zoom * scale), [changeZoom])
  const onTap = useCallback((point: Point) => {
    const x = point.x - stageOrigin.current.x
    const y = point.y - stageOrigin.current.y
    const panels = scene.current.panels.length ? scene.current.panels : layoutFloorPanels({}, selection.current.width, stageHeight)
    const panel = panels.find(item => x >= item.x - 4 && x <= item.x + item.width + 4 && y >= item.y - 4 && y <= item.y + item.height + 4)
    if (panel) selection.current.onSelectFloor(panel.id)
  }, [])
  const touch = useMapTouch({ onPan, onPinch, onInteractionChange, onTap })
  return <View style={model.shell}>
    <View style={model.header}><Text style={styles.eyebrow}>TAGUM GLOBAL MEDICAL CENTER</Text><Text style={styles.heading}>Hospital topology</Text><Text style={styles.small}>Drag to rotate & tilt · pinch to zoom</Text></View>
    <View ref={stage} collapsable={false} {...touch.handlers}
      onTouchStart={event => { stage.current?.measureInWindow((x, y) => { stageOrigin.current = { x, y } }); touch.handlers.onTouchStart(event) }}
      onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height: stageHeight, ...(Platform.OS === 'web' ? { touchAction: 'none' } : {}) }}>
      <ModelBoundary><View collapsable={false} style={[StyleSheet.absoluteFill, { zIndex: 0 }]} pointerEvents="none"><Canvas frameloop="demand" camera={cameraOptions} gl={rendererOptions}>
        <color attach="background" args={['#EEF3F4']} /><ambientLight intensity={1.7} /><directionalLight position={[4, 10, 7]} intensity={3} /><directionalLight position={[-6, 4, -3]} intensity={1.5} />
        <CameraOrbit target={target} wakeRef={wake} onScene={onScene} /><Building floor={floor} />
      </Canvas></View></ModelBoundary>
      {width > 0 && <FloorOverlay ref={overlay} width={width} floor={floor} onSelectFloor={id => { if (touch.isTap()) onSelectFloor(id) }} />}
    </View>
    <View style={model.controls}><Button title="−" secondary disabled={zoom <= 0.8} onPress={() => changeZoom(target.current.zoom - 0.1)} /><Button title="Reset view" secondary onPress={() => { target.current = resetOrbit(target.current); setZoom(initialOrbit.zoom); wake.current?.() }} /><Button title="+" secondary disabled={zoom >= 1.5} onPress={() => changeZoom(target.current.zoom + 0.1)} /></View>
  </View>
}

const model = StyleSheet.create({
  shell: { backgroundColor: '#EEF3F4', borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: colors.line },
  header: { padding: 16, gap: 4 },
  controls: { flexDirection: 'row', gap: 8, padding: 12, justifyContent: 'center' },
  overlay: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, zIndex: 10, elevation: 10 },
  floor: { position: 'absolute', paddingHorizontal: 5, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: 12, backgroundColor: '#FFFFFFF2', borderWidth: 1, borderColor: '#FFFFFF', boxShadow: '0 6px 16px #263E3312' },
  selected: { backgroundColor: '#F0FAF0', borderColor: '#81B991' },
  icon: { width: 19, height: 22, borderRadius: 8, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EEF3F1' },
  floorText: { flexShrink: 1, fontFamily: fonts.bold, fontSize: 9, color: colors.ink },
})
