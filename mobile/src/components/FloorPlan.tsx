import { memo, useCallback, useMemo, useRef, useState } from 'react'
import { Platform, Text, View } from 'react-native'
import Svg, { Rect, SvgXml } from 'react-native-svg'
import maps from '../shared/floor-maps.json'
import { constrainMap, MAX_MAP_ZOOM, pinchMap, roomAtPoint, visibleMapBox, type MapView, type Point } from '../map-gestures'
import { styles } from '../ui'
import { nightFloorXml, nightMap } from '../floor-plan-theme'
import { MapButton } from './MapButton'
import { useMapTouch } from './useMapTouch'

type FloorMap = (typeof maps)[keyof typeof maps]
const Artwork = memo(function Artwork({ map, width, height, viewBox, roomId, assetCounts }: {
  map: FloorMap; width: number; height: number; viewBox: string; roomId: string; assetCounts: ReadonlyMap<string, number>
}) {
  const xml = useMemo(() => nightFloorXml(map.xml), [map.xml])
  return <>
    <SvgXml xml={xml} width={width} height={height} viewBox={viewBox} preserveAspectRatio="none" />
    <Svg width={width} height={height} viewBox={viewBox} preserveAspectRatio="none" style={{ position: 'absolute' }}>
      {map.rooms.map(item => {
        const selected = item.id === roomId
        const assigned = (assetCounts.get(item.id) ?? 0) > 0
        return <Rect key={item.id} x={item.x} y={item.y} width={item.width} height={item.height}
          transform={item.transform || undefined} fill={selected || assigned ? nightMap.selected : 'transparent'}
          fillOpacity={selected ? 0.36 : 0.22}
          stroke={selected ? nightMap.selected : assigned ? nightMap.assigned : nightMap.outline}
          strokeWidth={selected ? 9 : assigned ? 6 : 3} />
      })}
    </Svg>
  </>
})

export function FloorPlan({ floor, roomId, assetCounts, onSelect, onInteractionChange }: {
  floor: number; roomId: string; assetCounts: ReadonlyMap<string, number>; onSelect: (id: string) => void; onInteractionChange: (active: boolean) => void
}) {
  const map = maps[String(floor) as keyof typeof maps]
  const [mapX, mapY, mapWidth, mapHeight] = map.viewBox.split(' ').map(Number)
  const center = useRef<Point>({ x: 0, y: 0 })
  const [width, setWidth] = useState(0)
  const height = Math.max(260, Math.min(430, width * mapHeight / mapWidth))
  const fit = Math.min(width / mapWidth, height / mapHeight)
  const contentWidth = mapWidth * fit
  const contentHeight = mapHeight * fit
  const [view, setView] = useState<MapView>({ zoom: 1, x: 0, y: 0 })
  const currentView = useRef(view)
  const constrain = useCallback((next: MapView) => constrainMap(next, width, height, contentWidth, contentHeight), [width, height, contentWidth, contentHeight])
  const updateView = useCallback((next: MapView) => {
    currentView.current = constrain(next)
    setView(currentView.current)
  }, [constrain])
  const onPan = useCallback((x: number, y: number) => {
    const current = currentView.current
    updateView({ ...current, x: current.x + x, y: current.y + y })
  }, [updateView])
  const onPinch = useCallback((scale: number, from: Point, to: Point) => {
    const origin = center.current
    updateView(pinchMap(currentView.current, scale, { x: from.x - origin.x, y: from.y - origin.y }, { x: to.x - origin.x, y: to.y - origin.y }))
  }, [updateView])
  const onTap = useCallback((point: Point) => {
    if (!fit) return
    const box = visibleMapBox(currentView.current, { width, height }, { x: mapX, y: mapY, width: mapWidth, height: mapHeight })
    const localX = point.x - center.current.x + width / 2
    const localY = point.y - center.current.y + height / 2
    if (localX < 0 || localX > width || localY < 0 || localY > height) return
    const room = roomAtPoint(map.rooms, { x: box.x + localX * box.width / width, y: box.y + localY * box.height / height }, box.width / width)
    if (room) onSelect(room.id)
  }, [fit, width, height, mapWidth, mapHeight, mapX, mapY, map, onSelect])
  const touch = useMapTouch({ onPan, onPinch, onInteractionChange, onTap })
  const zoomBy = (delta: number) => {
    const current = currentView.current
    updateView(pinchMap(current, (current.zoom + delta) / current.zoom, { x: 0, y: 0 }, { x: 0, y: 0 }))
  }
  const box = width > 0 ? visibleMapBox(view, { width, height }, { x: mapX, y: mapY, width: mapWidth, height: mapHeight }) : null
  return <>
    <View style={{ overflow: 'hidden', borderWidth: 1, borderColor: nightMap.border, borderRadius: 22, backgroundColor: nightMap.background }}>
    <View collapsable={false} {...touch.handlers}
      onTouchStart={event => {
        // Artwork ignores touches, so locationX/Y always refer to this viewport.
        // Avoid async window measurement and Android status-bar coordinate offsets.
        const first = event.nativeEvent.touches[0] ?? event.nativeEvent
        center.current = { x: first.pageX - first.locationX + width / 2, y: first.pageY - first.locationY + height / 2 }
        touch.handlers.onTouchStart(event)
      }}
      onLayout={event => { setWidth(event.nativeEvent.layout.width); currentView.current = { zoom: 1, x: 0, y: 0 }; setView(currentView.current) }}
      style={{ height, ...(Platform.OS === 'web' ? { touchAction: 'none' } : {}) }}>
      {box && <View pointerEvents="none" style={{ width, height }}>
        <Artwork map={map} width={width} height={height} viewBox={`${box.x} ${box.y} ${box.width} ${box.height}`} roomId={roomId} assetCounts={assetCounts} />
      </View>}
    </View>
    </View>
    <View style={[styles.row, { justifyContent: 'space-between' }]}>
      <View style={[styles.row, { gap: 7 }]}>
        <MapButton title="−" label="Zoom out" disabled={view.zoom <= 1} onPress={() => zoomBy(-0.5)} />
        <Text style={[styles.small, { color: nightMap.text, minWidth: 36, textAlign: 'center' }]}>{Math.round(view.zoom * 100)}%</Text>
        <MapButton title="+" label="Zoom in" disabled={view.zoom >= MAX_MAP_ZOOM} onPress={() => zoomBy(0.5)} />
      </View>
      <MapButton title="Reset view" onPress={() => updateView({ zoom: 1, x: 0, y: 0 })} />
    </View>
    <Text style={[styles.small, { color: nightMap.muted, textAlign: 'center' }]}>Pinch to zoom · drag to move · tap a room</Text>
  </>
}
