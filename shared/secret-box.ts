import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'

function deriveKey(password: string) {
  if (password.length < 32) throw new Error('Session password is too short to protect stored secrets')
  return scryptSync(password, 'nightlight-secret-box-v1', 32)
}

export function encryptSecret(plain: string, password: string) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', deriveKey(password), iv)
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()])
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':')
}

export function decryptSecret(stored: string, password: string) {
  const [version, iv, tag, data] = stored.split(':')
  if (version !== 'v1' || !iv || !tag || !data) throw new Error('Unsupported secret format')
  const decipher = createDecipheriv('aes-256-gcm', deriveKey(password), Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
}

export function maskSecret(value: string) {
  return value.length <= 12 ? '••••' : `${value.slice(0, 7)}…${value.slice(-4)}`
}
