import * as SQLite from 'expo-sqlite'
import * as SecureStore from 'expo-secure-store'
import * as Crypto from 'expo-crypto'
import { bytesToHex, hexToBytes } from '@noble/ciphers/utils.js'
import { seal, unseal } from './crypto'

let ready: Promise<{ db: SQLite.SQLiteDatabase; key: Uint8Array }> | undefined
async function open() {
  if (!ready) ready = (async () => {
    let hex = await SecureStore.getItemAsync('liveinv-storage-key')
    if (!hex) {
      hex = bytesToHex(await Crypto.getRandomBytesAsync(32))
      await SecureStore.setItemAsync('liveinv-storage-key', hex, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY })
    }
    const db = await SQLite.openDatabaseAsync('liveinv-encrypted.db')
    await db.execAsync('PRAGMA journal_mode = WAL; CREATE TABLE IF NOT EXISTS records (key TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL);')
    return { db, key: hexToBytes(hex) }
  })().catch(error => { ready = undefined; throw error })
  return ready
}
export const storage = {
  async getItem(recordKey: string) {
    const { db, key } = await open()
    const row = await db.getFirstAsync<{ payload: string }>('SELECT payload FROM records WHERE key = ?', recordKey)
    return row ? unseal(key, recordKey, row.payload) : null
  },
  async setItem(recordKey: string, value: string) {
    const { db, key } = await open()
    const payload = seal(key, await Crypto.getRandomBytesAsync(12), recordKey, value)
    await db.runAsync('INSERT OR REPLACE INTO records (key, payload) VALUES (?, ?)', recordKey, payload)
  },
  async removeItem(recordKey: string) {
    const { db } = await open()
    await db.runAsync('DELETE FROM records WHERE key = ?', recordKey)
  },
}
export async function readStored<T>(key: string): Promise<T | null> {
  const raw = await storage.getItem(key)
  return raw ? JSON.parse(raw) as T : null
}
