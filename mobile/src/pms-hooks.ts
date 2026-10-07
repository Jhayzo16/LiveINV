import { useCallback, useState } from 'react'
import { AppState } from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { PmsRepository } from './shared/pms'
import { useInventory } from './store'

export const pmsKeys = {
  sessions: (userId: string | null) => ['pms', userId, 'sessions'] as const,
  records: (userId: string | null, sessionId: string) => ['pms', userId, 'records', sessionId] as const,
}
export function usePmsActivity() {
  const [active, setActive] = useState(false)
  useFocusEffect(useCallback(() => {
    setActive(AppState.currentState === 'active')
    const subscription = AppState.addEventListener('change', state => setActive(state === 'active'))
    return () => { setActive(false); subscription.remove() }
  }, []))
  return active
}
export function usePmsSessions(active: boolean) {
  const { userId, online, status } = useInventory()
  return useQuery({ queryKey: pmsKeys.sessions(userId), queryFn: PmsRepository.sessions,
    enabled: active && online && status === 'ready', refetchInterval: active && online ? 15000 : false })
}
export function requirePmsConnection() {
  const state = useInventory.getState()
  if (state.status !== 'ready' || !state.userId) throw new Error('Sign in again to access PMS.')
  if (!state.online) throw new Error('Connect to the internet to save PMS records. This action has not been queued.')
}
