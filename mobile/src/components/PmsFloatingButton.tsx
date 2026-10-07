import { useEffect, useState } from 'react'
import { Keyboard, Pressable, Text } from 'react-native'
import { router, usePathname } from 'expo-router'
import { PmsIcon } from './PmsIcon'
import { colors } from '../ui'
import { fonts } from '../design'

export function PmsFloatingButton({ bottom }: { bottom: number }) {
  const pathname = usePathname()
  const [keyboard, setKeyboard] = useState(false)
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setKeyboard(true))
    const hide = Keyboard.addListener('keyboardDidHide', () => setKeyboard(false))
    return () => { show.remove(); hide.remove() }
  }, [])
  if (keyboard || pathname === '/scan') return null
  return <Pressable accessibilityRole="button" accessibilityLabel="Open PMS, Preventive Maintenance Service"
    onPress={() => router.navigate('/pms')} style={({ pressed }) => ({ position: 'absolute', right: 20, bottom,
      minHeight: 52, paddingHorizontal: 17, borderRadius: 28, flexDirection: 'row', alignItems: 'center', gap: 8,
      backgroundColor: colors.green, borderColor: '#DAE8D6', borderWidth: 1,
      boxShadow: '0 6px 18px #102b2433', elevation: 9, opacity: pressed ? 0.75 : 1 })}>
    <PmsIcon /><Text style={{ color: '#FFF', fontFamily: fonts.bold, fontSize: 12 }}>PMS</Text>
  </Pressable>
}
