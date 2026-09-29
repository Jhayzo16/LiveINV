import { Image, Pressable, StyleSheet, Text, View } from 'react-native'
import { router } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import Svg, { Circle } from 'react-native-svg'
import { actions, useInventory } from '../../store'
import { Button, Page, styles, SyncBanner, colors } from '../../ui'
import { equipmentImages, fonts, watermark } from '../../design'
import { hospitalFloors, hospitalRooms } from '../../shared/rooms'
import { resolveAssetRoom } from '../../shared/assignments'
import { toAsset, type AssetRow } from '../../domain'

const healthStates = [
  { label: 'Active', color: colors.green },
  { label: 'Maintenance', color: '#C08A32' },
  { label: 'Broken', color: colors.red },
  { label: 'Inactive', color: '#A6B5AE' },
] as const

function InventoryRow({ row }: { row: AssetRow }) {
  const color = healthStates.find(state => state.label === row.state)?.color || colors.muted
  return <Pressable accessibilityRole="button" accessibilityLabel={`Open ${row.tag}, ${row.name}, ${row.state}`}
    onPress={() => router.push({ pathname: '/asset/[id]', params: { id: row.id } })}
    style={({ pressed }) => [dashboard.inventoryRow, { opacity: pressed ? 0.65 : 1 }]}>
    <View style={dashboard.thumbnail}>{equipmentImages[row.category]
      ? <Image source={equipmentImages[row.category]} resizeMode="contain" style={{ width: 42, height: 42 }} />
      : <Ionicons name="cube-outline" size={24} color={colors.green} />}</View>
    <View style={{ flex: 1, gap: 3 }}>
      <Text numberOfLines={1} style={dashboard.rowTitle}>{row.name}</Text>
      <Text numberOfLines={1} style={styles.small}>{row.tag} · {row.location || 'Unassigned'}</Text>
      <View style={dashboard.status}><View style={[dashboard.dot, { backgroundColor: color }]} /><Text style={[dashboard.caption, { color }]}>{row.state}</Text></View>
    </View>
    <Ionicons name="chevron-forward" size={16} color={colors.muted} />
  </Pressable>
}

export default function Home() {
  const { rows, busy, lastSync } = useInventory()
  const active = rows.filter(row => row.state === 'Active').length
  const attention = rows.filter(row => row.state === 'Broken' || row.state === 'Maintenance')
  const assigned = rows.map(row => resolveAssetRoom(toAsset(row), hospitalRooms)).filter(room => room != null)
  const percent = rows.length ? Math.round(active / rows.length * 100) : 0
  const assignedPercent = rows.length ? Math.round(assigned.length / rows.length * 100) : 0
  const health = healthStates.map(state => ({ ...state, count: rows.filter(row => row.state === state.label).length }))
  const floors = hospitalFloors.map(floor => ({ ...floor, count: assigned.filter(room => room.floor === floor.id).length }))
  const maxFloorCount = Math.max(1, ...floors.map(floor => floor.count))
  const recent = [...rows].sort((a, b) => b.updated_at.localeCompare(a.updated_at)).slice(0, 3)
  const hour = new Date().getHours()

  return <Page>
    <View style={{ gap: 4 }}>
      <Text style={styles.subtitle}>Good {hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : 'evening'},</Text>
      <Text style={[styles.title, { fontSize: 21 }]}>Inventory Team</Text>
      <Text style={styles.small}>Your hospital equipment, at a glance.</Text>
    </View>
    <SyncBanner />

    <Pressable accessibilityRole="button" accessibilityLabel={`${rows.length} registered assets. Open inventory.`} onPress={() => router.navigate('/assets')} style={({ pressed }) => [dashboard.hero, { opacity: pressed ? 0.9 : 1 }]}>
      <LinearGradient colors={['#65151D', '#8B1D24', '#AC4143']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={dashboard.heroContent}>
        <Image source={watermark} resizeMode="contain" style={dashboard.watermark} />
        <View style={dashboard.between}><Text style={dashboard.heroEyebrow}>INVENTORY OVERVIEW</Text><View style={dashboard.heroIcon}><Ionicons name="cube-outline" size={18} color="#FFF" /></View></View>
        <View style={{ gap: 2 }}><Text style={dashboard.total}>{rows.length.toLocaleString()}</Text><Text style={dashboard.heroLabel}>Registered assets</Text></View>
        <View style={dashboard.heroFooter}><Text style={dashboard.heroNote}>{rows.length - assigned.length} awaiting room assignment</Text><View style={dashboard.heroArrow}><Ionicons name="arrow-forward" size={17} color="#FFF" /></View></View>
      </LinearGradient>
    </Pressable>

    <View style={dashboard.metricGrid}>
      <View style={[dashboard.metric, { backgroundColor: '#EAF3EB' }]}>
        <View style={dashboard.between}><Text style={dashboard.metricLabel}>Active & ready</Text><View style={[dashboard.metricIcon, { backgroundColor: '#CDE6CE' }]}><Ionicons name="checkmark" size={18} color={colors.green} /></View></View>
        <Text style={dashboard.metricValue}>{active.toLocaleString()}</Text>
        <Text style={dashboard.metricNote}>{rows.length ? `${percent}% of inventory` : 'No assets yet'}</Text>
        <View style={dashboard.track}><View style={{ width: `${percent}%`, height: 4, backgroundColor: colors.green, borderRadius: 3 }} /></View>
      </View>
      <View style={[dashboard.metric, { backgroundColor: '#FBF0E2' }]}>
        <View style={dashboard.between}><Text style={dashboard.metricLabel}>Needs attention</Text><View style={[dashboard.metricIcon, { backgroundColor: '#F4DBB6' }]}><Ionicons name="construct-outline" size={17} color="#855618" /></View></View>
        <Text style={dashboard.metricValue}>{attention.length.toLocaleString()}</Text>
        <Text style={dashboard.metricNote}>Maintenance or broken</Text>
        <View style={dashboard.track}><View style={{ width: `${rows.length ? attention.length / rows.length * 100 : 0}%`, height: 4, backgroundColor: '#B17B2D', borderRadius: 3 }} /></View>
      </View>
    </View>

    <Pressable accessibilityRole="button" accessibilityLabel={`${assigned.length} assets assigned to rooms, ${assignedPercent} percent. Open Live Mapping.`} onPress={() => router.navigate('/maps')} style={({ pressed }) => [dashboard.assignment, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[dashboard.metricIcon, { backgroundColor: '#DCEADD' }]}><Ionicons name="business-outline" size={19} color={colors.green} /></View>
      <View style={{ flex: 1, gap: 3 }}><Text style={dashboard.rowTitle}>Assigned to rooms</Text><Text style={styles.small}><Text style={{ color: colors.ink, fontFamily: fonts.bold }}>{assigned.length}</Text> located · Open Live Mapping</Text></View>
      <View style={{ width: 52, height: 52 }}>
        <Svg width={52} height={52} viewBox="0 0 52 52"><Circle cx={26} cy={26} r={22} stroke="#DAE6DC" strokeWidth={4} fill="none" /><Circle cx={26} cy={26} r={22} stroke={colors.green} strokeWidth={4} fill="none" strokeDasharray={`${assignedPercent / 100 * Math.PI * 44} ${Math.PI * 44}`} rotation={-90} origin="26,26" /></Svg>
        <View style={dashboard.ringCenter}><Text style={dashboard.caption}>{assignedPercent}%</Text></View>
      </View>
    </Pressable>

    <View style={dashboard.card}>
      <View style={dashboard.between}><Text style={styles.heading}>Asset health</Text><Text style={dashboard.badge}>BY CONDITION</Text></View>
      <View style={dashboard.healthLayout}>
        <View accessible accessibilityLabel={`${percent}% active, ${rows.length} assets total`} style={{ width: 132, height: 132 }}>
          <Svg width={132} height={132} viewBox="0 0 132 132">
            <Circle cx={66} cy={66} r={54} stroke="#EDF1EE" strokeWidth={13} fill="none" />
            {health.map((state, index) => {
              const circumference = Math.PI * 108
              const length = rows.length ? state.count / rows.length * circumference : 0
              const offset = rows.length ? health.slice(0, index).reduce((total, item) => total + item.count, 0) / rows.length * circumference : 0
              const gap = state.count === rows.length ? 0 : Math.min(2, length * 0.15)
              return state.count > 0 && <Circle key={state.label} cx={66} cy={66} r={54} fill="none" stroke={state.color} strokeWidth={13} strokeDasharray={`${length - gap} ${circumference}`} strokeDashoffset={-offset} rotation={-90} origin="66,66" />
            })}
          </Svg>
          <View style={dashboard.ringCenter}><Text style={[dashboard.metricValue, { fontSize: 23 }]}>{rows.length ? `${percent}%` : '—'}</Text><Text style={styles.small}>{rows.length ? 'Active assets' : 'No assets'}</Text></View>
        </View>
        <View style={{ flex: 1, minWidth: 120, gap: 13 }}>{health.map(state => <View key={state.label} style={dashboard.legendRow}><View style={[dashboard.dot, { backgroundColor: state.color }]} /><Text style={[styles.small, { flex: 1, color: colors.ink }]}>{state.label}</Text><Text style={dashboard.rowTitle}>{state.count}</Text></View>)}</View>
      </View>
    </View>

    <View style={dashboard.card}>
      <View style={dashboard.between}><Text style={styles.heading}>Assets by floor</Text><Ionicons name="bar-chart-outline" color={colors.green} size={19} /></View>
      <Text style={styles.small}>{assigned.length} assigned assets across {hospitalFloors.length} floors</Text>
      <View style={dashboard.floorChart}>{floors.map(floor => <View key={floor.id} accessible accessibilityLabel={`${floor.label}: ${floor.count} assets`} style={dashboard.floorColumn}>
        <Text style={dashboard.caption}>{floor.count}</Text>
        <View style={dashboard.barTrack}><LinearGradient colors={floor.count === maxFloorCount ? ['#AC4143', '#8B1D24'] : ['#79AB7E', '#2E7438']} style={{ width: '100%', height: `${floor.count / maxFloorCount * 100}%`, borderTopLeftRadius: 6, borderTopRightRadius: 6 }} /></View>
        <Text style={styles.small}>{floor.id === 1 ? 'GF' : `${floor.id}F`}</Text>
      </View>)}</View>
      <View style={dashboard.chartFooter}><View style={dashboard.status}><View style={[dashboard.dot, { backgroundColor: colors.green }]} /><Text style={styles.small}>Current room assignments</Text></View><Pressable accessibilityRole="button" accessibilityLabel="Open Live Mapping" onPress={() => router.navigate('/maps')} style={dashboard.textAction}><Text style={dashboard.link}>View map →</Text></Pressable></View>
    </View>

    <View style={dashboard.sectionHeading}><Text style={styles.heading}>Priority attention</Text><Text style={dashboard.countBadge}>{attention.length}</Text></View>
    {attention.length ? <View style={dashboard.list}>{attention.slice(0, 2).map(row => <InventoryRow key={row.id} row={row} />)}</View> : <View style={[dashboard.assignment, { backgroundColor: '#EAF3EB' }]}><View style={[dashboard.metricIcon, { backgroundColor: '#D2E8D4' }]}><Ionicons name="checkmark-done-outline" size={20} color={colors.green} /></View><View style={{ flex: 1, gap: 3 }}><Text style={dashboard.rowTitle}>All clear</Text><Text style={styles.small}>No equipment currently needs attention.</Text></View></View>}

    <View style={dashboard.between}><Text style={styles.heading}>Recent inventory</Text><Pressable accessibilityRole="button" onPress={() => router.navigate('/assets')} style={dashboard.textAction}><Text style={dashboard.link}>View all →</Text></Pressable></View>
    {recent.length ? <View style={dashboard.list}>{recent.map(row => <InventoryRow key={row.id} row={row} />)}</View> : <View style={dashboard.card}><Text style={styles.small}>Your inventory will appear here after syncing.</Text></View>}
    <View style={dashboard.metricGrid}><View style={{ flex: 1 }}><Button title="Scan equipment" onPress={() => router.navigate('/scan')} /></View><View style={{ flex: 1 }}><Button title={busy ? 'Syncing…' : 'Refresh inventory'} secondary disabled={busy} onPress={() => void actions.refresh()} /></View></View>
    {lastSync && <Text style={[styles.small, { textAlign: 'center' }]}>Last refreshed {new Date(lastSync).toLocaleString()}</Text>}
  </Page>
}

const dashboard = StyleSheet.create({
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  hero: { borderRadius: 22, overflow: 'hidden', boxShadow: '0 8px 20px #65151D22' },
  heroContent: { padding: 18, gap: 10 },
  heroEyebrow: { fontFamily: fonts.bold, fontSize: 9, letterSpacing: 1.6, color: '#F4DBDD', flex: 1 },
  heroIcon: { width: 32, height: 32, borderRadius: 12, backgroundColor: '#FFFFFF1C', justifyContent: 'center', alignItems: 'center' },
  total: { fontFamily: fonts.heavy, fontSize: 34, letterSpacing: -1, color: '#FFF' },
  heroLabel: { fontFamily: fonts.medium, fontSize: 12, color: '#FFF' },
  heroNote: { fontFamily: fonts.medium, fontSize: 10, color: '#F4DBDD', flex: 1 },
  heroFooter: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10, borderTopWidth: 1, borderColor: '#FFFFFF25' },
  heroArrow: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#FFFFFF1C', alignItems: 'center', justifyContent: 'center' },
  watermark: { position: 'absolute', right: 6, top: 12, width: 170, height: 170, opacity: 0.1 },
  metricGrid: { flexDirection: 'row', gap: 10 },
  metric: { flex: 1, borderRadius: 20, padding: 13, gap: 7, borderWidth: 1, borderColor: '#FFFFFF' },
  metricLabel: { flex: 1, fontFamily: fonts.medium, fontSize: 11, lineHeight: 16, color: colors.ink },
  metricIcon: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  metricValue: { fontFamily: fonts.heavy, fontSize: 25, color: colors.ink, letterSpacing: -0.6 },
  metricNote: { fontFamily: fonts.medium, fontSize: 10, lineHeight: 16, color: '#52645B' },
  track: { marginTop: 3, height: 4, backgroundColor: '#FFFFFFC0', borderRadius: 3, overflow: 'hidden' },
  assignment: { flexDirection: 'row', gap: 12, alignItems: 'center', backgroundColor: '#EDF4ED', borderWidth: 1, borderColor: '#DFE9DF', borderRadius: 20, padding: 14 },
  card: { backgroundColor: '#FFFFFF', borderRadius: 22, borderWidth: 1, borderColor: '#E7ECE8', padding: 16, gap: 12, boxShadow: '0 4px 16px #21382B05' },
  badge: { color: colors.green, backgroundColor: '#EEF5EF', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5, fontSize: 8, fontFamily: fonts.bold, letterSpacing: 0.5 },
  healthLayout: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 18, paddingVertical: 5 },
  ringCenter: { position: 'absolute', inset: 0, justifyContent: 'center', alignItems: 'center' },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  caption: { fontSize: 10, fontFamily: fonts.bold, color: colors.ink },
  rowTitle: { fontFamily: fonts.bold, fontSize: 12, lineHeight: 18, color: colors.ink },
  floorChart: { flexDirection: 'row', gap: 12, paddingTop: 4 },
  floorColumn: { flex: 1, alignItems: 'center', gap: 7 },
  barTrack: { width: '100%', maxWidth: 27, height: 94, justifyContent: 'flex-end', backgroundColor: '#F4F7F4', borderTopLeftRadius: 6, borderTopRightRadius: 6, overflow: 'hidden' },
  chartFooter: { borderTopWidth: 1, borderColor: '#EEF2EF', paddingTop: 4, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 8 },
  status: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  textAction: { minHeight: 40, justifyContent: 'center', paddingHorizontal: 4 },
  link: { fontFamily: fonts.bold, fontSize: 11, color: colors.red },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  countBadge: { fontFamily: fonts.bold, fontSize: 10, color: colors.red, backgroundColor: '#F2E5E5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
  list: { borderRadius: 20, overflow: 'hidden', backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#E7ECE8' },
  inventoryRow: { padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#E7ECE8' },
  thumbnail: { width: 50, height: 50, borderRadius: 15, backgroundColor: '#F1F6F0', alignItems: 'center', justifyContent: 'center' },
})
