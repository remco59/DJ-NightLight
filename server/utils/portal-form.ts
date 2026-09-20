import { and, asc, desc, eq } from 'drizzle-orm'
import { contractSubmissions, musicWishes, questionnaireTemplates, questionnaireTemplateVersions } from '../../db/schema'
import { db } from './db'

export async function getPortalForm(gigId: string) {
  const [submission] = await db.select().from(contractSubmissions).where(eq(contractSubmissions.gigId, gigId)).limit(1)

  const [version] = submission
    ? await db.select().from(questionnaireTemplateVersions).where(eq(questionnaireTemplateVersions.id, submission.templateVersionId)).limit(1)
    : await db.select({
        id: questionnaireTemplateVersions.id,
        templateId: questionnaireTemplateVersions.templateId,
        version: questionnaireTemplateVersions.version,
        fields: questionnaireTemplateVersions.fields,
        createdByUserId: questionnaireTemplateVersions.createdByUserId,
        createdAt: questionnaireTemplateVersions.createdAt,
      }).from(questionnaireTemplateVersions)
        .innerJoin(questionnaireTemplates, eq(questionnaireTemplateVersions.templateId, questionnaireTemplates.id))
        .where(and(eq(questionnaireTemplates.active, true)))
        .orderBy(desc(questionnaireTemplateVersions.version))
        .limit(1)

  if (!version) throw createError({ statusCode: 503, statusMessage: 'No active questionnaire is configured' })
  const wishes = await db.select().from(musicWishes).where(eq(musicWishes.gigId, gigId)).orderBy(asc(musicWishes.ordering))
  return { version, submission: submission ?? null, wishes }
}
