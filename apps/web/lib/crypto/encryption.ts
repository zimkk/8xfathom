const ALGORITHM = 'AES-GCM'
const KEY_LENGTH = 256
const VERSION = 'v1'

function getKey(): Promise<CryptoKey> {
  const base64Key = process.env['APP_ENCRYPTION_KEY']
  if (!base64Key) throw new Error('APP_ENCRYPTION_KEY is not set')

  const keyBytes = Buffer.from(base64Key, 'base64')
  if (keyBytes.length !== 32) {
    throw new Error('APP_ENCRYPTION_KEY must be 32 bytes (256 bits), base64-encoded')
  }

  return crypto.subtle.importKey('raw', keyBytes, { name: ALGORITHM, length: KEY_LENGTH }, false, [
    'encrypt',
    'decrypt',
  ])
}

export async function encrypt(plaintext: string): Promise<string> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const encoded = new TextEncoder().encode(plaintext)

  const ciphertext = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoded)

  const ivB64 = Buffer.from(iv).toString('base64')
  const ctB64 = Buffer.from(ciphertext).toString('base64')
  return `${VERSION}:${ivB64}:${ctB64}`
}

export async function decrypt(encrypted: string): Promise<string> {
  const parts = encrypted.split(':')
  if (parts.length !== 3 || parts[0] !== VERSION) {
    throw new Error('Invalid encrypted value format')
  }

  const [, ivB64, ctB64] = parts as [string, string, string]
  const iv = Buffer.from(ivB64, 'base64')
  const ciphertext = Buffer.from(ctB64, 'base64')
  const key = await getKey()

  const plaintext = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ciphertext)
  return new TextDecoder().decode(plaintext)
}

export function hashToken(token: string): string {
  const { createHash } = require('crypto') as typeof import('crypto')
  return createHash('sha256').update(token).digest('hex')
}

export function generateToken(bytes = 32): string {
  return Buffer.from(crypto.getRandomValues(new Uint8Array(bytes))).toString('base64url')
}
