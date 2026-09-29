import { Tabs } from 'expo-router'
import Ionicons from '@expo/vector-icons/Ionicons'
import { colors } from '../../ui'
import { Brand } from '../../components/Brand'
import { fonts } from '../../design'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FLOATING_TAB_HEIGHT, TabContentInset } from '../../navigation-spacing'
const icons = { index: 'grid-outline', assets: 'cube-outline', maps: 'business-outline', scan: 'qr-code-outline', sync: 'sync-outline' } as const
export default function TabLayout() {
  const insets = useSafeAreaInsets()
  const bottom = Math.max(insets.bottom, 12)
  return <TabContentInset.Provider value={FLOATING_TAB_HEIGHT + bottom + 20}><Tabs safeAreaInsets={{ bottom: 0 }} screenOptions={({ route }) => ({ headerStyle: { backgroundColor: '#FFFFFF' }, headerTitle: () => <Brand />, headerTitleAlign: 'left', headerShadowVisible: false,
    tabBarActiveTintColor: colors.red, tabBarInactiveTintColor: '#53605A',
    tabBarHideOnKeyboard: true, tabBarLabelPosition: 'below-icon',
    tabBarActiveBackgroundColor: '#F2E5E5', tabBarInactiveBackgroundColor: 'transparent',
    tabBarStyle: {
      position: 'absolute', start: 16, end: 16, bottom,
      height: FLOATING_TAB_HEIGHT, paddingTop: 5, paddingBottom: 5, paddingHorizontal: 5,
      borderRadius: 36, borderWidth: 2, borderTopWidth: 2, borderColor: '#FFFFFF', borderTopColor: '#FFFFFF',
      backgroundColor: '#F8FBFAF5', boxShadow: '0 8px 28px #17282e26', elevation: 8,
    },
    tabBarItemStyle: { borderRadius: 27, overflow: 'hidden', marginHorizontal: 1 },
    tabBarLabelStyle: { fontSize: 10, lineHeight: 14, fontFamily: fonts.bold, marginBottom: 1 },
    tabBarIcon: ({ color }) => <Ionicons name={icons[route.name as keyof typeof icons]} color={color} size={21} /> })}>
    <Tabs.Screen name="index" options={{ title: 'Dashboard', tabBarLabel: 'Home' }} />
    <Tabs.Screen name="assets" options={{ title: 'Asset registry', tabBarLabel: 'Assets' }} />
    <Tabs.Screen name="maps" options={{ title: 'Live mapping', tabBarLabel: 'Live Map' }} />
    <Tabs.Screen name="scan" options={{ title: 'QR scanner', tabBarLabel: 'Scan' }} />
    <Tabs.Screen name="sync" options={{ title: 'Sync & account', tabBarLabel: 'Account' }} />
  </Tabs></TabContentInset.Provider>
}
