import { useRef, useState } from 'react'
import { Alert, KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native'
import { router, Stack, useLocalSearchParams } from 'expo-router'
import { usePreventRemove } from 'expo-router/react-navigation'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useQuery } from '@tanstack/react-query'
import { actions, useInventory } from '../../../store'
import type { AssetRow } from '../../../domain'
import { buildDeviceEdit, DeviceEditError, editDeviceForm, removedParts, type DeviceEditRequest, type EditDeviceForm } from '../../../device-edit'
import { availableStock, deviceCategories, deviceStates, receiptCapacity, supportsIp } from '../../../registration'
import { EquipmentImage } from '../../../components/AssetCard'
import { StockPicker } from '../../../components/StockPicker'
import { Button, Card, Chip, Field, Notice, Page, styles } from '../../../ui'

export default function EditDevice() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const row = useInventory(state => state.rows.find(item => item.id === id))
  return row ? <Editor key={row.id} initial={row} /> : <Page><Notice text="This device is not in the downloaded inventory. Return to Assets and refresh." /></Page>
}
function Editor({ initial }: { initial: AssetRow }) {
  const [base, setBase] = useState(initial)
  const [form, setForm] = useState(() => editDeviceForm(initial))
  const [saving, setSaving] = useState(false)
  const [uncertain, setUncertain] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [picker, setPicker] = useState<'RAM' | 'SSD' | null>(null)
  const request = useRef<DeviceEditRequest | null>(null)
  const submitting = useRef(false)
  const { online, userId, rows, pending } = useInventory()
  const insets = useSafeAreaInsets()
  const locked = saving || uncertain
  const system = form.category === 'System Unit'
  const stock = useQuery({ queryKey: ['registration-stock', userId], queryFn: actions.loadRegistrationStock,
    enabled: online && !saved && (system || Boolean(base.ram_receipt_id || base.ssd_receipt_id)), staleTime: 0 })
  const hasPending = pending.some(change => change.assetId === base.id)
  const processors = [...new Set(rows.map(row => row.processor).filter((value): value is string => Boolean(value)))].slice(0, 8)
  usePreventRemove(!saved && locked, () => Alert.alert(saving ? 'Saving device' : 'Confirm the save', saving ? 'Please wait while the update is confirmed.' : 'Retry the same save to confirm its result before leaving the editor.'))
  function change<K extends keyof EditDeviceForm>(key: K, value: EditDeviceForm[K]) {
    if (locked) return
    setForm(current => ({ ...current, [key]: value })); setError('')
  }
  async function save() {
    if (submitting.current) return
    submitting.current = true; setSaving(true); setError('')
    try {
      request.current ||= { base, patch: buildDeviceEdit(base, form, stock.data || []) }
      await actions.editDevice(request.current)
      setSaved(true); setUncertain(false); request.current = null
    } catch (cause) {
      const keep = Boolean(request.current) && (!(cause instanceof DeviceEditError) || cause.uncertain)
      if (!keep) request.current = null
      setUncertain(keep); setError(cause instanceof Error ? cause.message : 'Could not save the device. Please retry.')
    } finally { submitting.current = false; setSaving(false) }
  }
  async function refreshLatest() {
    if (submitting.current || locked) return
    submitting.current = true; setSaving(true); setError('')
    try {
      await actions.refresh()
      const state = useInventory.getState()
      if (state.error || !state.online) throw new Error(state.error || 'Connect to refresh this device.')
      const current = state.rows.find(row => row.id === base.id)
      if (!current) throw new Error('This device no longer exists.')
      setBase(current); setForm(editDeviceForm(current)); request.current = null
      void stock.refetch()
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not refresh.') }
    finally { submitting.current = false; setSaving(false) }
  }
  const header = <Stack.Screen options={{ title: 'Edit device', headerStyle: { backgroundColor: '#102D23' }, headerTintColor: '#FFF', headerShadowVisible: false }} />
  if (saved) return <>{header}<Page><Text style={styles.eyebrow}>DEVICE UPDATED</Text><Text style={styles.title}>{base.tag}</Text>
    <Notice text="Your changes are saved in the shared inventory." /><Button title="Back to equipment record" onPress={() => router.back()} />
  </Page></>
  return <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    {header}
    <ScrollView style={styles.page} contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 24 }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <View style={{ backgroundColor: '#143D2D', borderRadius: 22, padding: 16, gap: 8 }}>
        <EquipmentImage category={form.category} height={130} />
        <Text style={[styles.heading, { color: '#FFF' }]}>{base.tag}</Text><Text style={[styles.small, { color: '#D9E8DA' }]}>{base.qr_id} · Permanent QR label</Text>
      </View>
      <Text style={styles.title}>Update asset record</Text><Text style={styles.subtitle}>Edit its description, status, and applicable technical specifications.</Text>
      {!online && <Notice text="Connect to save device details and load available stock." />}
      {hasPending && <Notice text="This device has an unsynced change. Refresh inventory before editing." />}
      <Card><Text style={styles.label}>Device category</Text><View style={styles.row}>{deviceCategories.map(category => <Chip key={category} label={category} selected={form.category === category} onPress={() => change('category', category)} />)}</View>
        <Text style={styles.label}>Status</Text><View style={styles.row}>{deviceStates.map(state => <Chip key={state} label={state} selected={form.state === state} onPress={() => change('state', state)} />)}</View>
        <Field label="Brand *" maxLength={100} editable={!locked} value={form.brand} onChangeText={value => change('brand', value)} />
        <Field label="Model *" maxLength={100} editable={!locked} value={form.model} onChangeText={value => change('model', value)} />
        {supportsIp(form.category) && <Field label="IPv4 address (optional)" value={form.ip} editable={!locked} onChangeText={value => change('ip', value)} autoCapitalize="none" autoCorrect={false} keyboardType="numbers-and-punctuation" placeholder="192.168.1.10" />}
      </Card>
      {system && <Card><Text style={styles.heading}>System unit specifications</Text>
        <Field label="Processor *" value={form.processor} editable={!locked} maxLength={255} onChangeText={value => change('processor', value)} />
        {processors.length > 0 && <><Text style={styles.small}>Existing processor suggestions</Text><View style={styles.row}>{processors.map(processor => <Chip key={processor} label={processor} onPress={() => change('processor', processor)} />)}</View></>}
      </Card>}
      {(system || base.ram_receipt_id || base.ssd_receipt_id) && <Card><Text style={styles.heading}>Memory & storage</Text>
        <Text style={styles.subtitle}>Additional parts use consumable stock. Choose what happens to any removed parts.</Text>
        {stock.isFetching && <Text style={styles.small}>Loading stock…</Text>}
        {stock.isError && <Notice error text="Stock could not be loaded. Refresh stock before choosing new parts." />}
        <Button title="Refresh stock" secondary disabled={locked || !online || stock.isFetching} onPress={() => { void stock.refetch() }} />
        {(['RAM', 'SSD'] as const).map(kind => {
          const ram = kind === 'RAM'
          const source = ram ? form.ramReceiptId : form.ssdReceiptId
          const oldSource = ram ? base.ram_receipt_id : base.ssd_receipt_id
          const oldCount = (ram ? base.ram_modules : base.ssd_count) || 0
          const legacy = !oldSource && oldCount > 0
          const count = ram ? form.ramModules : form.ssdCount
          const receipt = stock.data?.find(item => item.id === source)
          const capacity = receipt ? receiptCapacity(receipt) : (ram ? base.ram_capacity_gb : base.ssd_capacity_gb) || 0
          const removed = removedParts(base, form, kind)
          const disposition = ram ? form.returnRam : form.returnSsd
          return <View key={kind} style={{ gap: 10, paddingVertical: 10 }}>
            <Text style={styles.heading}>{kind}</Text>
            {system && <>
              <Text style={styles.text}>{receipt ? `${receipt.item_name} · ${receipt.specification}` : source ? 'Current linked receipt' : legacy ? 'Existing installed parts (unlinked)' : `No ${kind} installed`}</Text>
              <Button title={`Choose ${kind} stock`} secondary disabled={locked || !online || stock.isPending || stock.isError} onPress={() => setPicker(kind)} />
              {(source || legacy) && <Field label={ram ? 'RAM modules installed' : 'SSDs installed'} value={count} editable={!locked} keyboardType="number-pad" onChangeText={value => change(ram ? 'ramModules' : 'ssdCount', value)} />}
              <Text style={styles.small}>{Number(count) || 0} × {capacity || 0} GB installed{receipt ? ` · ${availableStock(receipt)} additional pieces available` : ''}</Text>
            </>}
            {removed > 0 && <><Text style={styles.text}>{removed} {kind} removed — stock action</Text><View style={styles.row}>
              <Chip label="Return usable parts" selected={disposition === 'return'} onPress={() => change(ram ? 'returnRam' : 'returnSsd', 'return')} />
              <Chip label="Keep used / discarded" selected={disposition === 'discard'} onPress={() => change(ram ? 'returnRam' : 'returnSsd', 'discard')} />
            </View></>}
          </View>
        })}
      </Card>}
      <Notice text="Your asset tag and QR label stay the same. Room and department are managed separately through Room assignment." />
      {error && <Notice error text={error} />}
      {uncertain && <Text style={styles.small}>Details are held for a safe retry. Retrying checks whether this update was already saved.</Text>}
      <Button title={saving ? 'Saving…' : uncertain ? 'Check & retry save' : 'Save changes'} disabled={saving || !online || hasPending} onPress={() => { void save() }} />
      {error && !locked && <Button title="Reload latest record (reset form)" secondary disabled={!online} onPress={() => { void refreshLatest() }} />}
      <Button title="Cancel" secondary disabled={locked} onPress={() => router.back()} />
    </ScrollView>
    {picker && <StockPicker kind={picker} receipts={stock.data || []} selected={picker === 'RAM' ? form.ramReceiptId : form.ssdReceiptId}
      installedReceiptId={picker === 'RAM' ? base.ram_receipt_id : base.ssd_receipt_id}
      emptyLabel={!(picker === 'RAM' ? base.ram_receipt_id : base.ssd_receipt_id) && ((picker === 'RAM' ? base.ram_modules : base.ssd_count) || 0) > 0 ? 'Keep existing installed parts' : undefined}
      onClose={() => setPicker(null)} onSelect={source => {
        const ram = picker === 'RAM'
        const legacy = !(ram ? base.ram_receipt_id : base.ssd_receipt_id) && ((ram ? base.ram_modules : base.ssd_count) || 0) > 0
        setForm(current => ({ ...current, [ram ? 'ramReceiptId' : 'ssdReceiptId']: source,
          [ram ? 'ramModules' : 'ssdCount']: source ? String(Math.max(1, Number(ram ? current.ramModules : current.ssdCount) || 0)) : legacy ? String((ram ? base.ram_modules : base.ssd_count) || 0) : '0',
          [ram ? 'returnRam' : 'returnSsd']: '' }))
        setPicker(null); setError('')
      }} />}
  </KeyboardAvoidingView>
}
