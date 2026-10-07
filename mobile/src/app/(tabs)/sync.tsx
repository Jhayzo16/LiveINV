import { useState } from 'react'
import { Alert, Text } from 'react-native'
import { actions, useInventory } from '../../store'
import { Button, Card, Notice, Page, styles } from '../../ui'

export default function Account() {
  const { email, pending, busy } = useInventory()
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
  return <Page><Text style={styles.title}>Account</Text>
    <Card><Text style={styles.heading}>Your account</Text><Text selectable style={styles.text}>{email}</Text><Text style={styles.subtitle}>Admin access · same account as the website</Text>
      <Button title={signingOut ? 'Signing out…' : 'Sign out'} secondary disabled={busy || signingOut} onPress={signOut} /></Card>
    {error && <Notice text={error} error />}
  </Page>
}
