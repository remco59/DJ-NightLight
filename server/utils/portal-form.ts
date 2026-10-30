import { and, asc, desc, eq } from 'drizzle-orm'
import { contractSubmissions, gigForms, gigs, musicWishes, questionnaireTemplates, questionnaireTemplateVersions } from '../../db/schema'
import type { QuestionnaireField } from '../../shared/questionnaire'
import { db } from './db'

/** The active questionnaire from Instellingen: its newest version. */
export async function getActiveQuestionnaireVersion() {
  const [version] = await db.select({
    id: questionnaireTemplateVersions.id,
    templateId: questionnaireTemplateVersions.templateId,
    version: questionnaireTemplateVersions.version,
    fields: questionnaireTemplateVersions.fields,
  }).from(questionnaireTemplateVersions)
    .innerJoin(questionnaireTemplates, eq(questionnaireTemplateVersions.templateId, questionnaireTemplates.id))
    .where(and(eq(questionnaireTemplates.active, true)))
    .orderBy(desc(questionnaireTemplateVersions.version))
    .limit(1)
  return version ?? null
}

/**
 * The booking form of a gig. It is off unless the owner switched it on for this gig. The questions come from the
 * gig's own copy; a gig that used the form before copies existed keeps the questionnaire version it answered.
 */
export async function getPortalForm(gigId: string) {
  const [gig] = await db.select({ enabled: gigs.bookingFormEnabled }).from(gigs).where(eq(gigs.id, gigId)).limit(1)
  const enabled = gig?.enabled ?? false
  const [submission] = await db.select().from(contractSubmissions).where(eq(contractSubmissions.gigId, gigId)).limit(1)
  const [gigForm] = await db.select().from(gigForms).where(eq(gigForms.gigId, gigId)).limit(1)

  let fields: QuestionnaireField[] = []
  let templateVersionId: string | null = null
  let templateVersion: number | null = null
  if (gigForm) {
    fields = gigForm.fields
  }
  else if (enabled || submission) {
    const [pinned] = submission?.templateVersionId
      ? await db.select().from(questionnaireTemplateVersions).where(eq(questionnaireTemplateVersions.id, submission.templateVersionId)).limit(1)
      : []
    const version = pinned ?? await getActiveQuestionnaireVersion()
    if (!version) throw createError({ statusCode: 503, statusMessage: 'Er is geen actieve vragenlijst ingesteld' })
    fields = version.fields
    templateVersionId = version.id
    templateVersion = version.version
  }

  const wishes = await db.select().from(musicWishes).where(eq(musicWishes.gigId, gigId)).orderBy(asc(musicWishes.ordering))
  return { enabled, fields, gigForm: gigForm ?? null, templateVersionId, templateVersion, submission: submission ?? null, wishes }
}
