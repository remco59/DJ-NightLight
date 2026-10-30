import { z } from 'zod'

export const questionnaireFieldTypes = ['short_text', 'long_text', 'email', 'phone', 'number', 'date', 'time', 'select', 'multi_select', 'checkbox', 'acknowledgement', 'url', 'timed_list'] as const
export type QuestionnaireFieldType = typeof questionnaireFieldTypes[number]
/** Shown only when the answer to another field matches: a chosen option, a ticked box, or an option among several. */
export type QuestionnaireShowIf = { fieldId: string, equals: string | boolean }
export type QuestionnaireField = {
  id: string
  type: QuestionnaireFieldType
  label: string
  helpText?: string
  required: boolean
  options?: string[]
  /** Fields with the same heading are shown together under it. */
  section?: string
  showIf?: QuestionnaireShowIf
}
/** One row of a `timed_list` answer: a moment and what should happen or be announced. */
export type TimedListRow = { time: string, text: string }
export type QuestionnaireAnswer = string | number | boolean | string[] | TimedListRow[]

export const questionnaireFieldSchema = z.object({
  id: z.string().trim().min(1).max(80).regex(/^[a-z0-9_]+$/),
  type: z.enum(questionnaireFieldTypes),
  label: z.string().trim().min(1).max(300),
  helpText: z.string().trim().max(500).optional(),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(160)).max(50).optional(),
  section: z.string().trim().max(120).optional(),
  showIf: z.object({
    fieldId: z.string().trim().min(1).max(80).regex(/^[a-z0-9_]+$/),
    equals: z.union([z.string().trim().min(1).max(160), z.boolean()]),
  }).optional(),
}).superRefine((field, context) => {
  if ((field.type === 'select' || field.type === 'multi_select') && !field.options?.length) {
    context.addIssue({ code: 'custom', message: 'Keuzevelden hebben minstens één optie nodig', path: ['options'] })
  }
})

/** Ids are unique, and a condition may only look at a field that comes earlier, so conditions can never loop. */
export function checkQuestionnaireFields(fields: QuestionnaireField[], context: z.RefinementCtx) {
  const ids = new Set<string>()
  fields.forEach((field, index) => {
    if (ids.has(field.id)) context.addIssue({ code: 'custom', message: 'Veld-ID’s moeten uniek zijn', path: [index, 'id'] })
    if (field.showIf && !ids.has(field.showIf.fieldId)) context.addIssue({ code: 'custom', message: `De voorwaarde bij “${field.label}” moet naar een eerdere vraag verwijzen`, path: [index, 'showIf'] })
    ids.add(field.id)
  })
}

export const questionnaireFieldsSchema = z.array(questionnaireFieldSchema).max(80).superRefine((fields, context) => checkQuestionnaireFields(fields as QuestionnaireField[], context))

export const questionnaireTemplateInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  fields: questionnaireFieldsSchema,
})

export const musicWishCategories = ['must_play', 'nice_to_have', 'do_not_play', 'special_moment'] as const
export type MusicWishInput = {
  category: typeof musicWishCategories[number]
  artist?: string
  title?: string
  spotifyUrl?: string
  note?: string
  ordering: number
}

export function isValidSpotifyUrl(value: string) {
  if (!value) return true
  try {
    const url = new URL(value)
    const [kind, id] = url.pathname.split('/').filter(Boolean)
    return url.protocol === 'https:' && url.hostname === 'open.spotify.com' && ['track', 'playlist'].includes(kind || '') && Boolean(id)
  } catch {
    return false
  }
}

export const musicWishSchema = z.object({
  category: z.enum(musicWishCategories),
  artist: z.string().trim().max(240).optional().default(''),
  title: z.string().trim().max(240).optional().default(''),
  spotifyUrl: z.string().trim().max(1000).optional().default('').refine(isValidSpotifyUrl, 'Gebruik een geldige Spotify-URL van een track of playlist'),
  note: z.string().trim().max(2000).optional().default(''),
  ordering: z.number().int().min(0).max(500),
}).refine(wish => Boolean(wish.artist || wish.title || wish.spotifyUrl || wish.note), 'Een muziekwens mag niet leeg zijn')

export const timedListRowSchema = z.object({ time: z.string().max(5), text: z.string().max(500) })

function isEmpty(value: unknown) {
  if (Array.isArray(value)) return value.every(item => typeof item === 'object' && item !== null ? !(item as TimedListRow).text?.trim() : false) || value.length === 0
  return value === undefined || value === null || value === '' || value === false
}

/** Whether a field is shown, given the answers so far. Without a condition it always is. */
export function fieldVisible(field: QuestionnaireField, answers: Record<string, unknown>) {
  if (!field.showIf) return true
  const answer = answers[field.showIf.fieldId]
  if (Array.isArray(answer)) return answer.includes(field.showIf.equals as never)
  return answer === field.showIf.equals
}

/**
 * Hidden fields count as not asked: they are never required and their answers are dropped.
 * A field hidden because the field it depends on is hidden stays hidden too, since fields are checked in order.
 */
export function visibleFields(fields: QuestionnaireField[], answers: Record<string, unknown>) {
  const shown: QuestionnaireField[] = []
  const shownIds = new Set<string>()
  for (const field of fields) {
    if (field.showIf && !shownIds.has(field.showIf.fieldId)) continue
    if (!fieldVisible(field, answers)) continue
    shown.push(field)
    shownIds.add(field.id)
  }
  return shown
}

export function validateQuestionnaireAnswers(allFields: QuestionnaireField[], answers: Record<string, unknown>) {
  const errors: Record<string, string> = {}
  for (const field of visibleFields(allFields, answers)) {
    const value = answers[field.id]
    if (field.required && isEmpty(value)) {
      errors[field.id] = 'Dit veld is verplicht.'
      continue
    }
    if (isEmpty(value)) continue
    if (['short_text', 'long_text', 'email', 'phone', 'date', 'time', 'select', 'url'].includes(field.type) && typeof value !== 'string') errors[field.id] = 'Vul een geldige waarde in.'
    if (typeof value === 'string' && value.length > 10000) errors[field.id] = 'Dit antwoord is te lang.'
    if (field.type === 'email' && !z.string().email().safeParse(value).success) errors[field.id] = 'Vul een geldig e-mailadres in.'
    if (field.type === 'url' && !z.string().url().safeParse(value).success) errors[field.id] = 'Vul een geldige URL in.'
    if (field.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) errors[field.id] = 'Vul een geldig getal in.'
    if (field.type === 'date' && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))) errors[field.id] = 'Vul een geldige datum in.'
    if (field.type === 'time' && (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value))) errors[field.id] = 'Vul een geldige tijd in.'
    if ((field.type === 'checkbox' || field.type === 'acknowledgement') && typeof value !== 'boolean') errors[field.id] = 'Kies ja of nee.'
    if (field.type === 'select' && !field.options?.includes(String(value))) errors[field.id] = 'Kies een van de beschikbare opties.'
    if (field.type === 'multi_select' && (!Array.isArray(value) || value.some(item => !field.options?.includes(String(item))))) errors[field.id] = 'Kies alleen beschikbare opties.'
    if (field.type === 'timed_list' && (!Array.isArray(value) || value.some(row => !timedListRowSchema.safeParse(row).success || (row.time && !/^\d{2}:\d{2}$/.test(row.time))))) errors[field.id] = 'Vul bij elke regel een geldige tijd en tekst in.'
  }
  return errors
}
