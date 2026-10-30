import { eq } from 'drizzle-orm'
import { termsVersions } from '../../../../db/schema'
import { recordAudit } from '../../../utils/audit'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

/** Publishes the draft. From then on it is the version clients accept, and it can no longer be edited. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const now = new Date()
  const [published] = await db.update(termsVersions)
    .set({ status: 'published', publishedAt: now, updatedAt: now })
    .where(eq(termsVersions.status, 'draft')).returning()
  if (!published) throw createError({ statusCode: 409, statusMessage: 'Er is geen concept om te publiceren' })
  await recordAudit({ userId: user.id, entityType: 'terms', entityId: published.id, action: 'terms_published', metadata: { version: published.version } })
  return { version: published }
})
