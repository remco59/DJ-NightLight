import { desc, eq } from 'drizzle-orm'
import { auditLogs, questionnaireTemplates, questionnaireTemplateVersions } from '../../../db/schema'
import { questionnaireTemplateInputSchema } from '../../../shared/questionnaire'
import { db } from '../../utils/db'
import { requireStaff } from '../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event, ['owner', 'manager'])
  const parsed = questionnaireTemplateInputSchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Ongeldige vragenlijst' })

  const [template] = await db.select().from(questionnaireTemplates).where(eq(questionnaireTemplates.active, true)).limit(1)
  if (!template) throw createError({ statusCode: 404, statusMessage: 'Geen actieve vragenlijst gevonden' })
  const [latest] = await db.select({ version: questionnaireTemplateVersions.version }).from(questionnaireTemplateVersions)
    .where(eq(questionnaireTemplateVersions.templateId, template.id)).orderBy(desc(questionnaireTemplateVersions.version)).limit(1)
  const nextVersion = (latest?.version || 0) + 1

  const version = await db.transaction(async (tx) => {
    await tx.update(questionnaireTemplates).set({ name: parsed.data.name, updatedAt: new Date() }).where(eq(questionnaireTemplates.id, template.id))
    const [created] = await tx.insert(questionnaireTemplateVersions).values({
      templateId: template.id,
      version: nextVersion,
      fields: parsed.data.fields,
      createdByUserId: user.id,
    }).returning()
    if (!created) throw createError({ statusCode: 500, statusMessage: 'Nieuwe versie van de vragenlijst opslaan is niet gelukt' })
    await tx.insert(auditLogs).values({
      userId: user.id,
      entityType: 'questionnaire_template',
      entityId: template.id,
      action: 'questionnaire_version_created',
      metadata: { version: nextVersion, fieldCount: parsed.data.fields.length },
    })
    return created
  })
  return { template: { ...version, name: parsed.data.name } }
})
