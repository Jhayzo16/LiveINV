import { useMemo, useState } from 'react'
import { FlatList, KeyboardAvoidingView, Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { hospitalFloors, hospitalRooms } from '../shared/rooms'
import { fonts } from '../design'
import { colors, Field, styles } from '../ui'
import { matchesWordPrefix } from '../search'

type Props = {
  floor: number
  selectedRoomId: string
  assetCounts: ReadonlyMap<string, number>
  onSelect: (id: string) => void
  onClose: () => void
}

export function RoomDirectory({ floor, selectedRoomId, assetCounts, onSelect, onClose }: Props) {
  const [query, setQuery] = useState('')
  const insets = useSafeAreaInsets()
  const rooms = useMemo(() => hospitalRooms.filter(room => room.floor === floor), [floor])
  const filtered = useMemo(() => {
    return rooms.filter(room => matchesWordPrefix(query, room.name, room.id))
  }, [rooms, query])

  return <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={onClose}>
    <View style={directory.overlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close room directory" />
      <KeyboardAvoidingView pointerEvents="box-none" behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[directory.position, { paddingTop: insets.top + 16, paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View accessibilityViewIsModal style={directory.panel}>
          <View style={directory.top}>
            <View style={{ flex: 1, gap: 4 }}><Text accessibilityRole="header" style={styles.heading}>Room directory</Text><Text style={styles.small}>{hospitalFloors.find(item => item.id === floor)?.label} · Tap a room to locate it</Text></View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Close room directory" style={directory.close}><Ionicons name="close" size={20} color={colors.ink} /></Pressable>
          </View>
          <View style={directory.search}><Field label="Search rooms" placeholder="Room name or space ID" value={query} onChangeText={setQuery} autoCorrect={false} autoCapitalize="none" returnKeyType="search" clearButtonMode="while-editing" /></View>
          <View style={[directory.row, directory.tableHeader]}>
            <Text style={[directory.columnHeading, directory.space]}>Space</Text><Text style={[directory.columnHeading, directory.name]}>Room</Text><Text style={[directory.columnHeading, directory.count]}>Assets</Text><View style={directory.arrow} />
          </View>
          <FlatList style={{ flex: 1 }} data={filtered} keyExtractor={room => room.id} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
            extraData={{ selectedRoomId, assetCounts }}
            ListEmptyComponent={<View style={{ padding: 24, gap: 10 }}><Text style={styles.subtitle}>No rooms match “{query.trim()}” on this floor.</Text><Pressable accessibilityRole="button" onPress={() => setQuery('')} style={directory.clear}><Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.red }}>Clear search</Text></Pressable></View>}
            renderItem={({ item, index }) => {
              const selected = item.id === selectedRoomId
              const count = assetCounts.get(item.id) || 0
              return <Pressable onPress={() => onSelect(item.id)} accessibilityRole="button" accessibilityState={{ selected }} accessibilityLabel={`${item.name}, space ${item.id.split('-').at(-1)}, ${count} assets`} style={({ pressed }) => [directory.row, { backgroundColor: selected ? '#F8ECEC' : index % 2 ? '#F5F8F6' : '#FFFFFF', opacity: pressed ? 0.65 : 1 }]}>
                <Text style={[styles.small, directory.space]}>{item.id.split('-').at(-1)}</Text>
                <Text style={[directory.roomName, directory.name, selected && { color: colors.red }]}>{item.name}</Text>
                <Text style={[styles.small, directory.count, { color: count ? colors.green : colors.muted }]}>{count}</Text>
                <Ionicons style={directory.arrow} name={selected ? 'checkmark-circle' : 'chevron-forward'} size={16} color={selected ? colors.red : colors.muted} />
              </Pressable>
            }} />
          <View style={directory.footer}><Text style={styles.small}>{filtered.length} of {rooms.length} rooms</Text><Pressable accessibilityRole="button" onPress={onClose} style={directory.clear}><Text style={{ fontFamily: fonts.bold, fontSize: 12, color: colors.red }}>Done</Text></Pressable></View>
        </View>
      </KeyboardAvoidingView>
    </View>
  </Modal>
}

const directory = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: '#10231CB3' },
  position: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16 },
  panel: { width: '100%', maxWidth: 560, height: '85%', maxHeight: 640, backgroundColor: '#FFFFFF', borderRadius: 22, overflow: 'hidden', boxShadow: '0 14px 40px #00000030' },
  top: { flexDirection: 'row', gap: 8, alignItems: 'center', padding: 16, paddingBottom: 8 },
  close: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.paper, alignItems: 'center', justifyContent: 'center' },
  search: { paddingHorizontal: 16, paddingBottom: 14 },
  row: { flexDirection: 'row', gap: 8, alignItems: 'center', minHeight: 48, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  tableHeader: { minHeight: 36, paddingVertical: 9, backgroundColor: '#EAF1EB' },
  columnHeading: { fontFamily: fonts.bold, fontSize: 10, color: colors.green },
  space: { width: 36 }, name: { flex: 1 }, count: { width: 40, textAlign: 'right' }, arrow: { width: 16 },
  roomName: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 18, color: colors.ink },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingLeft: 16, paddingRight: 6, borderTopWidth: 1, borderColor: colors.line },
  clear: { paddingHorizontal: 14, minHeight: 44, justifyContent: 'center' },
})
