import { desc, eq } from 'drizzle-orm'
import { questionnaireTemplates, questionnaireTemplateVersions } from '../../../db/schema'
import { db } from '../../utils/db'
import { requireStaff } from '../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const [current] = await db.select({
    templateId: questionnaireTemplates.id,
    name: questionnaireTemplates.name,
    versionId: questionnaireTemplateVersions.id,
    version: questionnaireTemplateVersions.version,
    fields: questionnaireTemplateVersions.fields,
    createdAt: questionnaireTemplateVersions.createdAt,
  }).from(questionnaireTemplates)
    .innerJoin(questionnaireTemplateVersions, eq(questionnaireTemplateVersions.templateId, questionnaireTemplates.id))
    .where(eq(questionnaireTemplates.active, true))
    .orderBy(desc(questionnaireTemplateVersions.version))
    .limit(1)
  if (!current) throw createError({ statusCode: 404, statusMessage: 'No active questionnaire found' })
  return { template: current }
})
