import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useFocusEffect } from 'expo-router'
import { FlatList, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg'
import QRCode from 'react-native-qrcode-svg'
import type { AssetRow } from '../domain'
import { hospitalFloors, type hospitalRooms } from '../shared/rooms'
import { fonts, roomIconImages } from '../design'
import { Button, colors, Notice, styles } from '../ui'
import { availableRoomDevices, roomExplorerSelection } from '../room-explorer'
import { actions, useInventory } from '../store'

const statusColors = { Active: '#24B66D', Maintenance: '#D89522', Broken: '#BB3541', Inactive: '#7D8982' }
function CategoryIcon({ category, size = 22 }: { category: string; size?: number }) {
  const source = roomIconImages[category]
  return source ? <Image source={source} accessible={false} resizeMode="contain" style={{ width: size, height: size }} />
    : <Text accessible={false} style={{ width: size, textAlign: 'center', fontSize: size * 0.7, color: colors.ink }}>◆</Text>
}

function DeviceIcon({ row, selected = false }: { row: AssetRow; selected?: boolean }) {
  return <View style={[roomStyles.symbol, { borderColor: selected ? colors.green : statusColors[row.state], backgroundColor: selected ? '#E8F4E9' : '#FFF' }]}>
    <CategoryIcon category={row.category} />
  </View>
}

export function RoomExplorer({ room, equipment, active, onClose, onRecord }: {
  room: (typeof hospitalRooms)[number]; equipment: AssetRow[]; active: boolean; onClose: () => void; onRecord: (id: string) => void
}) {
  const insets = useSafeAreaInsets()
  const [category, setCategory] = useState<string | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const { sorted, counts, filter, filtered, selected } = useMemo(() => roomExplorerSelection(equipment, category, selectedId), [equipment, category, selectedId])
  const [visible, setVisible] = useState(true)
  const { rows, pending, online } = useInventory()
  const available = useMemo(() => availableRoomDevices(rows, pending), [rows, pending])
  const [pickerOpen, setPickerOpen] = useState(false)
  const [availableId, setAvailableId] = useState('')
  const candidate = available.find(row => row.id === availableId)
  const [assigning, setAssigning] = useState(false)
  const assignmentBusy = useRef(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const scroll = useRef<ScrollView>(null)
  const scrollOffset = useRef(0)
  useFocusEffect(useCallback(() => { setVisible(true) }, []))
  const openingRecord = useRef<string | null>(null)
  const finishDismiss = () => {
    const id = openingRecord.current
    openingRecord.current = null
    if (id) onRecord(id)
  }
  // iOS must dismiss the native modal before pushing an equipment screen.
  // Android/web do not provide the native iOS onDismiss callback.
  useEffect(() => {
    if (visible || Platform.OS === 'ios') return
    const frame = requestAnimationFrame(() => {
      const id = openingRecord.current
      openingRecord.current = null
      if (id) onRecord(id)
    })
    return () => cancelAnimationFrame(frame)
  }, [visible, onRecord])
  const openRecord = (id: string) => {
    if (openingRecord.current || assignmentBusy.current) return
    setSelectedId(id)
    openingRecord.current = id
    setVisible(false)
  }
  const chooseCategory = (next: string | null) => { setCategory(next); setSelectedId(null) }
  const chooseDevice = (row: AssetRow) => { setCategory(row.category); setSelectedId(row.id) }
  const close = () => {
    if (pickerOpen) { setPickerOpen(false); return }
    if (!assignmentBusy.current && !openingRecord.current) onClose()
  }
  async function assignDevice() {
    if (!candidate || assignmentBusy.current) return
    assignmentBusy.current = true
    setAssigning(true); setError(''); setFeedback('')
    try {
      const result = await actions.assignToRoom(candidate.id, room.id)
      setPickerOpen(false); setAvailableId('')
      if (result === 'saved') {
        chooseDevice(candidate)
        setFeedback(`${candidate.tag} is now assigned to ${room.name}.`)
      } else setFeedback(`${candidate.tag}: assignment saved on this device, waiting for sync. It will appear in the room once confirmed.`)
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not assign this device. Try again.') }
    finally { assignmentBusy.current = false; setAssigning(false) }
  }

  return <Modal transparent visible={visible && active} animationType="fade" onRequestClose={close} onDismiss={finishDismiss}
    onShow={() => scroll.current?.scrollTo({ y: scrollOffset.current, animated: false })}>
    <View style={[roomStyles.backdrop, { paddingTop: insets.top + 10, paddingBottom: Math.max(insets.bottom, 12) }]}>
      <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Close room explorer" disabled={assigning} onPress={close} />
      <View accessibilityViewIsModal={!pickerOpen} accessibilityElementsHidden={pickerOpen} importantForAccessibility={pickerOpen ? 'no-hide-descendants' : 'auto'} pointerEvents={pickerOpen ? 'none' : 'auto'} style={roomStyles.panel}>
        <View style={roomStyles.header}>
          <View style={{ flex: 1, gap: 4 }}><Text style={styles.eyebrow}>{hospitalFloors.find(item => item.id === room.floor)?.label} · SPACE {room.id.split('-').at(-1)}</Text><Text accessibilityRole="header" style={styles.heading}>{room.name}</Text><Text style={styles.small}>Select equipment to view its details.</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close room explorer" disabled={assigning} onPress={close} style={roomStyles.close}><Ionicons name="close" size={20} color={colors.ink} /></Pressable>
        </View>
        <ScrollView ref={scroll} onScroll={event => { if (visible && active) scrollOffset.current = event.nativeEvent.contentOffset.y }} scrollEventThrottle={32} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 20 }} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
          <View style={roomStyles.assignment}>
            <Text style={roomStyles.eyebrow}>ASSIGN AVAILABLE DEVICE</Text>
            <Text style={styles.heading}>Add a device to this room</Text>
            <Text style={styles.small}>Choose an unassigned device for {room.name}.</Text>
            {available.length ? <>
              <Pressable accessibilityRole="button" accessibilityLabel="Choose available device" accessibilityState={{ expanded: pickerOpen, disabled: assigning }} disabled={assigning} onPress={() => setPickerOpen(value => !value)} style={roomStyles.picker}>
                {candidate && <CategoryIcon category={candidate.category} />}
                <Text style={[styles.text, { flex: 1 }]}>{candidate ? `${candidate.tag} · ${candidate.name}` : 'Choose a device'}</Text><Ionicons name={pickerOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.green} />
              </Pressable>
              <Button title={assigning ? 'Assigning…' : 'Assign to this room'} disabled={!candidate || assigning} onPress={() => { void assignDevice() }} />
            </> : <Text style={styles.small}>No unassigned devices available. Devices with pending changes are available after those changes are resolved.</Text>}
            {!online && <Text style={styles.small}>Offline assignments will sync when you reconnect.</Text>}
            {feedback ? <Notice text={feedback} /> : null}
            {error ? <Notice error text={error} /> : null}
          </View>
          <View style={roomStyles.visual}>
            <View style={roomStyles.headingRow}><View style={{ flex: 1, gap: 4 }}><Text style={roomStyles.eyebrow}>2D ROOM VIEW</Text><Text style={styles.heading}>{room.name}</Text></View><Text style={roomStyles.count}>{equipment.length} {equipment.length === 1 ? 'device' : 'devices'}</Text></View>
            <View style={roomStyles.plan}>
              <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
                <Defs><Pattern id="roomGrid" width={24} height={24} patternUnits="userSpaceOnUse"><Path d="M 24 0 H 0 V 24" stroke="#E7EEEA" strokeWidth={0.7} fill="none" /></Pattern></Defs>
                <Rect width="100%" height="100%" fill="url(#roomGrid)" />
              </Svg>
              <View style={roomStyles.deviceGrid}>
                {sorted.map(row => <Pressable key={row.id} accessibilityRole="button" accessibilityState={{ selected: selected?.id === row.id }} accessibilityLabel={`Inspect ${row.tag}, ${row.category}, ${row.state}`} onPress={() => chooseDevice(row)} style={({ pressed }) => [roomStyles.marker, { opacity: pressed ? 0.65 : 1 }]}>
                  <DeviceIcon row={row} selected={selected?.id === row.id} />
                  <Text numberOfLines={2} style={[roomStyles.markerTag, selected?.id === row.id && { borderColor: colors.green, color: colors.green }]}>{row.tag}</Text>
                </Pressable>)}
                {!sorted.length && <View style={roomStyles.empty}><Ionicons name="cube-outline" size={32} color={colors.muted} /><Text style={styles.heading}>No equipment assigned</Text><Text style={[styles.small, { textAlign: 'center' }]}>Devices assigned to this room will appear here.</Text></View>}
              </View>
              <Svg pointerEvents="none" width={60} height={55} style={roomStyles.door}><Path d="M 3 55 V 3" stroke="#99AAA0" strokeWidth={3} /><Path d="M 3 3 A 52 52 0 0 1 55 55" stroke="#99AAA0" strokeWidth={1} strokeDasharray="3 3" fill="none" /></Svg>
            </View>
            <View style={roomStyles.legend}>{Object.entries(statusColors).map(([state, color]) => <View key={state} style={roomStyles.legendItem}><View style={[roomStyles.dot, { backgroundColor: color }]} /><Text style={roomStyles.tiny}>{state}</Text></View>)}</View>
            <Text style={styles.small}>Tap a device icon to inspect it.</Text>
          </View>
          <View style={roomStyles.details}>
            <View style={roomStyles.headingRow}><View style={{ flex: 1, gap: 4 }}><Text style={roomStyles.eyebrow}>ASSIGNED EQUIPMENT</Text><Text style={styles.heading}>Devices and models</Text></View><Text style={roomStyles.count}>{equipment.length}</Text></View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6, paddingVertical: 4 }}>
              {[null, ...counts.keys()].map(item => <Pressable key={item ?? 'all'} accessibilityRole="button" accessibilityState={{ selected: filter === item }} onPress={() => chooseCategory(item)} style={[roomStyles.filter, filter === item && roomStyles.filterSelected]}><Text style={[roomStyles.filterText, filter === item && { color: '#FFF' }]}>{item ?? 'All'} {item ? counts.get(item) : equipment.length}</Text></Pressable>)}
            </ScrollView>
            {filtered.map(row => <View key={row.id} style={[roomStyles.deviceRow, selected?.id === row.id && roomStyles.selectedRow]}>
              <Pressable accessibilityRole="button" accessibilityLabel={`Select ${row.tag}`} accessibilityState={{ selected: selected?.id === row.id }} onPress={() => setSelectedId(row.id)} style={roomStyles.deviceSelect}>
                <CategoryIcon category={row.category} size={20} />
                <View style={{ flex: 1, gap: 3 }}><Text numberOfLines={2} style={roomStyles.tag}>{row.tag}</Text><Text numberOfLines={2} style={styles.small}>{[row.brand, row.model].filter(Boolean).join(' ') || row.name}</Text></View>
                <View accessibilityLabel={row.state} style={[roomStyles.dot, { backgroundColor: statusColors[row.state] }]} />
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={`View record for ${row.tag}`} disabled={assigning} onPress={() => openRecord(row.id)} style={roomStyles.recordButton}><Text style={roomStyles.recordText}>View record</Text></Pressable>
            </View>)}
            {selected && <View style={roomStyles.selectedCard}>
              <View style={[roomStyles.headingRow, roomStyles.selectedHeading]}><View style={{ flex: 1, gap: 5 }}><Text style={roomStyles.eyebrow}>SELECTED EQUIPMENT</Text><Text selectable style={styles.heading}>{selected.tag}</Text><Text style={styles.small}>{selected.name}</Text></View><Text style={[roomStyles.status, { color: statusColors[selected.state] }]}>{selected.state}</Text></View>
              {[
                ['Type', selected.category], ['Model', [selected.brand, selected.model].filter(Boolean).join(' ') || '—'],
                ['Department', selected.owner || '—'], ['IP address', selected.ip || '—'],
              ].map(([label, value]) => <View key={label} style={roomStyles.detailRow}><Text style={styles.small}>{label}</Text><Text selectable style={roomStyles.value}>{value}</Text></View>)}
              <View style={roomStyles.qr}>
                {selected.qr_id ? <><QRCode value={`liveinv:qr:${selected.qr_id}`} size={144} quietZone={10} color={colors.green} backgroundColor="#FFFFFF" ecl="H" /><Text style={styles.small}>QR number</Text><Text selectable style={roomStyles.tag}>{selected.qr_id}</Text></> : <Text style={styles.small}>No QR number assigned.</Text>}
                <Text style={styles.small}>Asset number</Text><Text selectable style={roomStyles.tag}>{selected.tag}</Text>
                <Button title="View equipment record →" disabled={assigning} onPress={() => openRecord(selected.id)} />
              </View>
            </View>}
          </View>
        </ScrollView>
      </View>
      {pickerOpen && <View style={[roomStyles.dropdownBackdrop, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <Pressable style={StyleSheet.absoluteFill} accessibilityRole="button" accessibilityLabel="Dismiss device dropdown" onPress={() => setPickerOpen(false)} />
        <View accessibilityViewIsModal onAccessibilityEscape={() => setPickerOpen(false)} style={roomStyles.dropdown}>
          <View style={roomStyles.header}><View style={{ flex: 1, gap: 4 }}><Text accessibilityRole="header" style={styles.heading}>Choose a device</Text><Text style={styles.small}>{available.length} available · {room.name}</Text></View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close device dropdown" onPress={() => setPickerOpen(false)} style={roomStyles.close}><Ionicons name="close" size={20} color={colors.ink} /></Pressable>
          </View>
          <FlatList data={available} keyExtractor={row => row.id} extraData={candidate?.id} style={{ flexGrow: 0, flexShrink: 1 }}
            ListEmptyComponent={<Text style={[styles.small, { padding: 18 }]}>No unassigned devices available.</Text>}
            renderItem={({ item: row }) => <Pressable accessibilityRole="button" accessibilityLabel={`${row.tag}, ${row.name}, ${row.category}`} accessibilityState={{ selected: candidate?.id === row.id }} onPress={() => { setAvailableId(row.id); setPickerOpen(false); setError(''); setFeedback('') }} style={[roomStyles.option, candidate?.id === row.id && roomStyles.selectedRow]}>
              <CategoryIcon category={row.category} /><View style={{ flex: 1, gap: 4 }}><Text style={roomStyles.tag}>{row.tag}</Text><Text style={styles.small}>{row.name} · {row.category}</Text></View>
              {candidate?.id === row.id && <Ionicons name="checkmark-circle" size={19} color={colors.green} />}
            </Pressable>} />
        </View>
      </View>}
    </View>
  </Modal>
}

const roomStyles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: '#10231CB3', paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  panel: { width: '100%', maxWidth: 600, flex: 1, maxHeight: 920, backgroundColor: '#FFF', borderRadius: 22, overflow: 'hidden' },
  header: { padding: 16, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1, borderColor: colors.line },
  close: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20, backgroundColor: colors.paper },
  assignment: { padding: 14, gap: 10, borderBottomWidth: 1, borderColor: colors.line },
  picker: { minHeight: 48, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.line, borderRadius: 10, backgroundColor: '#FAFCFA' },
  dropdownBackdrop: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: '#10231C80', paddingHorizontal: 24, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  dropdown: { width: '100%', maxWidth: 480, maxHeight: '75%', backgroundColor: '#FFF', borderRadius: 18, overflow: 'hidden', boxShadow: '0 12px 32px #00000030' },
  option: { minHeight: 54, padding: 12, gap: 10, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderColor: colors.line },
  visual: { padding: 14, gap: 12, backgroundColor: '#EFF5EF' },
  headingRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  eyebrow: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 0.8, color: colors.green },
  count: { fontFamily: fonts.bold, fontSize: 10, color: colors.green, backgroundColor: '#FFF', paddingHorizontal: 10, paddingVertical: 7, borderRadius: 15, borderWidth: 1, borderColor: colors.line },
  plan: { minHeight: 250, borderWidth: 3, borderColor: '#9FAA9F', borderRadius: 8, backgroundColor: '#FCFDFC', overflow: 'hidden' },
  deviceGrid: { flexDirection: 'row', flexWrap: 'wrap', alignContent: 'flex-start', gap: 8, padding: 12, paddingBottom: 70, minHeight: 244 },
  marker: { width: '30%', minHeight: 72, alignItems: 'center', gap: 6, paddingVertical: 4 },
  symbol: { width: 40, height: 38, borderWidth: 1.5, borderRadius: 9, alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 8px #26372D20' },
  markerTag: { fontFamily: fonts.bold, fontSize: 9, color: colors.ink, textAlign: 'center', borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFF', borderRadius: 9, paddingHorizontal: 5, paddingVertical: 3, maxWidth: '100%' },
  door: { position: 'absolute', left: '9%', bottom: 0 },
  empty: { width: '100%', minHeight: 160, gap: 8, alignItems: 'center', justifyContent: 'center' },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  tiny: { fontFamily: fonts.body, fontSize: 9, color: colors.muted },
  details: { padding: 14, gap: 10 },
  filter: { minHeight: 40, paddingHorizontal: 12, justifyContent: 'center', borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FFF' },
  filterSelected: { backgroundColor: colors.green, borderColor: colors.green },
  filterText: { fontFamily: fonts.bold, fontSize: 10, color: colors.ink },
  deviceRow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingRight: 6, borderWidth: 1, borderColor: colors.line, borderRadius: 12, backgroundColor: '#FFF' },
  selectedRow: { backgroundColor: '#F0F8F1', borderColor: '#58A86B' },
  deviceSelect: { flex: 1, minHeight: 58, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  tag: { fontFamily: fonts.bold, fontSize: 11, color: colors.ink },
  recordButton: { minHeight: 44, justifyContent: 'center', paddingHorizontal: 8, borderWidth: 1, borderColor: '#E6BDBF', borderRadius: 8, backgroundColor: '#FFF' },
  recordText: { fontFamily: fonts.bold, fontSize: 10, color: colors.red },
  selectedCard: { borderWidth: 1, borderColor: colors.line, borderRadius: 16, overflow: 'hidden', marginTop: 4 },
  selectedHeading: { backgroundColor: '#F3F8F3', padding: 14 },
  status: { fontFamily: fonts.bold, fontSize: 10, backgroundColor: '#FFF', borderRadius: 12, padding: 7 },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: 16, minHeight: 48, padding: 12, borderTopWidth: 1, borderColor: colors.line },
  value: { flex: 1, textAlign: 'right', fontFamily: fonts.medium, fontSize: 12, color: colors.ink },
  qr: { padding: 14, gap: 8, borderTopWidth: 1, borderColor: colors.line, backgroundColor: '#FFF' },
})
