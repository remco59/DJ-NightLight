import { and, eq, sql } from 'drizzle-orm'
import { auditLogs, gigs } from '../../../../../db/schema'
import { appendNote, formatOfflineNote } from '../../../../../shared/offline-note'
import { offlineChangeSchema } from '../../../../../shared/schemas/offline-change'
import { recordAudit } from '../../../../utils/audit'
import { queueCalendarSync } from '../../../../utils/calendar-sync'
import { db } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/require-staff'
import { requireUuidParam } from '../../../../utils/route-params'

// Applies one change that was made offline (a note or a status change). Safe to
// retry: a change that was already applied answers `applied: false`.
// A status change is only applied when the gig still has the status the device
// saw; otherwise it answers 409 and nothing changes. It never emails the client.
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const id = requireUuidParam(event, 'id')
  const change = await readValidatedBody(event, offlineChangeSchema.parse)

  const [duplicate] = await db.select({ id: auditLogs.id }).from(auditLogs).where(and(
    eq(auditLogs.entityType, 'gig'),
    eq(auditLogs.entityId, id),
    sql`${auditLogs.metadata}->>'changeId' = ${change.changeId}`,
  )).limit(1)
  if (duplicate) return { applied: false }

  const madeAt = new Date(Math.min(new Date(change.createdAt).getTime(), Date.now()))

  const result = await db.transaction(async (tx) => {
    const [gig] = await tx.select({ id: gigs.id, status: gigs.status, internalNotes: gigs.internalNotes })
      .from(gigs).where(eq(gigs.id, id)).limit(1).for('update')
    if (!gig) throw createError({ statusCode: 404, statusMessage: 'Gig niet gevonden' })

    if (change.kind === 'note') {
      const note = formatOfflineNote(change.text, user.name, madeAt)
      await tx.update(gigs).set({ internalNotes: appendNote(gig.internalNotes, note), updatedAt: new Date() }).where(eq(gigs.id, id))
      return { action: 'offline_note_added', metadata: {}, calendar: false }
    }

    if (gig.status !== change.expectedStatus) {
      throw createError({ statusCode: 409, statusMessage: 'De status van deze gig is ondertussen gewijzigd. Controleer de gig en pas de status zo nodig opnieuw aan.' })
    }
    await tx.update(gigs).set({ status: change.status, updatedAt: new Date() }).where(eq(gigs.id, id))
    return { action: 'status_changed', metadata: { status: change.status, from: gig.status, to: change.status, offline: true }, calendar: true }
  })

  await recordAudit({
    userId: user.id,
    entityType: 'gig',
    entityId: id,
    action: result.action,
    metadata: { ...result.metadata, changeId: change.changeId, madeAt: madeAt.toISOString() },
  })
  if (result.calendar) await queueCalendarSync(id)
  return { applied: true }
})
