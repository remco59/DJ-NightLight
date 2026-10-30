import { desc, eq } from 'drizzle-orm'
import { termsVersions } from '../../../../db/schema'
import { termsInputSchema } from '../../../../shared/terms'
import { recordAudit } from '../../../utils/audit'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

/** Saves the draft. Without one, a new draft starts as the next version. A published version is never changed. */
export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const parsed = termsInputSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Ongeldige voorwaarden' })

  const saved = await db.transaction(async (tx) => {
    const [draft] = await tx.select().from(termsVersions).where(eq(termsVersions.status, 'draft')).limit(1)
    if (draft) {
      const [updated] = await tx.update(termsVersions).set({ ...parsed.data, updatedAt: new Date() }).where(eq(termsVersions.id, draft.id)).returning()
      return updated
    }
    const [latest] = await tx.select({ version: termsVersions.version }).from(termsVersions).orderBy(desc(termsVersions.version)).limit(1)
    const [created] = await tx.insert(termsVersions).values({ ...parsed.data, version: (latest?.version || 0) + 1, status: 'draft', createdByUserId: user.id }).returning()
    return created
  })
  if (!saved) throw createError({ statusCode: 500, statusMessage: 'Voorwaarden opslaan is niet gelukt' })
  await recordAudit({ userId: user.id, entityType: 'terms', entityId: saved.id, action: 'terms_draft_saved', metadata: { version: saved.version } })
  return { version: saved }
})
