import type { PropsWithChildren } from 'react'
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View, type TextInputProps } from 'react-native'
import { useInventory } from './store'
import { fonts } from './design'
import { useContentBottomInset } from './navigation-spacing'

export const colors = { green: '#1B6C24', red: '#8B1D24', ink: '#17282E', muted: '#758083', paper: '#F4F7F5', line: '#DFE9E3', gold: '#FFF0C9' }
export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.paper }, content: { padding: 16, gap: 12, paddingBottom: 24 },
  title: { fontSize: 22, fontFamily: fonts.heavy, letterSpacing: -0.7, color: colors.ink }, subtitle: { fontSize: 12, fontFamily: fonts.body, lineHeight: 19, color: colors.muted },
  heading: { fontSize: 16, fontFamily: fonts.title, letterSpacing: -0.4, color: colors.ink }, text: { fontSize: 13, fontFamily: fonts.body, lineHeight: 20, color: colors.ink },
  small: { fontSize: 11, fontFamily: fonts.medium, color: colors.muted, lineHeight: 17 }, card: { padding: 14, borderRadius: 18, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: colors.line, gap: 9, boxShadow: '0 5px 18px #21382b08' },
  eyebrow: { fontFamily: fonts.bold, color: colors.green, fontSize: 10, letterSpacing: 1.7 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' },
  input: { minHeight: 44, borderRadius: 10, borderWidth: 1, borderColor: colors.line, backgroundColor: '#FAFCFB', paddingHorizontal: 12, paddingVertical: 9, fontSize: 14, fontFamily: fonts.body, color: colors.ink },
  button: { minHeight: 40, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, backgroundColor: colors.red, alignItems: 'center', justifyContent: 'center' },
  buttonText: { color: '#FFF', fontFamily: fonts.bold, fontSize: 12 },
  chip: { minHeight: 36, borderWidth: 1, borderColor: colors.line, paddingHorizontal: 12, paddingVertical: 9, borderRadius: 20, backgroundColor: '#FFF' },
  label: { color: colors.muted, fontSize: 11, fontFamily: fonts.medium },
})
export function Page({ children, scrollEnabled = true, backgroundColor = colors.paper }: PropsWithChildren<{ scrollEnabled?: boolean; backgroundColor?: string }>) {
  const paddingBottom = useContentBottomInset()
  return <ScrollView scrollEnabled={scrollEnabled} style={[styles.page, { backgroundColor }]} contentContainerStyle={[styles.content, { paddingBottom }]} keyboardShouldPersistTaps="handled">{children}</ScrollView>
}
export function Card({ children }: PropsWithChildren) { return <View style={styles.card}>{children}</View> }
export function Button({ title, onPress, disabled = false, secondary = false }: { title: string; onPress: () => void; disabled?: boolean; secondary?: boolean }) {
  return <Pressable hitSlop={4} accessibilityRole="button" accessibilityState={{ disabled }} disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.button, secondary && { backgroundColor: '#E8F0E7' }, { opacity: disabled ? 0.45 : pressed ? 0.7 : 1 }]}><Text style={[styles.buttonText, secondary && { color: colors.green }]}>{title}</Text></Pressable>
}
export function Field({ label, ...props }: TextInputProps & { label: string }) {
  return <View style={{ gap: 7 }}><Text style={styles.label}>{label}</Text><TextInput accessibilityLabel={label} placeholderTextColor="#85948B" style={styles.input} {...props} /></View>
}
export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return <Pressable hitSlop={4} accessibilityRole="button" accessibilityState={{ selected }} onPress={onPress} style={[styles.chip, selected && { backgroundColor: '#F8ECEC', borderColor: '#E8CFD0' }]}><Text style={{ color: selected ? colors.red : colors.ink, fontFamily: fonts.bold, fontSize: 11 }}>{label}</Text></Pressable>
}
export function Notice({ text, error = false }: { text: string; error?: boolean }) {
  return <View style={{ backgroundColor: error ? '#FBEAEA' : colors.gold, padding: 12, borderRadius: 10 }}><Text accessibilityRole={error ? 'alert' : undefined} style={{ color: error ? colors.red : '#6D501B', fontFamily: fonts.body, fontSize: 12, lineHeight: 19 }}>{text}</Text></View>
}
export function SyncBanner() {
  const { online, pending, error, busy, lastSync } = useInventory()
  return <View style={{ gap: 8 }}>
    {busy && <View style={styles.row}><ActivityIndicator color={colors.green} /><Text style={styles.small}>Checking for updates…</Text></View>}
    {!online && <Notice text={`Offline · showing saved inventory${lastSync ? ` from ${new Date(lastSync).toLocaleString()}` : ''}.`} />}
    {pending.length > 0 && <Notice text={`${pending.length} change${pending.length === 1 ? '' : 's'} waiting for sync or review. Shared records below show the last confirmed server values.`} />}
    {error && <Notice text={error} error />}
  </View>
}
