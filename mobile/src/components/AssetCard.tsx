import { Image, Pressable, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { router } from 'expo-router'
import type { AssetRow } from '../domain'
import { styles, colors } from '../ui'
import { equipmentImages, fonts, watermark } from '../design'

export function EquipmentImage({ category, height = 130 }: { category: string; height?: number }) {
  const source = equipmentImages[category]
  return source ? <Image source={source} accessibilityLabel={`${category} illustration`} resizeMode="contain" style={{ width: '100%', height }} /> : <View style={{ height, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="cube-outline" size={72} color={colors.green} /></View>
}
export function AssetCard({ row, pending = false }: { row: AssetRow; pending?: boolean }) {
  const active = row.state === 'Active'
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${row.tag}, ${row.name}`} onPress={() => router.push({ pathname: '/asset/[id]', params: { id: row.id } })} style={{ borderRadius: 18, borderWidth: 2, borderColor: '#FFF', overflow: 'hidden', boxShadow: '0 4px 16px #20362b0c' }}>
    <LinearGradient colors={['#F0F7F0', '#FFFFFF', '#EEF5ED']} style={{ padding: 14, gap: 10 }}>
      <Image source={watermark} style={{ position: 'absolute', opacity: 0.06, width: 220, height: 190, right: -35, top: 35 }} resizeMode="contain" />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}><Text style={[styles.eyebrow, { flex: 1 }]}>{row.category.toUpperCase()}</Text><Text style={{ fontFamily: fonts.bold, fontSize: 10, color: active ? colors.green : colors.red, backgroundColor: active ? '#DEEFDF' : '#F8E8E5', borderRadius: 15, paddingHorizontal: 10, paddingVertical: 6 }}>{row.state}</Text></View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ width: '53%', gap: 7 }}><Text style={[styles.heading, { fontSize: 17 }]}>{row.tag}</Text><Text style={[styles.text, { fontSize: 13, lineHeight: 19 }]}>{row.name}</Text><Text style={styles.small}>{[row.brand, row.model].filter(Boolean).join(' · ') || row.category}</Text></View><View style={{ width: '47%' }}><EquipmentImage category={row.category} /></View></View>
      <View style={{ flexDirection: 'row', borderTopWidth: 1, borderBottomWidth: 1, borderColor: colors.line, paddingVertical: 12, gap: 12 }}><View style={{ flex: 1, gap: 4 }}><Text style={styles.small}>LOCATION</Text><Text style={[styles.text, { fontSize: 12, lineHeight: 18 }]}>{row.location || 'Unassigned'}</Text></View><View style={{ flex: 1, paddingLeft: 12, borderLeftWidth: 1, borderColor: colors.line, gap: 4 }}><Text style={styles.small}>DEPARTMENT</Text><Text style={[styles.text, { fontSize: 12, lineHeight: 18 }]}>{row.owner || 'Unassigned'}</Text></View></View>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 6 }}><Text style={styles.small}>{row.ip && row.ip !== '—' ? row.ip : 'No IP assigned'}</Text><Text style={{ fontFamily: fonts.bold, fontSize: 11, color: colors.red }}>View record →</Text></View>
      {pending && <Text style={[styles.small, { color: colors.red }]}>Pending change · awaiting confirmation</Text>}
    </LinearGradient>
  </Pressable>
}
