import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import type { AssetRow } from '../domain'
import { fonts, watermark } from '../design'
import { colors } from '../ui'
import { EquipmentImage } from './AssetCard'

const statusColors = {
  Active: { color: colors.green, backgroundColor: '#DEEFDF' },
  Maintenance: { color: '#80551C', backgroundColor: '#FFF0D6' },
  Broken: { color: colors.red, backgroundColor: '#F8E3E4' },
  Inactive: { color: '#53615A', backgroundColor: '#E6ECE8' },
}

export function AssetCarouselCard({ row, width, pending }: { row: AssetRow; width: number; pending: boolean }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${row.tag}, ${row.name}, ${row.state}${pending ? ', pending change' : ''}`}
    onPress={() => router.push({ pathname: '/asset/[id]', params: { id: row.id } })}
    style={({ pressed }) => [card.container, { width, opacity: pressed ? 0.8 : 1 }]}>
    <LinearGradient colors={['#E2EFE1', '#F6F9F2', '#D8E8D8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={card.visual}>
      <Image source={watermark} resizeMode="contain" style={card.watermark} />
      <View style={card.top}><Text style={[card.status, statusColors[row.state]]}>{row.state}</Text><View style={card.openIcon}><Ionicons name="arrow-forward" size={16} color={colors.green} /></View></View>
      <EquipmentImage category={row.category} height={144} />
    </LinearGradient>
    <LinearGradient colors={['#245D35', '#153D2B']} style={card.details}>
      <Text numberOfLines={1} style={card.tag}>{row.tag}</Text>
      <Text numberOfLines={2} style={card.name}>{row.name}</Text>
      <View style={card.location}><Ionicons name="location-outline" color="#D8E8DA" size={13} /><Text numberOfLines={1} style={card.meta}>{row.location || 'Unassigned location'}</Text></View>
      <View style={card.footer}><Text numberOfLines={1} style={card.owner}>{row.owner || 'No department'}</Text><Text style={card.action}>View record →</Text></View>
      {pending && <Text style={card.pending}>Pending change · awaiting sync</Text>}
    </LinearGradient>
  </Pressable>
}

const card = StyleSheet.create({
  container: { borderRadius: 23, overflow: 'hidden', backgroundColor: '#153D2B', borderWidth: 1, borderColor: '#E0E9DE' },
  visual: { padding: 13, paddingBottom: 6 },
  watermark: { position: 'absolute', width: 190, height: 190, right: -40, top: 6, opacity: 0.05 },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  status: { borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, fontFamily: fonts.bold, fontSize: 10 },
  openIcon: { width: 27, height: 27, borderRadius: 14, backgroundColor: '#FFFFFFA0', alignItems: 'center', justifyContent: 'center' },
  details: { padding: 15, gap: 7, flex: 1 },
  tag: { fontFamily: fonts.bold, fontSize: 10, color: '#CEE2CF', letterSpacing: 0.7 },
  name: { fontFamily: fonts.title, fontSize: 15, lineHeight: 21, color: '#FFFFFF', minHeight: 42 },
  location: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  meta: { flex: 1, fontFamily: fonts.medium, fontSize: 11, lineHeight: 17, color: '#E0EBE0' },
  footer: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderColor: '#FFFFFF26', paddingTop: 9, marginTop: 3 },
  owner: { flex: 1, fontFamily: fonts.medium, fontSize: 10, color: '#C4D9C8' },
  action: { fontFamily: fonts.bold, fontSize: 10, color: '#FFFFFF' },
  pending: { fontFamily: fonts.medium, fontSize: 10, lineHeight: 16, color: '#FFE0A2' },
})
