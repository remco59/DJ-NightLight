import { operationsEvents } from '../../db/schema'
import { db } from './db'

const SENSITIVE_KEY = /(password|secret|token|authorization|cookie|credential|api[-_]?key)/i

export function sanitizeOperationalMetadata(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sanitizeOperationalMetadata)
  if (!value || typeof value !== 'object') return value
  const input = value as Record<string, unknown>
  return Object.fromEntries(Object.entries(input).map(([key, item]) => [
    key,
    SENSITIVE_KEY.test(key) ? '[REDACTED]' : sanitizeOperationalMetadata(item),
  ]))
}

export function structuredLog(level: 'info' | 'warn' | 'error', event: string, data: Record<string, unknown> = {}) {
  const payload = {
    level,
    event,
    timestamp: new Date().toISOString(),
    ...sanitizeOperationalMetadata(data) as Record<string, unknown>,
  }
  const line = JSON.stringify(payload)
  if (level === 'error') console.error(line)
  else if (level === 'warn') console.warn(line)
  else console.info(line)
}

export async function recordOperationalEvent(input: {
  kind: string
  status: string
  message?: string | null
  metadata?: Record<string, unknown>
}) {
  await db.insert(operationsEvents).values({
    kind: input.kind,
    status: input.status,
    message: input.message?.slice(0, 2000) || null,
    metadata: sanitizeOperationalMetadata(input.metadata || {}) as Record<string, unknown>,
  })
}
