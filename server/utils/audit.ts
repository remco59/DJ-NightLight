import { auditLogs } from '../../db/schema'
import { db } from './db'

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
    metadata: input.metadata,
  })
}
