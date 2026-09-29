import { useMemo, useState } from 'react'
import { router } from 'expo-router'
import { FlatList, Text, View, useWindowDimensions } from 'react-native'
import { equipmentImages, fonts } from '../../design'
import { useContentBottomInset } from '../../navigation-spacing'
import { useInventory, actions } from '../../store'
import { AssetCarouselCard } from '../../components/AssetCarouselCard'
import { Button, Chip, Field, styles, SyncBanner, colors } from '../../ui'
import type { AssetRow } from '../../domain'

export default function Assets() {
  const paddingBottom = useContentBottomInset()
  const { width } = useWindowDimensions()
  const cardWidth = Math.min(300, Math.max(200, width * 0.72), width - 48)
  const { rows, pending, busy } = useInventory()
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState('All')
  const filtered = useMemo(() => rows.filter(row => (filter === 'All' || row.state === filter) &&
    `${row.tag} ${row.qr_id} ${row.name} ${row.category} ${row.location} ${row.ip}`.toLowerCase().includes(search.trim().toLowerCase())), [rows, filter, search])
  const categories = useMemo(() => {
    const groups = new Map<string, AssetRow[]>(Object.keys(equipmentImages).map(category => [category, []]))
    for (const row of filtered) {
      const group = groups.get(row.category)
      if (group) group.push(row)
      else groups.set(row.category, [row])
    }
    return [...groups].filter(([, assets]) => assets.length > 0).map(([category, assets]) => ({ category, assets }))
  }, [filtered])
  const pendingIds = useMemo(() => new Set(pending.map(change => change.assetId)), [pending])
  return <View style={styles.page}><FlatList data={categories} keyExtractor={item => item.category} extraData={pendingIds} contentContainerStyle={{ paddingTop: 16, paddingBottom, gap: 22 }}
    keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag"
    refreshing={busy} onRefresh={() => void actions.refresh()}
    ListHeaderComponent={<View style={{ gap: 14, paddingHorizontal: 16 }}><Text style={styles.eyebrow}>INVENTORY MANAGEMENT</Text><View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}><Text style={styles.title}>Assets</Text><Button title="＋ Add device" onPress={() => router.push('/asset/new')} /></View><Text style={styles.subtitle}>Browse by category. Swipe to explore your equipment.</Text><SyncBanner />
      <Field label="Search inventory" placeholder="Tag, equipment, room, or IP address" value={search} onChangeText={setSearch} />
      <View style={styles.row}>{['All', 'Active', 'Maintenance', 'Broken', 'Inactive'].map(label => <Chip key={label} label={label} selected={filter === label} onPress={() => setFilter(label)} />)}</View>
      <Text style={styles.small}>{filtered.length} equipment records · {categories.length} categories</Text></View>}
    ListEmptyComponent={<Text style={[styles.subtitle, { paddingHorizontal: 16 }]}>{rows.length ? 'No matching equipment. Try another search or status filter.' : 'No inventory loaded. Pull down to refresh when connected.'}</Text>}
    renderItem={({ item }) => <View style={{ gap: 11 }}>
      <View style={{ paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text accessibilityRole="header" style={[styles.heading, { flex: 1 }]}>{item.category}</Text>
        <Text style={{ fontFamily: fonts.bold, fontSize: 10, color: colors.green, backgroundColor: '#E5EFE5', paddingHorizontal: 9, paddingVertical: 5, borderRadius: 10 }}>{item.assets.length} {item.assets.length === 1 ? 'asset' : 'assets'}</Text>
      </View>
      <FlatList key={`${item.category}:${filter}:${search.trim().toLowerCase()}`} horizontal data={item.assets} keyExtractor={row => row.id} extraData={pendingIds}
        showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 12 }}
        snapToInterval={cardWidth + 12} decelerationRate="fast" disableIntervalMomentum
        keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" initialNumToRender={3} maxToRenderPerBatch={4} windowSize={5}
        renderItem={({ item: row }) => <AssetCarouselCard row={row} width={cardWidth} pending={pendingIds.has(row.id)} />} />
    </View>} />
  </View>
}
