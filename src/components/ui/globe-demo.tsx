import { memo } from 'react'
import { Globe, type GlobeMarker } from './cobe-globe'

const EMPTY_ARCS: [] = []
const FLOOR_MARKERS: GlobeMarker[] = [
  { id: 'floor-1', location: [-24, 0], label: 'Floor 1' },
  { id: 'floor-2', location: [12, 51], label: 'Floor 2' },
  { id: 'floor-3', location: [34, 103], label: 'Floor 3' },
  { id: 'floor-4', location: [-10, 154], label: 'Floor 4' },
  { id: 'floor-5', location: [-34, -154], label: 'Floor 5' },
  { id: 'floor-6', location: [22, -103], label: 'Floor 6' },
  { id: 'floor-7', location: [4, -51], label: 'Floor 7' },
]
const MARKER_COLOR: [number, number, number] = [0.15, 0.16, 0.18]
const BASE_COLOR: [number, number, number] = [0.94, 0.95, 0.95]
const ARC_COLOR: [number, number, number] = [0.28, 0.3, 0.32]
const GLOW_COLOR: [number, number, number] = [0.953, 0.961, 0.973]

export const GlobeDemo = memo(function GlobeDemo({ onFloorSelect }: { onFloorSelect?: (floor: number) => void }) {
  return <div className="globe-demo">
    <Globe
      className="size-full"
      markers={FLOOR_MARKERS}
      arcs={EMPTY_ARCS}
      markerColor={MARKER_COLOR}
      baseColor={BASE_COLOR}
      arcColor={ARC_COLOR}
      glowColor={GLOW_COLOR}
      dark={0}
      diffuse={0.65}
      mapBrightness={0.05}
      mapSamples={20000}
      speed={0.0015}
      markerSize={0.022}
      markerElevation={0.012}
      onMarkerClick={(id) => onFloorSelect?.(Number(id.replace('floor-', '')))}
    />
    <div className="globe-shade" />
  </div>
})
