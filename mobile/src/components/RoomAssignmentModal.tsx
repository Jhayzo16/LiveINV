import { useState } from 'react'
import { Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Ionicons from '@expo/vector-icons/Ionicons'
import { assignmentLocations, hospitalFloors } from '../shared/rooms'
import { Button, colors, Field, Notice, styles } from '../ui'
import { matchesWordPrefix } from '../search'

type Location = (typeof assignmentLocations)[number]

export function RoomAssignmentModal({ assetTag, busy, disabled, error, onClose, onConfirm }: {
  assetTag: string
  busy: boolean
  disabled: boolean
  error: string
  onClose: () => void
  onConfirm: (location: Location) => void
}) {
  const insets = useSafeAreaInsets()
  const [floor, setFloor] = useState('')
  const [roomId, setRoomId] = useState('')
  const [open, setOpen] = useState<'floor' | 'room' | null>(null)
  const rooms = assignmentLocations.filter(item => item.floor === floor)
  const selected = rooms.find(item => item.roomId === roomId)
  const close = () => { if (!busy) onClose() }

  return <Modal transparent visible animationType="fade" statusBarTranslucent onRequestClose={() => {
    if (busy) return
    if (open) setOpen(null)
    else onClose()
  }}>
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={[modal.overlay, { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16 }]}>
      <Pressable style={StyleSheet.absoluteFill} disabled={busy} onPress={close} accessibilityRole="button" accessibilityLabel="Close room assignment" />
      <View accessibilityViewIsModal style={modal.panel}>
        <View style={modal.header}>
          <View style={{ flex: 1, gap: 4 }}><Text accessibilityRole="header" style={styles.heading}>Assign to a room</Text><Text style={styles.small}>{assetTag} · Choose a floor, then a room.</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Close room assignment" accessibilityState={{ disabled: busy }} disabled={busy} onPress={close} style={modal.close}>
            <Ionicons name="close" size={22} color={colors.ink} />
          </Pressable>
        </View>
        <ScrollView style={{ flexShrink: 1 }} contentContainerStyle={modal.body} nestedScrollEnabled keyboardShouldPersistTaps="handled">
          <Dropdown label="Floor" placeholder="Choose a floor" value={floor} open={open === 'floor'} disabled={busy || disabled}
            options={hospitalFloors.map(item => ({ value: String(item.id), label: item.label }))}
            onToggle={() => setOpen(open === 'floor' ? null : 'floor')}
            onSelect={value => { setFloor(value); setRoomId(''); setOpen(null) }} />
          {floor && <Dropdown key={floor} searchable label="Room" placeholder="Choose a room" value={roomId} open={open === 'room'} disabled={busy || disabled}
            options={rooms.map(item => ({ value: item.roomId, label: item.label }))}
            onToggle={() => setOpen(open === 'room' ? null : 'room')}
            onSelect={value => { setRoomId(value); setOpen(null); Keyboard.dismiss() }} />}
          {floor && !rooms.length && <Notice text="There are no available rooms on this floor." />}
          {error && <Notice text={error} error />}
        </ScrollView>
        <View style={modal.footer}>
          <Button title={busy ? 'Saving…' : 'Confirm assignment'} disabled={!selected || busy || disabled} onPress={() => { if (selected) onConfirm(selected) }} />
          <Button title="Cancel" secondary disabled={busy} onPress={close} />
        </View>
      </View>
    </KeyboardAvoidingView>
  </Modal>
}

function Dropdown({ label, placeholder, value, options, open, disabled, searchable = false, onToggle, onSelect }: {
  label: string; placeholder: string; value: string; options: { value: string; label: string }[]
  open: boolean; disabled: boolean; searchable?: boolean; onToggle: () => void; onSelect: (value: string) => void
}) {
  const [query, setQuery] = useState('')
  const filtered = searchable ? options.filter(option => matchesWordPrefix(query, option.label, option.value)) : options
  const selected = options.find(item => item.value === value)
  return <View style={{ gap: 7 }}>
    <Text style={styles.label}>{label}</Text>
    <Pressable accessibilityRole="button" accessibilityLabel={`${label}: ${selected?.label || placeholder}`}
      accessibilityState={{ expanded: open, disabled }} disabled={disabled} onPress={() => { setQuery(''); if (open && searchable) Keyboard.dismiss(); onToggle() }}
      style={({ pressed }) => [styles.input, modal.trigger, { opacity: disabled ? 0.5 : pressed ? 0.7 : 1 }]}>
      <Text style={[styles.text, { flex: 1, color: selected ? colors.ink : colors.muted }]}>{selected?.label || placeholder}</Text>
      <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={colors.green} />
    </Pressable>
    {open && <View style={{ gap: 7 }}>
      {searchable && <Field label="Search rooms" placeholder="Room name or space ID" value={query} onChangeText={setQuery}
        editable={!disabled} autoCorrect={false} autoCapitalize="none" clearButtonMode="while-editing" returnKeyType="done" onSubmitEditing={() => Keyboard.dismiss()} />}
      <ScrollView style={modal.options} nestedScrollEnabled keyboardShouldPersistTaps="handled">
      {filtered.map(option => <Pressable key={option.value} accessibilityRole="button" accessibilityState={{ selected: option.value === value, disabled }}
        disabled={disabled} onPress={() => onSelect(option.value)} style={({ pressed }) => [modal.option, { backgroundColor: option.value === value ? '#E8F0E7' : '#FFF', opacity: pressed ? 0.65 : 1 }]}>
        <Text style={[styles.text, { flex: 1 }]}>{option.label}</Text>
        {option.value === value && <Ionicons name="checkmark" size={18} color={colors.green} />}
      </Pressable>)}
      {!filtered.length && <View style={{ padding: 12, gap: 10 }}><Text style={styles.small}>No rooms match your search on this floor.</Text>
        {query.length > 0 && <Button title="Clear search" secondary disabled={disabled} onPress={() => setQuery('')} />}
      </View>}
      </ScrollView>
    </View>}
  </View>
}

const modal = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 16, backgroundColor: '#10231CB3' },
  panel: { width: '100%', maxWidth: 480, maxHeight: '100%', borderRadius: 22, backgroundColor: '#FFF', overflow: 'hidden' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, padding: 16, borderBottomWidth: 1, borderColor: colors.line },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  body: { padding: 16, gap: 16 },
  trigger: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  options: { maxHeight: 200, borderRadius: 10, borderWidth: 1, borderColor: colors.line },
  option: { minHeight: 48, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  footer: { padding: 16, gap: 10, borderTopWidth: 1, borderColor: colors.line },
})
