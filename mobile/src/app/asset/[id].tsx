import { useRef, useState } from 'react'
import { Alert, Image, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import QRCode from 'react-native-qrcode-svg'
import * as Print from 'expo-print'
import * as Sharing from 'expo-sharing'
import { actions, useInventory } from '../../store'
import { EquipmentImage } from '../../components/AssetCard'
import { escapeHtml, type AssetPatch } from '../../domain'
import { RoomAssignmentModal } from '../../components/RoomAssignmentModal'
import { Button, Card, Notice, Page, styles, SyncBanner, colors } from '../../ui'
import { fonts, watermark } from '../../design'

export default function AssetDetail() {
  const insets = useSafeAreaInsets()
  const { id, method } = useLocalSearchParams<{ id: string; method?: string }>()
  const { rows, pending, userId } = useInventory()
  const row = rows.find(item => item.id === id)
  const editBase = useRef(row)
  const [assigning, setAssigning] = useState(false)
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [error, setError] = useState('')
  const qr = useRef<{ toDataURL: (callback: (data: string) => void) => void } | null>(null)
  if (!row) return <Page><Notice text="This equipment record is not in the downloaded inventory. Go back and refresh inventory." /></Page>
  const asset = row
  const change = pending.find(item => item.assetId === row.id)
  async function save(patch: AssetPatch) {
    setBusy(true); setError(''); setFeedback('')
    try { await actions.queue(editBase.current || asset, patch); setAssigning(false); setFeedback(Object.keys(patch).length ? 'Change saved on this device. Refresh inventory from Home to check server confirmation.' : 'No changes to save.') }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save this change.') }
    finally { setBusy(false) }
  }
  async function shareLabel() {
    setBusy(true); setError('')
    try {
      if (!qr.current) throw new Error('The QR label is still loading. Try again.')
      const data = await new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('Could not render the label. Try again.')), 10_000)
        qr.current!.toDataURL(value => { clearTimeout(timer); resolve(value) })
      })
      const html = `<html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head><body style="font-family:Arial;text-align:center;padding:24px"><h1 style="color:#17663e">LiveINV</h1><img width="240" height="240" src="data:image/png;base64,${data}"/><h2>${escapeHtml(asset.tag)}</h2><p>${escapeHtml(asset.qr_id)}</p><p>Tagum Global Medical Center</p></body></html>`
      const file = await Print.printToFileAsync({ html, width: 360, height: 500 })
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(file.uri, { mimeType: 'application/pdf', dialogTitle: `QR label · ${asset.tag}`, UTI: 'com.adobe.pdf' })
      else await Print.printAsync({ uri: file.uri })
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not share the QR label.') }
    finally { setBusy(false) }
  }
  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FFF' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    <Stack.Screen options={{ title: 'Equipment record', headerStyle: { backgroundColor: '#102D23' }, headerTintColor: '#FFFFFF', headerShadowVisible: false }} />
    <ScrollView keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) }}>
      <LinearGradient colors={['#102D23', '#1E4935', '#102D23']} style={record.hero}>
        <Image source={watermark} resizeMode="contain" style={record.watermark} />
        <View style={record.heroLabel}><Ionicons name="cube-outline" size={14} color="#D9E8DA" /><Text style={record.category}>{row.category}</Text></View>
        <View style={record.imageStage}><EquipmentImage category={row.category} height={220} /></View>
      </LinearGradient>
      <View style={record.sheet}>
        <View style={record.handle} />
        <View style={record.identity}><Text selectable style={record.tag}>{row.tag}</Text><Text style={[record.status, row.state === 'Active' ? record.active : row.state === 'Maintenance' ? record.maintenance : row.state === 'Broken' ? record.broken : record.inactive]}>{row.state}</Text></View>
        <Text style={record.name}>{row.name}</Text>
        <Text style={styles.subtitle}>{[row.brand, row.model].filter(Boolean).join(' · ') || row.category}</Text>
        <Button title="Edit device" disabled={busy || Boolean(change)} onPress={() => router.push({ pathname: '/asset/edit/[id]', params: { id: row.id } })} />
        {row.category === 'System Unit' && <View style={record.specs}>
          {[
            ['CPU', row.processor],
            ['RAM', row.ram_capacity_gb == null ? null : `${row.ram_capacity_gb * (row.ram_modules ?? 0)} GB total`],
            ['SSD', row.ssd_capacity_gb == null ? null : `${row.ssd_capacity_gb * (row.ssd_count ?? 0)} GB total`],
          ].filter(([, value]) => value != null && value !== '').map(([label, value]) => <View key={label} style={record.spec}><Text style={record.specLabel}>{label}</Text><Text style={record.specValue}>{value}</Text></View>)}
        </View>}
        <View style={record.location}><Ionicons name="location-outline" size={17} color={colors.green} /><View style={{ flex: 1, gap: 2 }}><Text style={styles.text}>{row.location || 'Unassigned'}</Text><Text style={styles.small}>{row.owner || 'No department assigned'}</Text></View></View>
        <SyncBanner />
        {change && <Card><Text style={styles.heading}>Unsynced device update</Text>
          <Text style={styles.subtitle}>{change.message || 'This device has a saved change waiting for sync. Reconnect and refresh inventory, or discard that change before editing again.'}</Text>
          <Button title="Discard unsynced update" secondary disabled={busy} onPress={() => Alert.alert('Discard this update?', 'Your unsynced edit will be removed. The server record will stay unchanged.', [
            { text: 'Cancel', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => {
              setBusy(true); setError('')
              void actions.discard(change.id).catch(cause => setError(cause instanceof Error ? cause.message : 'Could not discard the update.')).finally(() => setBusy(false))
            } },
          ])} />
        </Card>}
    {feedback && <Notice text={feedback} />}{error && <Notice text={error} error />}
    <View style={record.section}><Text style={styles.heading}>Equipment details</Text>
      {[
        ['Condition', row.state], ['IP address', row.ip], ['Brand', row.brand], ['Model', row.model],
        ['Processor', row.processor], ['RAM', row.ram_capacity_gb == null ? null : `${row.ram_capacity_gb} GB × ${row.ram_modules ?? 0}`],
        ['SSD', row.ssd_capacity_gb == null ? null : `${row.ssd_capacity_gb} GB × ${row.ssd_count ?? 0}`],
      ].filter(([, value]) => value != null).map(([label, value]) => <View key={label} style={record.detailRow}><Text style={[styles.label, { width: 84 }]}>{label}</Text><Text selectable style={[styles.text, { flex: 1, textAlign: 'right' }]}>{value}</Text></View>)}
    </View>
    <View style={record.section}><Text style={styles.heading}>Room assignment</Text><Text style={styles.text}>{row.location}</Text><Text style={styles.subtitle}>{row.owner}</Text>
      {row.assignment_room_id && <Text style={styles.small}>Room ID · {row.assignment_room_id}</Text>}
      <Button title="Assign to a room" secondary disabled={busy || Boolean(change)} onPress={() => { editBase.current = row; setAssigning(true); setError(''); setFeedback('') }} />
    </View>
    <View style={record.section}><Text style={styles.heading}>Permanent QR label</Text><View style={{ alignItems: 'center', paddingVertical: 12 }}>
      <QRCode value={`liveinv:qr:${row.qr_id}`} size={200} quietZone={12} color="#17663E" backgroundColor="#FFFFFF" ecl="H" getRef={value => { qr.current = value }} />
    </View><Text selectable style={[styles.text, { textAlign: 'center' }]}>{row.qr_id}</Text><Text style={styles.small}>This label uses the same QR number as the website. It contains only an identifier.</Text>
      <Button title="Share or print QR label" disabled={busy} secondary onPress={() => void shareLabel()} /></View>
      </View>
    </ScrollView>
    {assigning && <RoomAssignmentModal assetTag={row.tag} busy={busy} disabled={Boolean(change) || !userId} error={error}
      onClose={() => { setAssigning(false); setError('') }} onConfirm={selected => {
        if (busy || change || !userId) return
        void save({ assignment_floor_id: selected.floor, assignment_room_id: selected.roomId, assignment_room_name: selected.room,
          assignment_department_id: selected.department, assigned_by: userId, assigned_at: new Date().toISOString(),
          assignment_method: method === 'qr' ? 'qr' : 'manual', location: `F${selected.floor} · ${selected.room}`, owner: selected.department })
      }} />}
  </KeyboardAvoidingView>
}

const record = StyleSheet.create({
  hero: { paddingHorizontal: 24, paddingTop: 8, paddingBottom: 40, overflow: 'hidden' },
  watermark: { position: 'absolute', right: -25, top: 10, width: 240, height: 240, opacity: 0.04 },
  heroLabel: { flexDirection: 'row', gap: 6, alignItems: 'center', alignSelf: 'center', paddingHorizontal: 12, paddingVertical: 7, borderRadius: 20, backgroundColor: '#FFFFFF12' },
  category: { color: '#D9E8DA', fontFamily: fonts.medium, fontSize: 11 },
  imageStage: { paddingTop: 12, paddingBottom: 12, maxWidth: 420, width: '100%', alignSelf: 'center' },
  sheet: { marginTop: -28, borderTopLeftRadius: 30, borderTopRightRadius: 30, backgroundColor: '#FFF', padding: 20, gap: 12 },
  handle: { width: 34, height: 3, borderRadius: 2, backgroundColor: '#DCE5DD', alignSelf: 'center', marginTop: -9, marginBottom: 5 },
  identity: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  tag: { flex: 1, fontFamily: fonts.bold, fontSize: 11, letterSpacing: 0.8, color: colors.red },
  status: { fontFamily: fonts.bold, fontSize: 10, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 14 },
  active: { color: colors.green, backgroundColor: '#E4F1E3' },
  maintenance: { color: '#80551C', backgroundColor: '#FFF0D6' },
  broken: { color: colors.red, backgroundColor: '#F8E3E4' },
  inactive: { color: '#53615A', backgroundColor: '#E6ECE8' },
  name: { fontFamily: fonts.title, fontSize: 22, lineHeight: 29, color: colors.ink, letterSpacing: -0.6 },
  specs: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  spec: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 5, backgroundColor: '#F5F7F4', borderWidth: 1, borderColor: '#E6ECE3', borderRadius: 9, paddingHorizontal: 9, paddingVertical: 7, maxWidth: '100%' },
  specLabel: { fontFamily: fonts.bold, fontSize: 10, color: colors.green },
  specValue: { flexShrink: 1, fontFamily: fonts.medium, fontSize: 10, lineHeight: 16, color: colors.ink },
  location: { flexDirection: 'row', gap: 10, alignItems: 'center', padding: 12, borderRadius: 14, backgroundColor: '#F0F5EF' },
  section: { borderTopWidth: 1, borderColor: '#E8EEE7', paddingTop: 18, marginTop: 5, gap: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, paddingVertical: 7, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: '#EDF1EC' },
})
