import { useState } from 'react'
import { Image, KeyboardAvoidingView, Platform, Text, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { actions, useInventory } from '../store'
import { configured } from '../supabase'
import { logo, fonts } from '../design'
import { Button, Card, Field, Notice, Page, styles, colors } from '../ui'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const state = useInventory()
  async function login() {
    if (!email.trim() || !password) { setError('Enter your email and password.'); return }
    setBusy(true); setError('')
    try { await actions.login(email, password) }
    catch (e) { setError(e instanceof Error ? e.message : 'Sign-in failed.') }
    finally { setBusy(false); setPassword('') }
  }
  return <SafeAreaView style={styles.page}><KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><Page>
    <View style={{ paddingTop: 10, gap: 6, paddingBottom: 12, alignItems: 'center' }}>
      <Image source={logo} accessibilityLabel="LiveINV logo" style={{ width: 160, height: 160 }} resizeMode="contain" />
      <Text style={{ fontSize: 32, fontFamily: fonts.heavy, color: colors.green, letterSpacing: -1.5 }}>Live<Text style={{ color: colors.red }}>INV</Text></Text>
      <Text style={[styles.eyebrow, { fontSize: 9 }]}>WALANG LABIS, WALANG KULANG.</Text>
      <Text style={[styles.subtitle, { textAlign: 'center', marginTop: 8 }]}>Tagum Global Medical Center</Text>
    </View>
    {!configured ? <Notice text="Mobile setup is required. Add your project's public Supabase URL and key to mobile/.env, then restart Expo. See mobile/README.md." /> :
      <Card><Text style={styles.heading}>Welcome back</Text><Text style={styles.subtitle}>Sign in to manage your hospital inventory.</Text>
        <Field label="Email address" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail} editable={!busy} />
        <Field label="Password" secureTextEntry autoCapitalize="none" autoComplete="current-password" value={password} onChangeText={setPassword} editable={!busy} onSubmitEditing={() => void login()} />
        {(error || state.error) && <Notice text={error || state.error || ''} error />}
        <Button title={busy ? 'Signing in…' : 'Sign in'} disabled={busy} onPress={() => void login()} />
        {state.status === 'locked' && <Button title="Retry saved session" secondary disabled={busy} onPress={() => void actions.restore()} />}
      </Card>}
    <Text style={[styles.small, { textAlign: 'center' }]}>LiveINV · Hospital Inventory Management</Text>
  </Page></KeyboardAvoidingView></SafeAreaView>
}
