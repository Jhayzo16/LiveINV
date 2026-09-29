import { Image, Text, View } from 'react-native'
import { logo, fonts } from '../design'
import { colors } from '../ui'
export function Brand({ large = false }: { large?: boolean }) {
  return <View accessibilityLabel="LiveINV, Tagum Global Medical Center" style={{ flexDirection: 'row', alignItems: 'center', gap: large ? 12 : 8 }}>
    <Image source={logo} accessibilityLabel="LiveINV logo" resizeMode="contain" style={{ width: large ? 108 : 52, height: large ? 108 : 52 }} />
    <View><Text style={{ fontFamily: fonts.heavy, fontSize: large ? 30 : 21, color: colors.green, letterSpacing: -1.2 }}>Live<Text style={{ color: colors.red }}>INV</Text></Text>
      <Text style={{ fontFamily: fonts.medium, fontSize: large ? 10 : 8, color: colors.muted, letterSpacing: large ? 1 : 0.3 }}>{large ? 'WALANG LABIS, WALANG KULANG.' : 'HOSPITAL INVENTORY'}</Text></View>
  </View>
}
