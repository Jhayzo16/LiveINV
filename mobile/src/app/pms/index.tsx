import { useState } from 'react'
import { ActivityIndicator, FlatList, Pressable, Text, View } from 'react-native'
import { router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useInventory } from '../../store'
import { usePmsActivity, usePmsSessions } from '../../pms-hooks'
import { sessionMatches } from '../../pms'
import { formatPmsDate } from '../../shared/pms'
import { PmsIcon } from '../../components/PmsIcon'
import { Button, Card, colors, Field, Notice, styles } from '../../ui'

export default function PmsHome() {
  const active = usePmsActivity()
  const sessions = usePmsSessions(active)
  const { rows, online } = useInventory()
  const [search, setSearch] = useState('')
  const insets = useSafeAreaInsets()
  const data = sessions.data || []
  return <FlatList style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled"
    data={data.filter(session => sessionMatches(session, search))} keyExtractor={item => item.id}
    refreshing={sessions.isFetching && Boolean(sessions.data)} onRefresh={online ? () => { void sessions.refetch() } : undefined}
    ListHeaderComponent={<View style={{ gap: 14 }}>
      <View style={{ backgroundColor: '#143D2D', borderRadius: 24, padding: 20, gap: 10 }}>
        <PmsIcon size={32} color="#C9E4C2" />
        <Text style={[styles.eyebrow, { color: '#C9E4C2' }]}>HOSPITAL IT DEPARTMENT</Text>
        <Text style={[styles.title, { color: '#FFF' }]}>Preventive Maintenance Service</Text>
        <Text style={[styles.subtitle, { color: '#DBE9DE' }]}>Record preventive maintenance and general cleaning for registered IT assets.</Text>
      </View>
      <View style={[styles.row, { alignItems: 'stretch' }]}>{[
        ['Open', sessions.data ? data.filter(item => !item.completed_at).length : '—'],
        ['Completed', sessions.data ? data.filter(item => item.completed_at).length : '—'],
        ['Assets', rows.length],
      ].map(([label, count]) => <View key={label} style={[styles.card, { flex: 1, minWidth: 80 }]}><Text style={styles.small}>{label}</Text><Text style={styles.title}>{count}</Text></View>)}</View>
      {!online && <Notice text="You’re offline. Reconnect to load the latest PMS history and record maintenance." />}
      <Button title="＋ New PMS session" disabled={!online || sessions.isPending || sessions.isError} onPress={() => router.push('/pms/new')} />
      <Text style={styles.heading}>Session history</Text>
      <Field label="Find a session" placeholder="Date, technician, or service" value={search} onChangeText={setSearch} />
      {sessions.isPending && online && <ActivityIndicator color={colors.green} accessibilityLabel="Loading PMS sessions" />}
      {sessions.isError && <><Notice text={sessions.error.message} error /><Button title="Retry PMS" secondary disabled={!online} onPress={() => { void sessions.refetch() }} /></>}
    </View>}
    ListEmptyComponent={!sessions.isPending && !sessions.isError ? <Card><Text style={styles.heading}>{search ? 'No matching sessions' : 'No PMS sessions yet'}</Text><Text style={styles.subtitle}>{search ? 'Try another date, technician, or service.' : 'Start a session, then scan each asset after its service is finished.'}</Text></Card> : null}
    renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`${formatPmsDate(item.service_date)}, ${item.service_type}, ${item.technician}, ${item.completed_at ? 'Completed' : 'Open'}`} onPress={() => router.push({ pathname: '/pms/[id]', params: { id: item.id } })} style={({ pressed }) => [styles.card, { opacity: pressed ? 0.7 : 1 }]}>
      <View style={[styles.row, { justifyContent: 'space-between' }]}><Text style={styles.heading}>{formatPmsDate(item.service_date)}</Text><Text style={[styles.small, { color: item.completed_at ? colors.green : colors.red }]}>{item.completed_at ? 'Completed' : 'Open'}</Text></View>
      <Text style={styles.text}>{item.service_type}</Text><Text style={styles.small}>{item.technician}</Text>
      <Text style={[styles.small, { color: colors.red }]}>View session details →</Text>
    </Pressable>} />
}
