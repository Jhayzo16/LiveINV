import { useRef, useState, useCallback } from 'react'
import { AppState, Linking, Text, View } from 'react-native'
import { useFocusEffect, router } from 'expo-router'
import { CameraView, useCameraPermissions } from 'expo-camera'
import { useInventory } from '../../store'
import { findAsset } from '../../domain'
import { Button, Card, Field, Notice, Page, styles } from '../../ui'

export default function Scan() {
  const [permission, requestPermission] = useCameraPermissions()
  const [focused, setFocused] = useState(false)
  const [active, setActive] = useState(AppState.currentState === 'active')
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [paused, setPaused] = useState(false)
  const locked = useRef(false)
  const rows = useInventory(state => state.rows)
  useFocusEffect(useCallback(() => {
    setFocused(true); setActive(AppState.currentState === 'active'); locked.current = false; setPaused(false)
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'))
    return () => { setFocused(false); subscription.remove() }
  }, []))
  function lookup(value: string, method: 'qr' | 'manual') {
    if (locked.current) return
    locked.current = true; setPaused(true); setError('')
    const row = findAsset(rows, value)
    if (row) router.push({ pathname: '/asset/[id]', params: { id: row.id, method } })
    else setError('No matching equipment in the downloaded inventory. Check the code or refresh inventory from Home.')
  }
  return <Page><Text style={styles.title}>Scan. Verify. Update.</Text><Text style={styles.subtitle}>Point your camera at a LiveINV QR label.</Text>
    {permission?.granted ? <View style={{ height: 300, borderRadius: 22, overflow: 'hidden', backgroundColor: '#182C25' }}>
      {focused && active && !paused && <CameraView style={{ flex: 1 }} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={({ data }) => lookup(data, 'qr')} onMountError={() => { setPaused(true); setError('Camera unavailable. Use manual lookup or retry the camera.'); }} />}
      {paused && <View style={{ padding: 30 }}><Text style={{ color: '#FFF' }}>Camera paused</Text></View>}
    </View> : <Card><Text style={styles.subtitle}>Allow camera access to scan labels, or enter an asset number below.</Text>
      <Button title={permission?.canAskAgain === false ? 'Open camera settings' : 'Allow camera access'} onPress={() => { if (permission?.canAskAgain === false) void Linking.openSettings(); else void requestPermission() }} /></Card>}
    {error && <Notice text={error} error />}
    {paused && <Button title="Scan another label" secondary onPress={() => { locked.current = false; setPaused(false); setError('') }} />}
    <Card><Text style={styles.heading}>Enter a number instead</Text><Field label="QR number or asset tag" value={code} onChangeText={value => { setCode(value); locked.current = false }} autoCapitalize="characters" autoCorrect={false} placeholder="LIV-… or PC-…" />
      <Button title="Find equipment" disabled={!code.trim()} onPress={() => { locked.current = false; lookup(code, 'manual') }} /></Card>
  </Page>
}
