import { createClient } from '@supabase/supabase-js'
import { storage } from './storage'
import { fetchWithTimeout } from './network'

const url = process.env.EXPO_PUBLIC_SUPABASE_URL
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
export const configured = Boolean(url && key && !url.includes('your-project'))
export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder', {
  global: { fetch: fetchWithTimeout },
  auth: { storage, persistSession: true, autoRefreshToken: true, detectSessionInUrl: false },
})
export class AccessDeniedError extends Error {}
export async function verifyAdmin(expectedUserId: string) {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error?.status === 401 || error?.status === 403 || (!error && user?.id !== expectedUserId)) throw new AccessDeniedError('Your session is no longer authorized. Sign in again.')
  if (error || user?.id !== expectedUserId) throw new Error('Connect and sign in again to verify your access.')
  const { data, error: roleError } = await supabase.from('admin_users').select('user_id').eq('user_id', user.id).maybeSingle()
  if (roleError) throw new Error('Unable to verify access. Check your connection and retry.')
  if (!data) throw new AccessDeniedError('This account is not approved to use LiveINV.')
  return user
}
