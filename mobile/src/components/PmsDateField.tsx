import { useState } from 'react'
import { Modal, Pressable, Text, View } from 'react-native'
import { Button, Field, styles, colors } from '../ui'
import { localDate } from '../shared/pms'
import { validPmsDate } from '../pms'

export function PmsDateField({ value, onChange, disabled }: { value: string; onChange: (value: string) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false)
  const [month, setMonth] = useState(() => new Date(`${localDate().slice(0, 7)}-01T12:00:00`))
  const start = new Date(month.getFullYear(), month.getMonth(), 1, 12).getDay()
  const days = new Date(month.getFullYear(), month.getMonth() + 1, 0, 12).getDate()
  return <View style={{ gap: 8 }}>
    <Field label="Maintenance date (YYYY-MM-DD)" value={value} onChangeText={onChange} editable={!disabled} maxLength={10} placeholder="YYYY-MM-DD" autoCorrect={false} />
    <Button title="Choose date" secondary disabled={disabled} onPress={() => { setMonth(new Date(`${(validPmsDate(value) ? value : localDate()).slice(0, 7)}-01T12:00:00`)); setOpen(true) }} />
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={{ flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#102B2480' }}>
        <Pressable style={{ position: 'absolute', inset: 0 }} accessibilityLabel="Close calendar" accessibilityRole="button" onPress={() => setOpen(false)} />
        <View accessibilityViewIsModal onAccessibilityEscape={() => setOpen(false)} style={[styles.card, { maxWidth: 420, width: '100%', alignSelf: 'center' }]}>
          <View style={[styles.row, { justifyContent: 'space-between' }]}>
            <Button title="‹" secondary disabled={month.getFullYear() === 1900 && month.getMonth() === 0} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1, 12))} />
            <Text style={styles.text}>{month.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</Text>
            <Button title="›" secondary disabled={month.getFullYear() === 9999 && month.getMonth() === 11} onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1, 12))} />
          </View>
          <View style={{ flexDirection: 'row' }}>{['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(day => <Text key={day} style={[styles.small, { width: '14.2857%', textAlign: 'center' }]}>{day}</Text>)}</View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>{Array.from({ length: Math.ceil((start + days) / 7) * 7 }, (_, index) => {
            const day = index - start + 1
            const date = localDate(new Date(month.getFullYear(), month.getMonth(), day, 12))
            return day < 1 || day > days ? <View key={index} style={{ width: '14.2857%', height: 44 }} /> :
              <Pressable key={index} accessibilityRole="button" accessibilityLabel={date} accessibilityState={{ selected: value === date }} onPress={() => { onChange(date); setOpen(false) }} style={{ width: '14.2857%', minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: value === date ? colors.green : 'transparent' }}><Text style={[styles.text, value === date && { color: '#FFF' }]}>{day}</Text></Pressable>
          })}</View>
          <Button title="Today" secondary onPress={() => { onChange(localDate()); setOpen(false) }} />
          <Button title="Close calendar" secondary onPress={() => setOpen(false)} />
        </View>
      </View>
    </Modal>
  </View>
}
