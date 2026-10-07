import { Pressable, Text } from 'react-native'
import { fonts } from '../design'
import { nightMap } from '../floor-plan-theme'

export function MapButton({ title, label = title, selected = false, disabled = false, onPress }: {
  title: string; label?: string; selected?: boolean; disabled?: boolean; onPress: () => void
}) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label}
    accessibilityState={{ selected, disabled }} disabled={disabled} onPress={onPress}
    style={({ pressed }) => ({ minHeight: 44, minWidth: 44, paddingHorizontal: 13, paddingVertical: 10,
      borderRadius: 16, borderWidth: 1, borderColor: selected ? nightMap.accent : nightMap.border,
      backgroundColor: selected ? nightMap.accent : nightMap.button,
      alignItems: 'center', justifyContent: 'center', opacity: disabled ? 0.4 : pressed ? 0.7 : 1 })}>
    <Text style={{ fontSize: 11, fontFamily: fonts.bold, color: selected ? nightMap.background : nightMap.text }}>{title}</Text>
  </Pressable>
}
