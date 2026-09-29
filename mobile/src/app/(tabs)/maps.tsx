import { useCallback, useMemo, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { HospitalModel } from '../../components/HospitalModel'
import { RoomDirectory } from '../../components/RoomDirectory'
import { ScrollView, Text, View, useWindowDimensions } from 'react-native'
import Svg, { Rect, SvgXml } from 'react-native-svg'
import maps from '../../shared/floor-maps.json'
import { hospitalFloors, hospitalRooms } from '../../shared/rooms'
import { resolveAssetRoom } from '../../shared/assignments'
import { toAsset } from '../../domain'
import { useInventory } from '../../store'
import { AssetCard } from '../../components/AssetCard'
import { Button, Card, Chip, Page, styles, colors } from '../../ui'

export default function Maps() {
  const [focused, setFocused] = useState(false)
  const [directoryOpen, setDirectoryOpen] = useState(false)
  useFocusEffect(useCallback(() => { setFocused(true); return () => { setFocused(false); setDirectoryOpen(false) } }, []))
  const [view, setView] = useState<'building' | 'plan'>('building')
  const [floor, setFloor] = useState(1)
  const [roomId, setRoomId] = useState('')
  const [zoom, setZoom] = useState(1)
  const { width } = useWindowDimensions()
  const rows = useInventory(state => state.rows)
  const map = maps[String(floor) as keyof typeof maps]
  const room = hospitalRooms.find(item => item.id === roomId)
  const mapping = useMemo(() => new Map(rows.map(row => [row.id, resolveAssetRoom(toAsset(row), hospitalRooms)?.id])), [rows])
  const assetCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const id of mapping.values()) if (id) counts.set(id, (counts.get(id) || 0) + 1)
    return counts
  }, [mapping])
  const equipment = rows.filter(row => mapping.get(row.id) === roomId)
  const [, , mapWidth, mapHeight] = map.viewBox.split(' ').map(Number)
  const canvasWidth = (width - 32) * zoom
  const canvasHeight = canvasWidth * mapHeight / mapWidth
  return <><Page><Text style={styles.eyebrow}>FACILITY OVERVIEW</Text><Text style={styles.title}>Live Mapping</Text><Text style={styles.subtitle}>Explore the hospital, select a floor, and locate your equipment.</Text>
    <View style={styles.row}><Chip label="3D topology" selected={view === 'building'} onPress={() => setView('building')} /><Chip label="Floor plan" selected={view === 'plan'} onPress={() => setView('plan')} /></View>
    <View style={styles.row}>{hospitalFloors.map(item => <Chip key={item.id} label={`F${item.id}`} selected={floor === item.id} onPress={() => { setFloor(item.id); setRoomId(''); setZoom(1) }} />)}</View>
    <Button title="Room directory" secondary onPress={() => setDirectoryOpen(true)} />
    {view === 'building' && focused && <HospitalModel floor={floor} />}
    <Text style={styles.heading}>{hospitalFloors.find(item => item.id === floor)?.label}</Text>
    <Text style={styles.small}>{hospitalRooms.filter(item => item.floor === floor).length} rooms · {rows.filter(row => hospitalRooms.some(item => item.floor === floor && item.id === mapping.get(row.id))).length} assigned assets</Text>
    {view === 'building' && <Button title="Explore this floor →" onPress={() => setView('plan')} />}
    {view === 'plan' && <>
    <View style={styles.row}><Button title="Zoom out" secondary disabled={zoom <= 1} onPress={() => setZoom(value => Math.max(1, value - 0.5))} /><Text style={styles.small}>{Math.round(zoom * 100)}%</Text><Button title="Zoom in" secondary disabled={zoom >= 4} onPress={() => setZoom(value => Math.min(4, value + 0.5))} /></View>
    <ScrollView horizontal style={{ borderWidth: 1, borderColor: colors.line, borderRadius: 16, backgroundColor: '#FFF', height: Math.min(canvasHeight, 430) }} nestedScrollEnabled>
      <ScrollView nestedScrollEnabled style={{ width: canvasWidth }}>
        <View style={{ width: canvasWidth, height: canvasHeight }}>
          <SvgXml xml={map.xml} width={canvasWidth} height={canvasHeight} />
          <Svg width={canvasWidth} height={canvasHeight} viewBox={map.viewBox} style={{ position: 'absolute', top: 0, left: 0 }}>
            {map.rooms.map(item => <Rect key={item.id} x={item.x} y={item.y} width={item.width} height={item.height}
              transform={item.transform || undefined} fill={item.id === roomId ? '#17663E' : 'transparent'} fillOpacity={0.5}
              stroke={item.id === roomId ? colors.green : 'transparent'} strokeWidth={6}
              onPress={() => setRoomId(item.id)} accessible accessibilityLabel={item.name} />)}
          </Svg>
        </View>
      </ScrollView>
    </ScrollView>
    </>}
    {room && <Card><Text style={styles.heading}>{room.name}</Text><Text style={styles.small}>{room.id} · {equipment.length} equipment records</Text>
      {!equipment.length && <Text style={styles.subtitle}>No equipment assigned to this room.</Text>}
      {equipment.map(row => <AssetCard key={row.id} row={row} />)}</Card>}
  </Page>
  {directoryOpen && focused && <RoomDirectory floor={floor} selectedRoomId={roomId} assetCounts={assetCounts} onClose={() => setDirectoryOpen(false)} onSelect={id => { setRoomId(id); setView('plan'); setZoom(1); setDirectoryOpen(false) }} />}
  </>
}
