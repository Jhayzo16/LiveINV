import { FlatList, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Ionicons from '@expo/vector-icons/Ionicons'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { deviceCategories } from '../registration'
import { fonts } from '../design'
import { colors, styles } from '../ui'
import { EquipmentImage } from './AssetCard'
import { HeaderBackButton, headerTitleStyle } from './HeaderBackButton'

const descriptions: Record<string, string> = {
  'System Unit': 'Desktop computers, processors, memory and storage.',
  Printer: 'Office printers and network printing equipment.',
  Monitor: 'Computer screens and display equipment.',
  Keyboard: 'Keyboards used with hospital workstations.',
  UPS: 'Backup power and uninterruptible power supplies.',
  Scanner: 'Document scanners and scanning equipment.',
  Router: 'Routers and network access equipment.',
}

export function DeviceCategoryCarousel({ value, onChange }: { value: string; onChange: (category: string) => void }) {
  const { width } = useWindowDimensions()
  const cardWidth = Math.min(300, width * 0.76)
  return <FlatList horizontal data={deviceCategories} keyExtractor={category => category} extraData={value}
    showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 20, gap: 12, paddingBottom: 8 }}
    snapToInterval={cardWidth + 12} decelerationRate="fast" disableIntervalMomentum
    initialScrollIndex={Math.max(0, deviceCategories.findIndex(category => category === value))}
    getItemLayout={(_, index) => ({ length: cardWidth + 12, offset: (cardWidth + 12) * index, index })}
    renderItem={({ item: category }) => {
      const selected = category === value
      return <Pressable accessibilityRole="button" accessibilityLabel={`Choose ${category}`} accessibilityState={{ selected }} onPress={() => onChange(category)} style={({ pressed }) => [card.container, { width: cardWidth, borderColor: selected ? colors.green : colors.line, opacity: pressed ? 0.8 : 1 }]}>
        <LinearGradient colors={selected ? ['#DCEBD9', '#F3F8EE'] : ['#ECF1EA', '#F9FBF6']} style={card.visual}>
          <View style={card.badge}><Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={24} color={selected ? colors.green : '#9AA99B'} /></View>
          <EquipmentImage category={category} height={175} />
        </LinearGradient>
        <View style={card.body}><Text style={styles.heading}>{category}</Text><Text style={[styles.subtitle, { minHeight: 57 }]}>{descriptions[category]}</Text><Text style={[card.selection, { color: selected ? colors.green : colors.red }]}>{selected ? 'Selected' : 'Select device'} {selected ? '✓' : '→'}</Text></View>
      </Pressable>
    }} />
}

export function RegistrationHeader({ step, onBack, disabled }: { step?: 1 | 2; onBack: () => void; disabled: boolean }) {
  const insets = useSafeAreaInsets()
  return <View style={[card.progress, { paddingTop: insets.top + 4, paddingLeft: Math.max(insets.left, 16), paddingRight: Math.max(insets.right, 16) }]}>
    <View style={card.progressHeading}>
      <View style={card.headerSide}><HeaderBackButton label={step === 2 ? 'Back to device type' : 'Back to assets'} disabled={disabled} onPress={onBack} color="#FFF" /></View>
      <Text accessibilityRole="header" style={card.progressTitle}>{step ? 'Register device' : 'Device registered'}</Text>
      <View style={card.headerSide}>{step && <Text style={card.stepCount}>Step {step} of 2</Text>}</View>
    </View>
    {step && <View accessible accessibilityLabel={`Step ${step} of 2: ${step === 1 ? 'Device type' : 'Device details'}`} style={card.steps}>
      <View style={card.step}><View style={[card.circle, card.current]}>{step === 2 ? <Ionicons name="checkmark" size={16} color="#FFF" /> : <Text style={card.number}>1</Text>}</View><Text style={card.stepLabel}>Device type</Text></View>
      <View style={[card.connector, step === 2 && { backgroundColor: '#A8CFA6' }]} />
      <View style={card.step}><View style={[card.circle, step === 2 && card.current]}><Text style={[card.number, step === 1 && { color: '#A8BCAF' }]}>2</Text></View><Text style={[card.stepLabel, step === 1 && { color: '#A8BCAF' }]}>Device details</Text></View>
    </View>}
  </View>
}

const card = StyleSheet.create({
  container: { borderRadius: 23, overflow: 'hidden', borderWidth: 2, backgroundColor: '#FFF' },
  visual: { padding: 16, gap: 4 },
  badge: { alignItems: 'flex-end' },
  body: { padding: 17, gap: 9 },
  selection: { fontSize: 11, fontFamily: fonts.bold },
  progress: { backgroundColor: '#173F2C', paddingBottom: 16, gap: 9 },
  progressHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 4, minHeight: 44 },
  headerSide: { width: 64 },
  progressTitle: { ...headerTitleStyle, color: '#FFF', flex: 1, textAlign: 'center' },
  stepCount: { fontFamily: fonts.medium, fontSize: 10, color: '#D2E4D7', textAlign: 'right' },
  steps: { flexDirection: 'row', alignItems: 'flex-start', paddingHorizontal: 18 },
  step: { alignItems: 'center', gap: 7, width: 86 },
  circle: { width: 27, height: 27, borderRadius: 14, borderWidth: 1.5, borderColor: '#668572', alignItems: 'center', justifyContent: 'center' },
  current: { backgroundColor: colors.green, borderColor: '#B4D5AC' },
  number: { fontSize: 11, fontFamily: fonts.bold, color: '#FFF' },
  stepLabel: { fontSize: 10, fontFamily: fonts.medium, color: '#FFF' },
  connector: { flex: 1, height: 2, backgroundColor: '#668572', marginTop: 13, marginHorizontal: -25 },
})
