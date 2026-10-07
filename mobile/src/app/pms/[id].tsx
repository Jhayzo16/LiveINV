import { useRef, useState } from 'react'
import { ActivityIndicator, FlatList, Keyboard, Linking, Modal, Pressable, ScrollView, Text, View } from 'react-native'
import { useLocalSearchParams } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { PmsRepository, formatPmsDate, type PmsRecord, type PmsSession } from '../../shared/pms'
import { pmsKeys, requirePmsConnection, usePmsActivity, usePmsSessions } from '../../pms-hooks'
import { mergePmsRecord, recordMatches } from '../../pms'
import { useInventory } from '../../store'
import { Button, Card, colors, Field, Notice, Page, styles } from '../../ui'
import { matchesWordPrefix } from '../../search'

const timestamp = (value: string) => new Date(value).toLocaleString('en-PH', { dateStyle: 'medium', timeStyle: 'short' })

export default function PmsDetail() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const active = usePmsActivity()
  const sessions = usePmsSessions(active)
  const session = sessions.data?.find(item => item.id === id)
  const { userId, online, rows } = useInventory()
  const client = useQueryClient()
  const recordsKey = pmsKeys.records(userId, id)
  const recordsQuery = useQuery({ queryKey: recordsKey, queryFn: () => PmsRepository.records(id),
    enabled: Boolean(session) && active && online, refetchInterval: active && online ? 15000 : false })
  const [code, setCode] = useState('')
  const [search, setSearch] = useState('')
  const [selectedRecord, setSelectedRecord] = useState<PmsRecord | null>(null)
  const [saving, setSaving] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [permission, requestPermission] = useCameraPermissions()
  const busy = useRef(false)
  const armed = useRef(false)
  const insets = useSafeAreaInsets()
  const records = recordsQuery.data || []
  const closed = Boolean(session?.completed_at)
  const suggestions = code.trim() && !scanning ? rows.filter(row =>
    matchesWordPrefix(code, row.tag, row.qr_id, row.name)).slice(0, 5) : []

  async function mark(rawCode: string, method: 'qr' | 'manual') {
    if (!rawCode.trim() || busy.current || closed || !session) return
    armed.current = false; busy.current = true
    setSaving(true); setScanning(false); setError(''); setMessage('')
    try {
      requirePmsConnection()
      // Resolve and snapshot on the server, exactly as on the web. Never infer
      // maintenance success from the phone's possibly stale inventory cache.
      const result: { record: PmsRecord; already_recorded: boolean } = await PmsRepository.mark(id, rawCode, method)
      await client.cancelQueries({ queryKey: recordsKey })
      client.setQueryData<PmsRecord[]>(recordsKey, current => mergePmsRecord(current, result.record))
      setCode('')
      setMessage(result.already_recorded ? `${result.record.asset_tag} was already maintained in this session. No duplicate was added.` : `${result.record.asset_tag} marked maintained for ${formatPmsDate(session.service_date)}.`)
      void client.invalidateQueries({ queryKey: recordsKey })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Maintenance could not be saved. Please retry.')
      void client.invalidateQueries({ queryKey: pmsKeys.sessions(userId) })
    } finally { busy.current = false; setSaving(false) }
  }
  async function startCamera() {
    setError('')
    if (scanning) { armed.current = false; setScanning(false); return }
    try {
      const granted = permission?.granted || (await requestPermission()).granted
      if (!granted) { setError('Camera access is unavailable. Enter the QR number or asset tag below.'); return }
      armed.current = true; setScanning(true)
    } catch { setError('Camera unavailable. Enter the QR number or asset tag below.') }
  }
  async function complete() {
    if (busy.current || closed || !records.length) return
    busy.current = true; setSaving(true); setError(''); armed.current = false; setScanning(false)
    try {
      requirePmsConnection()
      const saved = await PmsRepository.complete(id)
      await client.cancelQueries({ queryKey: pmsKeys.sessions(userId) })
      client.setQueryData<PmsSession[]>(pmsKeys.sessions(userId), current => [saved, ...(current || []).filter(item => item.id !== saved.id)])
      setConfirm(false); setMessage('PMS session completed. Its maintenance records are saved.')
      void client.invalidateQueries({ queryKey: pmsKeys.sessions(userId) })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Session could not be completed. Please retry.')
      void client.invalidateQueries({ queryKey: pmsKeys.sessions(userId) })
    } finally { busy.current = false; setSaving(false) }
  }
  if (!session) return <Page>
    {sessions.isPending && online ? <ActivityIndicator color={colors.green} accessibilityLabel="Loading PMS session" /> :
      <Notice text={!online ? 'Reconnect to load this PMS session.' : sessions.error?.message || 'PMS session was not found.'} error={online} />}
    <Button title="Retry session" secondary disabled={!online || sessions.isFetching} onPress={() => { void sessions.refetch() }} />
  </Page>

  return <>
    <FlatList style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled"
      accessibilityElementsHidden={Boolean(selectedRecord)} importantForAccessibility={selectedRecord ? 'no-hide-descendants' : 'auto'}
      data={records.filter(record => recordMatches(record, search))} keyExtractor={item => item.id}
      refreshing={recordsQuery.isFetching && Boolean(recordsQuery.data)} onRefresh={online && !saving ? () => { void recordsQuery.refetch(); void sessions.refetch() } : undefined}
      ListHeaderComponent={<View style={{ gap: 14 }}>
        <View style={{ padding: 20, borderRadius: 24, backgroundColor: '#143D2D', gap: 9 }}>
          <Text style={[styles.eyebrow, { color: '#C9E4C2' }]}>{closed ? 'COMPLETED SESSION' : 'OPEN SESSION'}</Text>
          <Text style={[styles.title, { color: '#FFF' }]}>{session.service_type}</Text>
          <Text style={[styles.subtitle, { color: '#DBE9DE' }]}>{formatPmsDate(session.service_date)} · {session.technician}</Text>
          <Text style={[styles.heading, { color: '#FFF' }]}>{recordsQuery.data && !recordsQuery.isError ? records.length : '—'} assets maintained</Text>
        </View>
        {!online && <Notice text="You’re offline. Reconnect before recording or completing maintenance. Displayed history may be out of date." />}
        {sessions.isError && <Notice text={`Session refresh failed: ${sessions.error.message}`} error />}
        <Card><Text style={styles.heading}>Session details</Text>
          <Detail label="Maintenance date" value={formatPmsDate(session.service_date)} />
          <Detail label="IT personnel / technician" value={session.technician} />
          <Detail label="Created on" value={timestamp(session.created_at)} />
          <Detail label="Completed on" value={session.completed_at ? timestamp(session.completed_at) : 'Session still open'} />
          <Detail label="Session notes" value={session.notes || 'No notes recorded.'} />
        </Card>
        {!closed && <Card><Text style={styles.heading}>Scan after maintenance</Text>
          <Text style={styles.subtitle}>A recognized asset is automatically marked maintained for this session. Scan only after its service or cleaning is finished.</Text>
          <Button title={scanning ? 'Stop camera' : 'Scan asset QR'} disabled={saving || confirm || !online} onPress={() => { void startCamera() }} />
          {permission?.canAskAgain === false && !permission.granted && <Button title="Open camera settings" secondary onPress={() => { void Linking.openSettings() }} />}
          {scanning && active && online && permission?.granted && <View style={{ height: 260, borderRadius: 16, overflow: 'hidden', backgroundColor: '#102B24' }}>
            <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={({ data }) => { if (!armed.current || !active) return; armed.current = false; void mark(data, 'qr') }}
              onMountError={() => { armed.current = false; setScanning(false); setError('Camera unavailable. Enter the QR number or asset tag below.'); }} />
          </View>}
          <Field label="QR number or asset tag" value={code} onChangeText={setCode} editable={!saving && !scanning && !confirm} maxLength={256} autoCorrect={false} autoCapitalize="characters" placeholder="LIV-… or asset tag" />
          {suggestions.map(row => <Button key={row.id} title={`${row.tag} · ${row.name}`} secondary disabled={saving || confirm} onPress={() => setCode(row.tag)} />)}
          <Button title={saving ? 'Saving…' : 'Mark maintained'} secondary disabled={saving || scanning || confirm || !online || !code.trim()} onPress={() => { void mark(code, 'manual') }} />
        </Card>}
        {message && <View accessibilityLiveRegion="polite" style={{ padding: 14, borderRadius: 14, backgroundColor: '#E7F2E5' }}><Text style={[styles.text, { color: colors.green }]}>{message}</Text></View>}
        {error && !confirm && <Notice text={error} error />}
        {closed && <Notice text="This session is complete. Start a new session for additional maintenance." />}
        <Text style={styles.heading}>Maintained assets</Text>
        <Field label="Search maintained assets" placeholder="Asset, QR number, or room" value={search} onChangeText={setSearch} />
        {recordsQuery.isPending && online && <ActivityIndicator color={colors.green} accessibilityLabel="Loading maintenance records" />}
        {recordsQuery.isError && <><Notice text={recordsQuery.error.message} error /><Button title="Retry records" secondary disabled={!online} onPress={() => { void recordsQuery.refetch() }} /></>}
      </View>}
      ListEmptyComponent={!recordsQuery.isPending && !recordsQuery.isError ? <Card><Text style={styles.heading}>{search ? 'No matching assets' : 'No assets maintained yet'}</Text><Text style={styles.subtitle}>{search ? 'Try another asset tag, QR number, or room.' : 'Scan an asset after maintenance to add its record here.'}</Text></Card> : null}
      renderItem={({ item }) => <Card>
        <View style={[styles.row, { justifyContent: 'space-between' }]}><Text style={[styles.heading, { flex: 1 }]}>{item.asset_tag}</Text><Text style={[styles.small, { color: colors.green }]}>Maintained</Text></View>
        <Text style={styles.text}>{item.asset_name}</Text><Text style={styles.small}>{item.qr_id} · {item.category}</Text>
        <Text style={styles.small}>{item.location} · {item.department}</Text>
        <Text style={styles.small}>{timestamp(item.recorded_at)} · {item.method === 'qr' ? 'QR scan' : 'Code entry'}</Text>
        <Button title="View record" secondary onPress={() => {
          Keyboard.dismiss(); armed.current = false; setScanning(false); setSelectedRecord(item)
        }} />
      </Card>}
      ListFooterComponent={!closed ? <View style={{ gap: 12 }}><Text style={styles.subtitle}>You can leave this session open and resume it from Session history.</Text>
        <Button title="Complete session" disabled={saving || !online || recordsQuery.isPending || recordsQuery.isError || !records.length} onPress={() => { armed.current = false; setScanning(false); setError(''); setConfirm(true) }} />
      </View> : null} />
    <Modal transparent visible={Boolean(selectedRecord) && active && !confirm} animationType="fade" onRequestClose={() => setSelectedRecord(null)}>
      <View style={{ flex: 1, paddingHorizontal: 16, paddingTop: insets.top + 16, paddingBottom: insets.bottom + 16, backgroundColor: '#102B2480', justifyContent: 'center' }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Dismiss maintenance record" onPress={() => setSelectedRecord(null)} style={{ position: 'absolute', inset: 0 }} />
        <View accessibilityViewIsModal onAccessibilityEscape={() => setSelectedRecord(null)} style={[styles.card, { width: '100%', maxWidth: 520, maxHeight: '100%', alignSelf: 'center', padding: 0, overflow: 'hidden', gap: 0 }]}>
          <View style={{ padding: 18, backgroundColor: '#143D2D', gap: 6 }}>
            <Text accessibilityRole="header" style={[styles.eyebrow, { color: '#C9E4C2' }]}>MAINTENANCE RECORD</Text>
            <Text style={[styles.heading, { color: '#FFF' }]}>{selectedRecord?.asset_tag}</Text>
            <Text style={[styles.subtitle, { color: '#DBE9DE' }]}>{selectedRecord?.asset_name}</Text>
          </View>
          <ScrollView key={selectedRecord?.id} style={{ flexShrink: 1 }} contentContainerStyle={{ padding: 18, gap: 14 }}>
            <Text style={styles.subtitle}>Asset information saved at the time of service.</Text>
            {selectedRecord && <>
              <Detail label="Asset tag" value={selectedRecord.asset_tag} /><Detail label="Asset name" value={selectedRecord.asset_name} />
              <Detail label="QR number" value={selectedRecord.qr_id} /><Detail label="Category" value={selectedRecord.category} />
              <Detail label="Location at service" value={selectedRecord.location || 'Not recorded'} /><Detail label="Department at service" value={selectedRecord.department || 'Not recorded'} />
              <Detail label="Service" value={session.service_type} /><Detail label="Maintenance date" value={formatPmsDate(session.service_date)} />
              <Detail label="IT personnel / technician" value={session.technician} /><Detail label="Recorded on" value={timestamp(selectedRecord.recorded_at)} />
              <Detail label="Recording method" value={selectedRecord.method === 'qr' ? 'QR scan' : 'Code entry'} /><Detail label="Status" value="Maintained" />
            </>}
          </ScrollView>
          <View style={{ padding: 14, borderTopWidth: 1, borderColor: colors.line }}>
            <Button title="Close record" secondary onPress={() => setSelectedRecord(null)} />
          </View>
        </View>
      </View>
    </Modal>
    <Modal transparent visible={confirm && !closed} animationType="fade" onRequestClose={() => { if (!busy.current) setConfirm(false) }}>
      <View style={{ flex: 1, padding: 24, backgroundColor: '#102B2480', justifyContent: 'center' }}>
        <View accessibilityViewIsModal onAccessibilityEscape={() => { if (!busy.current) setConfirm(false) }} style={styles.card}>
          <Text style={styles.heading}>Complete this PMS session?</Text>
          <Text style={styles.text}>{records.length} {records.length === 1 ? 'asset' : 'assets'} recorded for {formatPmsDate(session.service_date)}. The history will be kept, and no more assets can be added to this session.</Text>
          {error && <Notice text={error} error />}
          <Button title={saving ? 'Completing…' : 'Confirm completion'} disabled={saving || !online} onPress={() => { void complete() }} />
          <Button title="Cancel" secondary disabled={saving} onPress={() => setConfirm(false)} />
        </View>
      </View>
    </Modal>
  </>
}

function Detail({ label, value }: { label: string; value: string }) {
  return <View style={{ gap: 3 }}><Text style={styles.label}>{label}</Text><Text style={styles.text}>{value}</Text></View>
}
