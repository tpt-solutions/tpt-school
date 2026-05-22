import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const ENC_PREFIX = 'enc:'

function getDerivedKey(): Buffer {
  const secret = process.env.AUTH_SECRET ?? 'insecure-dev-secret-replace-in-prod'
  // Derive a stable 32-byte key from the secret
  return scryptSync(secret, 'tpt-school-enc-salt', 32)
}

export function encrypt(plaintext: string): string {
  if (!plaintext) return plaintext
  const key = getDerivedKey()
  const iv = randomBytes(12)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  // Store as: enc:<iv_hex>:<tag_hex>:<ciphertext_hex>
  return ENC_PREFIX + [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

export function decrypt(value: string): string {
  if (!value || !value.startsWith(ENC_PREFIX)) return value
  const key = getDerivedKey()
  const parts = value.slice(ENC_PREFIX.length).split(':')
  if (parts.length !== 3) return value
  const [ivHex, tagHex, ctHex] = parts
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const ciphertext = Buffer.from(ctHex, 'hex')
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return decipher.update(ciphertext).toString('utf8') + decipher.final('utf8')
}

export function isEncrypted(value: string | null | undefined): boolean {
  return typeof value === 'string' && value.startsWith(ENC_PREFIX)
}
