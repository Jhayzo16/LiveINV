import { useRef, useState } from 'react'
import { Alert, Image, Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { router, Stack } from 'expo-router'
import { usePreventRemove } from 'expo-router/react-navigation'
import { useQuery } from '@tanstack/react-query'
import * as Crypto from 'expo-crypto'
import QRCode from 'react-native-qrcode-svg'
import { useInventory, actions } from '../../store'
import { type AssetRow } from '../../domain'
import { availableStock, buildDevice, deviceStates, emptyDevice, receiptCapacity, RegistrationError, supportsIp, type DeviceForm, type DeviceInsert } from '../../registration'
import { Button, Card, Chip, Field, Notice, Page, styles, colors } from '../../ui'
import { StockPicker } from '../../components/StockPicker'
import { EquipmentImage } from '../../components/AssetCard'
import { DeviceCategoryCarousel, RegistrationHeader } from '../../components/DeviceCategoryCarousel'
import { fonts, watermark } from '../../design'

export default function AddDevice() {
  const insets = useSafeAreaInsets()
  const { online, rows, userId } = useInventory()
  const [form, setForm] = useState<DeviceForm>({ ...emptyDevice, category: '' })
  const [step, setStep] = useState<1 | 2>(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [uncertain, setUncertain] = useState(false)
  const [saved, setSaved] = useState<AssetRow | null>(null)
  const [picker, setPicker] = useState<'RAM' | 'SSD' | null>(null)
  const request = useRef<DeviceInsert | null>(null)
  const submitting = useRef(false)
  const system = form.category === 'System Unit'
  const locked = saving || uncertain
  const stock = useQuery({ queryKey: ['registration-stock', userId], queryFn: actions.loadRegistrationStock, enabled: step === 2 && system && online && !saved, staleTime: 0, retry: 1 })
  function backToCategories() {
    if (locked) return
    Keyboard.dismiss(); setStep(1); setError(''); setPicker(null)
  }
  usePreventRemove(!saved && (saving || step === 2), () => {
    if (saving) Alert.alert('Saving device', 'Please wait while the device registration is confirmed.')
    else if (uncertain) Alert.alert('Check registration', 'Retry the current save to confirm its result before changing the device.')
    else backToCategories()
  })
  function change<K extends keyof DeviceForm>(field: K, value: DeviceForm[K]) {
    if (locked) return
    setForm(current => ({ ...current, [field]: value })); setError('')
  }
  async function save() {
    if (submitting.current || saved || step !== 2) return
    submitting.current = true; setSaving(true); setError('')
    try {
      if (!request.current) {
        if (rows.some(row => row.tag.toUpperCase() === form.tag.trim().toUpperCase())) throw new RegistrationError('This asset tag already exists. Enter a unique tag.')
        request.current = buildDevice(form, stock.data || [], { id: Crypto.randomUUID(), qrId: `LIV-${Crypto.randomUUID().replaceAll('-', '').slice(0, 8).toUpperCase()}` })
      }
      const result = await actions.registerDevice(request.current)
      setSaved(result); setUncertain(false); request.current = null
    } catch (e) {
      const keepRequest = Boolean(request.current) && !(e instanceof RegistrationError && !e.uncertain)
      if (!keepRequest) request.current = null
      setUncertain(keepRequest)
      setError(e instanceof Error ? e.message : 'Could not save this device. Try again.')
    } finally { submitting.current = false; setSaving(false) }
  }
  const header = <Stack.Screen options={{
    header: () => <RegistrationHeader step={saved ? undefined : step} disabled={locked} onBack={() => {
      if (!saved && step === 2) backToCategories()
      else router.back()
    }} />,
    headerShadowVisible: false,
    statusBarStyle: 'light',
  }} />
  if (saved) return <>{header}<Page>
    <Text style={styles.eyebrow}>DEVICE REGISTERED</Text><Text style={styles.title}>{saved.tag}</Text><Text style={styles.subtitle}>{saved.name} is now in the shared inventory.</Text>
    <Card><Text style={styles.heading}>Your device QR code</Text><View style={{ alignItems: 'center', paddingVertical: 12 }}><QRCode value={`liveinv:qr:${saved.qr_id}`} size={190} quietZone={12} color="#1B6C24" backgroundColor="#FFFFFF" ecl="H" /></View><Text selectable style={[styles.text, { textAlign: 'center' }]}>{saved.qr_id}</Text><Text style={styles.small}>Use this fallback ID if the printed label cannot be scanned.</Text></Card>
    <Notice text="The device is unassigned. Open its record to assign a room and share or print the QR label." />
    <Button title="Open device record" onPress={() => router.replace({ pathname: '/asset/[id]', params: { id: saved.id } })} />
    <Button title="Back to assets" secondary onPress={() => router.back()} />
  </Page></>

  return <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#FFF' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
    {header}
    <ScrollView key={step} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag" contentContainerStyle={{ paddingBottom: 18 }}>
      {step === 1 ? <View style={{ gap: 20, paddingVertical: 24 }}>
        <View style={{ gap: 7, paddingHorizontal: 20 }}><Text style={design.title}>Choose your device</Text><Text style={styles.subtitle}>Swipe through the categories and tap the device you want to register.</Text></View>
        <DeviceCategoryCarousel value={form.category} onChange={category => change('category', category)} />
        <View style={{ paddingHorizontal: 20 }}><Text style={styles.small}>Next, enter the details for your selected device.</Text></View>
      </View> : <>
      <LinearGradient colors={['#E1ECE0', '#F4F7EE', '#D7E8D8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={design.hero}>
        <Image source={watermark} resizeMode="contain" style={design.watermark} />
        <View style={design.heroTop}><Text style={styles.eyebrow}>LIVEINV · NEW DEVICE</Text><View style={design.heroBadge}><Ionicons name="cube-outline" size={17} color={colors.green} /></View></View>
        <EquipmentImage category={form.category} height={190} />
      </LinearGradient>
      <View style={design.sheet}>
        <View style={{ gap: 5 }}><Text style={design.title}>{form.category}</Text><Text style={styles.subtitle}>Register equipment in your hospital inventory.</Text></View>
        <Button title="← Change device type" secondary disabled={locked} onPress={backToCategories} />
        <View style={design.assignment}><Ionicons name="location-outline" size={14} color={colors.red} /><Text style={design.assignmentText}>Unassigned · Choose a room after registration</Text></View>
      {!online && <Notice text="You can fill in the details offline. Connect to load stock and save the device." />}
      <View style={design.section}><Text style={styles.heading}>Device details</Text><Text style={styles.small}>Fields marked * are required.</Text>
        <Field label="Asset tag *" placeholder="e.g. PC-MRR-015" maxLength={50} autoCapitalize="characters" autoCorrect={false} editable={!locked} value={form.tag} onChangeText={value => change('tag', value)} />
        <Field label="Brand *" placeholder="e.g. Dell, HP, APC" maxLength={100} editable={!locked} value={form.brand} onChangeText={value => change('brand', value)} />
        <Field label="Model *" placeholder="e.g. OptiPlex 7090" maxLength={100} editable={!locked} value={form.model} onChangeText={value => change('model', value)} />
        <Text style={styles.label}>Status</Text><View style={styles.row}>{deviceStates.map(state => <Chip key={state} label={state} selected={form.state === state} onPress={() => change('state', state)} />)}</View>
        {supportsIp(form.category) && <Field label="IP address (optional)" placeholder="e.g. 10.20.5.31" keyboardType="numbers-and-punctuation" autoCapitalize="none" autoCorrect={false} editable={!locked} value={form.ip} onChangeText={value => change('ip', value)} />}
      </View>
      {system && <>
        <View style={design.section}><Text style={styles.heading}>System unit specifications</Text><Field label="Processor *" placeholder="e.g. Intel Core i5-12400" maxLength={255} editable={!locked} value={form.processor} onChangeText={value => change('processor', value)} /></View>
        <View style={design.section}><Text style={styles.heading}>Memory & storage</Text><Text style={styles.subtitle}>Choose consumables and enter the installed quantity. Stock is deducted when the device is saved.</Text>
          {stock.isFetching && <Text style={styles.small}>Loading available stock…</Text>}
          {stock.isError && <Notice error text="Stock could not be loaded. Refresh before choosing parts." />}
          <Button title="Refresh stock" secondary disabled={locked || !online || stock.isFetching} onPress={() => void stock.refetch()} />
          {(['RAM', 'SSD'] as const).map(kind => {
            const idField = kind === 'RAM' ? 'ramReceiptId' : 'ssdReceiptId'
            const countField = kind === 'RAM' ? 'ramModules' : 'ssdCount'
            const receipt = stock.data?.find(item => item.id === form[idField])
            const capacity = receipt && receiptCapacity(receipt)
            return <View key={kind} style={{ gap: 9, paddingTop: 12 }}><Text style={styles.heading}>{kind}</Text>
              <Button title={receipt ? `Change ${kind} stock` : `Choose ${kind} stock`} secondary disabled={locked || !online || stock.isFetching || stock.isError || !stock.data} onPress={() => setPicker(kind)} />
              <Text style={styles.text}>{receipt ? `${receipt.item_name} · ${receipt.specification}` : form[idField] ? 'Selected receipt unavailable. Refresh stock.' : `No ${kind} installed`}</Text>
              {receipt && <Text style={styles.small}>{availableStock(receipt)} available · {capacity || 'Unknown'} GB per piece</Text>}
              {form[idField] && <><Field label={kind === 'RAM' ? 'RAM modules installed *' : 'SSDs installed *'} keyboardType="number-pad" editable={!locked} value={form[countField]} onChangeText={value => change(countField, value)} /><Text style={styles.small}>{Number(form[countField]) || 0} × {capacity || 0} GB = {(Number(form[countField]) || 0) * (capacity || 0)} GB total</Text></>}
            </View>
          })}
        </View>
      </>}
      </View>
      </>}
    </ScrollView>
    <View style={[design.footer, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {error && <Notice error text={error} />}
      {uncertain && <Text style={styles.small}>Details are held for a safe retry. Retrying checks the original registration before creating anything.</Text>}
      {step === 1 ? <View style={design.footerRow}><View style={{ flex: 1, gap: 2 }}><Text style={design.footerTitle}>{form.category || 'Choose a category'}</Text><Text style={styles.small}>{form.category ? 'Ready for device details' : 'Tap a card to select'}</Text></View><View style={{ flex: 1.2 }}><Button title="Continue →" disabled={!form.category} onPress={() => { setStep(2); setError('') }} /></View></View> : <View style={design.footerRow}><View style={{ flex: 1, gap: 2 }}><Text style={design.footerTitle}>Register device</Text><Text style={styles.small}>Includes a QR label</Text></View><View style={{ flex: 1.2 }}><Button title={saving ? 'Saving…' : uncertain ? 'Check & retry' : 'Save device →'} disabled={saving || !online} onPress={() => void save()} /></View></View>}
    </View>
    {picker && <StockPicker kind={picker} receipts={stock.data || []} selected={picker === 'RAM' ? form.ramReceiptId : form.ssdReceiptId} onClose={() => setPicker(null)} onSelect={id => {
      const idField = picker === 'RAM' ? 'ramReceiptId' : 'ssdReceiptId'
      const countField = picker === 'RAM' ? 'ramModules' : 'ssdCount'
      setForm(current => ({ ...current, [idField]: id, [countField]: id ? '1' : '0' })); setError(''); setPicker(null)
    }} />}
  </KeyboardAvoidingView>
}

const design = StyleSheet.create({
  hero: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 34, gap: 5, overflow: 'hidden' },
  heroTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  heroBadge: { width: 32, height: 32, borderRadius: 16, backgroundColor: '#FFFFFFB0', alignItems: 'center', justifyContent: 'center' },
  watermark: { position: 'absolute', right: -25, top: 4, width: 230, height: 230, opacity: 0.045 },
  sheet: { marginTop: -24, borderTopLeftRadius: 28, borderTopRightRadius: 28, backgroundColor: '#FFF', padding: 20, gap: 16 },
  title: { fontFamily: fonts.title, fontSize: 23, letterSpacing: -0.6, color: colors.ink },
  assignment: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#F7F0F0', borderRadius: 12 },
  assignmentText: { flex: 1, fontFamily: fonts.medium, fontSize: 10, lineHeight: 16, color: colors.red },
  section: { gap: 12, paddingTop: 18, borderTopWidth: 1, borderColor: '#EEF1ED' },
  footer: { gap: 8, paddingHorizontal: 20, paddingTop: 12, backgroundColor: '#FFF', borderTopWidth: 1, borderColor: '#E8EEE8' },
  footerRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  footerTitle: { fontFamily: fonts.bold, fontSize: 12, color: colors.ink },
})
