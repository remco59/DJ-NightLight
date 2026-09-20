import { auditLogs } from '../../db/schema'
import { sanitizeOperationalMetadata } from './ops-log'
import { db } from './db'

export function sanitizeAuditMetadata(metadata: Record<string, unknown> | undefined) {
  if (!metadata) return undefined
  return sanitizeOperationalMetadata(metadata) as Record<string, unknown>
}

export async function recordAudit(input: {
  userId: string | null
  entityType: string
  entityId: string
  action: string
  metadata?: Record<string, unknown>
}) {
  await db.insert(auditLogs).values({
    userId: input.userId,
    entityType: input.entityType,
    entityId: input.entityId,
    action: input.action,
    metadata: sanitizeAuditMetadata(input.metadata),
  })
}
