// Browser preview data lasts for this tab's session. Native devices keep using
// encrypted SQLite and SecureStore through storage.ts.
const prefix = 'liveinv-mobile:'
export const storage = {
  async getItem(key: string): Promise<string | null> {
    if (typeof window === 'undefined') return null
    return window.sessionStorage.getItem(prefix + key)
  },
  async setItem(key: string, value: string): Promise<void> {
    if (typeof window === 'undefined') return
    window.sessionStorage.setItem(prefix + key, value)
  },
  async removeItem(key: string): Promise<void> {
    if (typeof window === 'undefined') return
    window.sessionStorage.removeItem(prefix + key)
  },
}
export async function readStored<T>(key: string): Promise<T | null> {
  const raw = await storage.getItem(key)
  return raw ? JSON.parse(raw) as T : null
}
