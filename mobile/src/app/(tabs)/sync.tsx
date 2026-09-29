import { useState } from 'react'
import { Alert, Text, View } from 'react-native'
import { actions, useInventory } from '../../store'
import { Button, Card, Notice, Page, styles, SyncBanner } from '../../ui'

export default function Sync() {
  const { email, pending, busy, lastSync, online } = useInventory()
  const [error, setError] = useState('')
  const [signingOut, setSigningOut] = useState(false)
  function signOut() {
    Alert.alert('Sign out of LiveINV?', pending.length ? `This removes the saved inventory and ${pending.length} unsynced change(s) from this device. Sync first to keep those changes.` : 'The saved inventory will be removed from this device.', [
      { text: 'Cancel', style: 'cancel' }, { text: pending.length ? 'Discard & sign out' : 'Sign out', style: 'destructive', onPress: () => {
        setSigningOut(true)
        void actions.logout().catch(e => setError(e.message)).finally(() => setSigningOut(false))
      } },
    ])
  }
  return <Page><Text style={styles.title}>Keep everything in sync</Text><SyncBanner />
    <Card><Text style={styles.heading}>{online ? 'Connected' : 'Working offline'}</Text><Text style={styles.subtitle}>{lastSync ? `Last refreshed ${new Date(lastSync).toLocaleString()}` : 'This device has not downloaded the inventory yet.'}</Text>
      <Button title={busy ? 'Syncing…' : 'Sync now'} disabled={busy || signingOut} onPress={() => void actions.refresh()} /></Card>
    <Text style={styles.heading}>Pending changes · {pending.length}</Text>
    {!pending.length && <Text style={styles.subtitle}>No changes waiting to sync.</Text>}
    {pending.map(change => <Card key={change.id}><View style={styles.row}><Text style={styles.heading}>{change.tag}</Text><Text style={styles.small}>{change.status.toUpperCase()}</Text></View>
      <Text style={styles.small}>{new Date(change.createdAt).toLocaleString()}</Text>
      {Object.entries(change.patch).filter(([key]) => ['state', 'ip', 'location'].includes(key)).map(([key, value]) => <Text key={key} style={styles.text}>{key === 'state' ? 'Condition' : key === 'ip' ? 'IP address' : 'Room'}: {value}</Text>)}
      {change.message && <Notice text={change.message} error />}
      <Button title="Discard pending change" secondary disabled={busy || signingOut} onPress={() => Alert.alert('Discard this change?', 'The server record will remain as it is. Your unsynced edit will be removed.', [
        { text: 'Cancel', style: 'cancel' }, { text: 'Discard', style: 'destructive', onPress: () => { void actions.discard(change.id).catch(e => setError(e.message)) } },
      ])} /></Card>)}
    <Card><Text style={styles.heading}>Your account</Text><Text selectable style={styles.text}>{email}</Text><Text style={styles.subtitle}>Admin access · same account as the website</Text>
      <Text style={styles.small}>Inventory and pending updates are encrypted on this device. Reconnect within eight hours to renew offline access. Sync runs while the app is open.</Text>
      <Button title={signingOut ? 'Signing out…' : 'Sign out'} secondary disabled={busy || signingOut} onPress={signOut} /></Card>
    {error && <Notice text={error} error />}
  </Page>
}
