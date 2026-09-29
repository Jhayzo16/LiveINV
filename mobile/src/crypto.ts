import { gcm } from '@noble/ciphers/aes.js'
import { bytesToHex, hexToBytes, utf8ToBytes, bytesToUtf8 } from '@noble/ciphers/utils.js'

// AAD binds a ciphertext to its user-scoped record key, preventing record swapping.
export function seal(key: Uint8Array, nonce: Uint8Array, recordKey: string, value: string) {
  const ciphertext = gcm(key, nonce, utf8ToBytes(recordKey)).encrypt(utf8ToBytes(value))
  return `${bytesToHex(nonce)}:${bytesToHex(ciphertext)}`
}
export function unseal(key: Uint8Array, recordKey: string, payload: string) {
  const [nonce, ciphertext] = payload.split(':')
  return bytesToUtf8(gcm(key, hexToBytes(nonce), utf8ToBytes(recordKey)).decrypt(hexToBytes(ciphertext)))
}
