import { eq } from 'drizzle-orm'
import { gigForms } from '../../db/schema'
import { bookingFormTemplateFields, isReadyMadeTemplate, type BookingFormTemplateKey } from '../../shared/booking-form-templates'
import type { QuestionnaireField } from '../../shared/questionnaire'
import { db } from './db'
import { getActiveQuestionnaireVersion } from './portal-form'

/** The questions a template starts a gig with. `standaard` is the questionnaire from Instellingen. */
export async function templateFieldsFor(key: BookingFormTemplateKey): Promise<QuestionnaireField[]> {
  if (isReadyMadeTemplate(key)) return bookingFormTemplateFields(key)
  const version = await getActiveQuestionnaireVersion()
  if (!version) throw createError({ statusCode: 409, statusMessage: 'Er is geen actieve vragenlijst in Instellingen om van te kopiëren' })
  return structuredClone(version.fields)
}

/** Gives the gig its own copy of the questions, replacing an earlier one. */
export async function saveGigForm(gigId: string, templateKey: string, fields: QuestionnaireField[]) {
  const now = new Date()
  const [saved] = await db.insert(gigForms).values({ gigId, templateKey, fields })
    .onConflictDoUpdate({ target: gigForms.gigId, set: { templateKey, fields, updatedAt: now } }).returning()
  return saved!
}

export async function getGigForm(gigId: string) {
  const [form] = await db.select().from(gigForms).where(eq(gigForms.gigId, gigId)).limit(1)
  return form ?? null
}
