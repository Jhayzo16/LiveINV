import { Component, useEffect, useMemo, useRef, useState, type PropsWithChildren } from 'react'
import { PanResponder, Text, View } from 'react-native'
import { Canvas, useThree } from './fiber'
import { HospitalFloor, HospitalGround, HospitalLobby, HospitalRoof } from '../shared/hospital-geometry'
import { hospitalFloors } from '../shared/rooms'
import { Button, colors, styles } from '../ui'

class ModelBoundary extends Component<PropsWithChildren, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() { return { failed: true } }
  render() { return this.state.failed ? <View style={{ padding: 24, gap: 10 }}><Text style={styles.heading}>3D view unavailable on this device</Text><Text style={styles.subtitle}>You can still select any floor and open its interactive floor plan below.</Text><Button title="Retry 3D view" secondary onPress={() => this.setState({ failed: false })} /></View> : this.props.children }
}
function CameraTarget({ zoom }: { zoom: number }) {
  const { camera, invalidate } = useThree()
  useEffect(() => { camera.position.set(10 / zoom, 8 / zoom, 12 / zoom); camera.lookAt(0, 2, 0); camera.updateProjectionMatrix(); invalidate() }, [camera, invalidate, zoom])
  return null
}
export function HospitalModel({ floor }: { floor: number }) {
  const [rotation, setRotation] = useState(-0.38)
  const [zoom, setZoom] = useState(1)
  const gestureState = useRef({ start: -0.38, rotation: -0.38 })
  // PanResponder stores these callbacks; refs are accessed only when a gesture fires.
  // eslint-disable-next-line react-hooks/refs
  const responder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => false,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > Math.abs(gesture.dy) + 4,
    onMoveShouldSetPanResponderCapture: (_, gesture) => Math.abs(gesture.dx) > Math.abs(gesture.dy) + 4,
    onPanResponderGrant: () => { gestureState.current.start = gestureState.current.rotation },
    onPanResponderMove: (_, gesture) => { gestureState.current.rotation = gestureState.current.start + gesture.dx * 0.009; setRotation(gestureState.current.rotation) },
    onPanResponderRelease: (_, gesture) => { gestureState.current.rotation = gestureState.current.start + gesture.dx * 0.009; setRotation(gestureState.current.rotation) },
  }), [])
  return <View style={{ backgroundColor: '#EEEFEA', borderRadius: 22, overflow: 'hidden', borderWidth: 1, borderColor: colors.line }}>
    <View style={{ padding: 16, gap: 4 }}><Text style={styles.eyebrow}>TAGUM GLOBAL MEDICAL CENTER</Text><Text style={styles.heading}>Hospital topology</Text><Text style={styles.small}>Drag to rotate · choose a floor above</Text></View>
    <View style={{ height: 290 }} {...responder.panHandlers} accessibilityLabel="Interactive 3D hospital. Drag horizontally to rotate.">
      <ModelBoundary><View style={{ flex: 1 }} pointerEvents="none"><Canvas frameloop="demand" camera={{ position: [10, 8, 12], fov: 42, near: 0.1, far: 80 }} gl={{ antialias: false }}>
        <color attach="background" args={['#EEEFEA']} /><ambientLight intensity={1.7} /><directionalLight position={[4, 10, 7]} intensity={3} /><directionalLight position={[-6, 4, -3]} intensity={1.5} />
        <CameraTarget zoom={zoom} /><group rotation={[0, rotation, 0]}><HospitalGround /><HospitalLobby />{hospitalFloors.map((item, index) => <HospitalFloor key={item.id} floor={item} index={index} selected={floor === item.id} hovered={false} ref={() => {}} />)}<HospitalRoof /></group>
      </Canvas></View></ModelBoundary>
    </View>
    <View style={{ flexDirection: 'row', gap: 8, padding: 12, justifyContent: 'center' }}><Button title="−" secondary disabled={zoom <= 0.8} onPress={() => setZoom(value => Math.max(0.8, value - 0.1))} /><Button title="Reset view" secondary onPress={() => { setZoom(1); gestureState.current.rotation = -0.38; setRotation(-0.38) }} /><Button title="+" secondary disabled={zoom >= 1.4} onPress={() => setZoom(value => Math.min(1.4, value + 0.1))} /></View>
  </View>
}
