import 'server-only'

import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function encryptionKey() {
  const secret = process.env.BETTER_AUTH_SECRET || process.env.NEON_AUTH_COOKIE_SECRET
  if (!secret || secret.length < 32) throw new Error('Payout encryption is not configured')
  return createHash('sha256').update(secret).digest()
}

export function encryptPayoutDestination(value: string) {
  const nonce = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), nonce)
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()])
  return `v1:${nonce.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${ciphertext.toString('base64url')}`
}

export function decryptPayoutDestination(value: string | null) {
  if (!value) return null
  const [version, nonceValue, tagValue, ciphertextValue] = value.split(':')
  if (version !== 'v1' || !nonceValue || !tagValue || !ciphertextValue) return null
  try {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(nonceValue, 'base64url'))
    decipher.setAuthTag(Buffer.from(tagValue, 'base64url'))
    return Buffer.concat([decipher.update(Buffer.from(ciphertextValue, 'base64url')), decipher.final()]).toString('utf8')
  } catch {
    return null
  }
}
