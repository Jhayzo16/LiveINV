import { useCallback, useMemo, useRef, useState } from 'react'
import { router, useFocusEffect } from 'expo-router'
import { HospitalModel } from '../../components/HospitalModel'
import { FloorPlan } from '../../components/FloorPlan'
import { RoomDirectory } from '../../components/RoomDirectory'
import { RoomExplorer } from '../../components/RoomExplorer'
import { MapButton } from '../../components/MapButton'
import { ScrollView, Text, View } from 'react-native'
import { hospitalFloors, hospitalRooms } from '../../shared/rooms'
import { resolveAssetRoom } from '../../shared/assignments'
import { toAsset } from '../../domain'
import { useInventory } from '../../store'
import { Button, Card, Chip, Page, styles } from '../../ui'
import { nightMap } from '../../floor-plan-theme'

export default function Maps() {
  const [focused, setFocused] = useState(false)
  const [directoryOpen, setDirectoryOpen] = useState(false)
  const [explorerOpen, setExplorerOpen] = useState(false)
  const returningToRoom = useRef(false)
  const [interacting, setInteracting] = useState(false)
  useFocusEffect(useCallback(() => {
    setFocused(true)
    returningToRoom.current = false
    return () => {
      setFocused(false); setDirectoryOpen(false); setInteracting(false)
      if (!returningToRoom.current) setExplorerOpen(false)
    }
  }, []))
  const [view, setView] = useState<'building' | 'plan'>('building')
  const [floor, setFloor] = useState(1)
  const [roomId, setRoomId] = useState('')
  const rows = useInventory(state => state.rows)
  const room = hospitalRooms.find(item => item.id === roomId)
  const mapping = useMemo(() => new Map(rows.map(row => [row.id, resolveAssetRoom(toAsset(row), hospitalRooms)?.id])), [rows])
  const assetCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const id of mapping.values()) if (id) counts.set(id, (counts.get(id) || 0) + 1)
    return counts
  }, [mapping])
  const equipment = rows.filter(row => mapping.get(row.id) === roomId)
  const selectFloor = (id: number) => { setFloor(id); setRoomId(''); setExplorerOpen(false) }
  const openRecord = useCallback((id: string) => {
    returningToRoom.current = true
    router.push({ pathname: '/asset/[id]', params: { id } })
  }, [])
  const night = view === 'plan'
  const floorLabel = hospitalFloors.find(item => item.id === floor)?.label
  return <><Page scrollEnabled={!interacting} backgroundColor={night ? nightMap.background : undefined}>
    <Text style={[styles.eyebrow, night && { color: nightMap.accent }]}>{night ? 'LIVE MAPPING' : 'FACILITY OVERVIEW'}</Text>
    <Text style={[styles.title, night && { color: nightMap.text }]}>{night ? 'Explore the floor.' : 'Live Mapping'}</Text>
    <Text style={[styles.subtitle, night && { color: nightMap.muted }]}>{night ? 'Tagum Global Medical Center' : 'Explore the hospital, select a floor, and locate your equipment.'}</Text>
    {night ? <View style={styles.row}>
      <MapButton title="3D topology" onPress={() => setView('building')} />
      <MapButton title="Floor plan" selected onPress={() => setView('plan')} />
    </View> : <View style={styles.row}><Chip label="3D topology" selected onPress={() => setView('building')} /><Chip label="Floor plan" onPress={() => setView('plan')} /></View>}
    {night && <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingVertical: 3 }}>
      {hospitalFloors.map(item => <MapButton key={item.id} title={`F${item.id}`} label={item.label} selected={floor === item.id} onPress={() => selectFloor(item.id)} />)}
    </ScrollView>}
    {!night && <Button title="Room directory" secondary onPress={() => setDirectoryOpen(true)} />}
    {view === 'building' && focused && <HospitalModel floor={floor} onSelectFloor={selectFloor} onInteractionChange={setInteracting} />}
    <View style={[styles.row, { justifyContent: 'space-between' }]}>
      <View style={{ gap: 4, flex: 1 }}>
        <Text style={[styles.heading, night && { color: nightMap.text }]}>{floorLabel}</Text>
        <Text style={[styles.small, night && { color: nightMap.muted }]}>{hospitalRooms.filter(item => item.floor === floor).length} rooms · {rows.filter(row => hospitalRooms.some(item => item.floor === floor && item.id === mapping.get(row.id))).length} assigned assets</Text>
      </View>
      {night && <MapButton title="Room directory" onPress={() => setDirectoryOpen(true)} />}
    </View>
    {view === 'building' && <Button title="Explore this floor →" onPress={() => setView('plan')} />}
    {view === 'plan' && focused && <FloorPlan key={floor} floor={floor} roomId={roomId} assetCounts={assetCounts} onSelect={setRoomId} onInteractionChange={setInteracting} />}
    {night && <View style={{ backgroundColor: nightMap.card, padding: 16, borderRadius: 22, gap: 9 }}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}>
        <Text style={styles.eyebrow}>{room ? 'SELECTED ROOM' : 'FIND YOUR EQUIPMENT'}</Text>
        {room && <Text style={[styles.small, { color: '#36583B' }]}>{equipment.length} {equipment.length === 1 ? 'device' : 'devices'}</Text>}
      </View>
      <Text style={styles.heading}>{room?.name || 'Where would you like to explore?'}</Text>
      <Text style={styles.small}>{room ? `${floorLabel} · ${room.id}` : 'Tap a room on the map or choose one from the room directory.'}</Text>
      {room && <Button title="Explore room →" onPress={() => setExplorerOpen(true)} />}
    </View>}
    {!night && room && <Card><Text style={styles.heading}>{room.name}</Text><Text style={styles.small}>{room.id} · {equipment.length} equipment records</Text>
      {!equipment.length && <Text style={styles.subtitle}>No equipment assigned to this room.</Text>}
      <Button title="Explore room →" onPress={() => setExplorerOpen(true)} /></Card>}
  </Page>
  {directoryOpen && focused && <RoomDirectory floor={floor} selectedRoomId={roomId} assetCounts={assetCounts} onClose={() => setDirectoryOpen(false)} onSelect={id => { setRoomId(id); setView('plan'); setDirectoryOpen(false) }} />}
  {explorerOpen && room && <RoomExplorer key={room.id} active={focused} room={room} equipment={equipment} onClose={() => setExplorerOpen(false)} onRecord={openRecord} />}
  </>
}
