import { Pressable, StyleSheet, type ColorValue } from 'react-native'
import Ionicons from '@expo/vector-icons/Ionicons'
import { fonts } from '../design'

export const headerTitleStyle = { fontFamily: fonts.title, fontSize: 15, fontWeight: 'normal' as const }

export function HeaderBackButton({ onPress, color, label = 'Go back', disabled = false }: {
  onPress: () => void
  color: ColorValue
  label?: string
  disabled?: boolean
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => [styles.button, { opacity: disabled ? 0.4 : pressed ? 0.65 : 1 }]}>
    <Ionicons name="chevron-back" size={23} color={color} />
  </Pressable>
}

const styles = StyleSheet.create({
  button: { width: 44, height: 44, alignItems: 'flex-start', justifyContent: 'center' },
})
