import { useEffect } from 'react'
import { AppState, ActivityIndicator, View } from 'react-native'
import { Stack, usePathname } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import { QueryClientProvider } from '@tanstack/react-query'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import NetInfo from '@react-native-community/netinfo'
import { actions, queryClient, useInventory } from '../store'
import { configured, supabase } from '../supabase'
import { colors } from '../ui'
import { HeaderBackButton, headerTitleStyle } from '../components/HeaderBackButton'
import { useFonts } from 'expo-font'
import { PlusJakartaSans_400Regular } from '@expo-google-fonts/plus-jakarta-sans/400Regular'
import { PlusJakartaSans_500Medium } from '@expo-google-fonts/plus-jakarta-sans/500Medium'
import { PlusJakartaSans_700Bold } from '@expo-google-fonts/plus-jakarta-sans/700Bold'
import { Montserrat_700Bold } from '@expo-google-fonts/montserrat/700Bold'
import { Montserrat_800ExtraBold } from '@expo-google-fonts/montserrat/800ExtraBold'

export default function RootLayout() {
  const { status, userId } = useInventory()
  const pathname = usePathname()
  const [fontsLoaded, fontError] = useFonts({ Jakarta: PlusJakartaSans_400Regular, JakartaMedium: PlusJakartaSans_500Medium, JakartaBold: PlusJakartaSans_700Bold, MontserratBold: Montserrat_700Bold, MontserratExtraBold: Montserrat_800ExtraBold })
  useEffect(() => {
    if (configured) void actions.restore()
    else useInventory.setState({ status: 'signedOut' })
    const net = NetInfo.addEventListener(state => {
      const online = state.isConnected !== false && state.isInternetReachable !== false
      const previous = useInventory.getState().online
      useInventory.setState({ online })
      if (online && !previous) void actions.refresh()
    })
    const app = AppState.addEventListener('change', state => {
      if (state === 'active') { supabase.auth.startAutoRefresh(); void actions.refresh() }
      else supabase.auth.stopAutoRefresh()
    })
    const timer = setInterval(() => {
      const state = useInventory.getState()
      if (state.status === 'ready' && Date.now() - state.authorizedAt > 8 * 60 * 60 * 1000) {
        useInventory.setState({ status: 'locked', error: 'Connect to renew your access. Your pending changes are saved on this device.' })
      }
    }, 30_000)
    return () => { net(); app.remove(); clearInterval(timer); supabase.auth.stopAutoRefresh() }
  }, [])
  useEffect(() => {
    if (!userId || status !== 'ready') return
    const channel = supabase.channel(`mobile-assets-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'assets' }, () => { void actions.refresh() }).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [userId, status])
  // Keep status-bar ownership here: native Stack statusBarStyle requires an iOS
  // Info.plist setting that cannot be changed inside the installed Expo Go app.
  const darkHeader = status === 'ready' && (fontsLoaded || Boolean(fontError)) && pathname.startsWith('/asset/')
  return <SafeAreaProvider><QueryClientProvider client={queryClient}><StatusBar style={darkHeader ? 'light' : 'dark'} />
    {status === 'loading' || (!fontsLoaded && !fontError) ? <View style={{ flex: 1, justifyContent: 'center', backgroundColor: colors.paper }}><ActivityIndicator color={colors.green} size="large" /></View> :
      <Stack screenOptions={({ navigation }) => ({
        headerBackButtonDisplayMode: 'minimal',
        headerBackVisible: false,
        headerTitleAlign: 'center',
        headerTitleStyle,
        headerLeft: ({ tintColor, canGoBack }) => canGoBack
          ? <HeaderBackButton color={tintColor ?? colors.green} onPress={() => navigation.goBack()} /> : null,
        // Keep the chevron plain on iOS 26 too, without its automatic glass capsule.
        unstable_headerLeftItems: ({ tintColor, canGoBack }) => canGoBack ? [{
          type: 'custom', hidesSharedBackground: true,
          element: <HeaderBackButton color={tintColor ?? colors.green} onPress={() => navigation.goBack()} />,
        }] : [],
        headerTintColor: colors.green,
        headerStyle: { backgroundColor: colors.paper },
        contentStyle: { backgroundColor: colors.paper },
      })}>
        <Stack.Protected guard={status === 'ready'}>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="asset/[id]" options={{ title: 'Equipment record' }} />
          <Stack.Screen name="asset/new" options={{ title: 'Add device' }} />
          <Stack.Screen name="asset/edit/[id]" options={{ title: 'Edit device' }} />
          <Stack.Screen name="pms/index" options={{ title: 'Preventive maintenance' }} />
          <Stack.Screen name="pms/new" options={{ title: 'New PMS session' }} />
          <Stack.Screen name="pms/[id]" options={{ title: 'PMS session' }} />
        </Stack.Protected>
        <Stack.Protected guard={status !== 'ready'}><Stack.Screen name="login" options={{ headerShown: false }} /></Stack.Protected>
      </Stack>}
  </QueryClientProvider></SafeAreaProvider>
}
