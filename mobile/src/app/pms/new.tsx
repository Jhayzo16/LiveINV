import { useEffect, useRef, useState } from 'react'
import { Text, View } from 'react-native'
import { router } from 'expo-router'
import { randomUUID } from 'expo-crypto'
import { useQueryClient } from '@tanstack/react-query'
import { PmsRepository, localDate, type PmsService, type PmsSession } from '../../shared/pms'
import { pmsSessionRequest, validPmsDate, type SessionRequest } from '../../pms'
import { pmsKeys, requirePmsConnection } from '../../pms-hooks'
import { useInventory } from '../../store'
import { Button, Card, Chip, Field, Notice, Page, styles } from '../../ui'
import { PmsDateField } from '../../components/PmsDateField'

export default function NewPms() {
  const [date, setDate] = useState(localDate)
  const [service, setService] = useState<PmsService>('Preventive maintenance')
  const [technician, setTechnician] = useState('')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const request = useRef<SessionRequest | null>(null)
  const busy = useRef(false)
  const mounted = useRef(true)
  const { userId, online } = useInventory()
  const client = useQueryClient()
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  async function create() {
    if (busy.current) return
    if (!validPmsDate(date) || !technician.trim()) { setError('Choose a valid maintenance date and enter the technician’s name.'); return }
    busy.current = true; setSaving(true); setError('')
    try {
      requirePmsConnection()
      request.current = pmsSessionRequest(request.current, { date, service, technician, notes }, randomUUID)
      const saved = await PmsRepository.create({ id: request.current.id, date, service, technician, notes })
      await client.cancelQueries({ queryKey: pmsKeys.sessions(userId) })
      client.setQueryData<PmsSession[]>(pmsKeys.sessions(userId), current => [saved, ...(current || []).filter(item => item.id !== saved.id)])
      void client.invalidateQueries({ queryKey: pmsKeys.sessions(userId) })
      if (mounted.current) router.replace({ pathname: '/pms/[id]', params: { id: saved.id } })
    } catch (cause) { if (mounted.current) setError(cause instanceof Error ? cause.message : 'Session could not be created. Please retry.') }
    finally { busy.current = false; if (mounted.current) setSaving(false) }
  }
  return <Page><Text style={styles.eyebrow}>NEW PMS SESSION</Text><Text style={styles.title}>Start a service session</Text>
    <Text style={styles.subtitle}>Choose the date the work is performed. Each scanned asset is recorded under this session.</Text>
    {!online && <Notice text="Connect to the internet to start and save a PMS session." />}
    <Card><PmsDateField value={date} onChange={setDate} disabled={saving} />
      <Text style={styles.label}>Service</Text><View style={styles.row}>{(['Preventive maintenance', 'General cleaning'] as const).map(item => <Chip key={item} label={item} selected={item === service} onPress={() => { if (!saving) setService(item) }} />)}</View>
      <Field label="IT personnel / technician" value={technician} onChangeText={setTechnician} maxLength={120} editable={!saving} placeholder="Person or team performing the work" />
      <Field label="Session notes (optional)" value={notes} onChangeText={setNotes} maxLength={2000} editable={!saving} multiline placeholder="e.g. Floor 2 workstation cleaning" />
    </Card>
    {error && <Notice text={error} error />}
    <Button title={saving ? 'Starting session…' : 'Start session'} disabled={saving || !online || !technician.trim() || !validPmsDate(date)} onPress={() => { void create() }} />
    <Button title="Cancel" secondary disabled={saving} onPress={() => router.back()} />
  </Page>
}
