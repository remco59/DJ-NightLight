import { z } from 'zod'

export const questionnaireFieldTypes = ['short_text', 'long_text', 'email', 'phone', 'number', 'date', 'time', 'select', 'multi_select', 'checkbox', 'acknowledgement', 'url'] as const
export type QuestionnaireFieldType = typeof questionnaireFieldTypes[number]
export type QuestionnaireField = {
  id: string
  type: QuestionnaireFieldType
  label: string
  helpText?: string
  required: boolean
  options?: string[]
}

export const questionnaireFieldSchema = z.object({
  id: z.string().trim().min(1).max(80).regex(/^[a-z0-9_]+$/),
  type: z.enum(questionnaireFieldTypes),
  label: z.string().trim().min(1).max(300),
  helpText: z.string().trim().max(500).optional(),
  required: z.boolean(),
  options: z.array(z.string().trim().min(1).max(160)).max(50).optional(),
}).superRefine((field, context) => {
  if ((field.type === 'select' || field.type === 'multi_select') && !field.options?.length) {
    context.addIssue({ code: 'custom', message: 'Select fields need at least one option', path: ['options'] })
  }
})

export const questionnaireTemplateInputSchema = z.object({
  name: z.string().trim().min(1).max(200),
  fields: z.array(questionnaireFieldSchema).max(80).superRefine((fields, context) => {
    const ids = new Set<string>()
    fields.forEach((field, index) => {
      if (ids.has(field.id)) context.addIssue({ code: 'custom', message: 'Field ids must be unique', path: [index, 'id'] })
      ids.add(field.id)
    })
  }),
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
  spotifyUrl: z.string().trim().max(1000).optional().default('').refine(isValidSpotifyUrl, 'Use a valid Spotify track or playlist URL'),
  note: z.string().trim().max(2000).optional().default(''),
  ordering: z.number().int().min(0).max(500),
}).refine(wish => Boolean(wish.artist || wish.title || wish.spotifyUrl || wish.note), 'A music wish cannot be empty')

function isEmpty(value: unknown) {
  return value === undefined || value === null || value === '' || (Array.isArray(value) && value.length === 0) || value === false
}

export function validateQuestionnaireAnswers(fields: QuestionnaireField[], answers: Record<string, unknown>) {
  const errors: Record<string, string> = {}
  for (const field of fields) {
    const value = answers[field.id]
    if (field.required && isEmpty(value)) {
      errors[field.id] = 'This field is required.'
      continue
    }
    if (isEmpty(value)) continue
    if (['short_text', 'long_text', 'email', 'phone', 'date', 'time', 'select', 'url'].includes(field.type) && typeof value !== 'string') errors[field.id] = 'Enter a valid value.'
    if (typeof value === 'string' && value.length > 10000) errors[field.id] = 'This answer is too long.'
    if (field.type === 'email' && !z.string().email().safeParse(value).success) errors[field.id] = 'Enter a valid email address.'
    if (field.type === 'url' && !z.string().url().safeParse(value).success) errors[field.id] = 'Enter a valid URL.'
    if (field.type === 'number' && (typeof value !== 'number' || !Number.isFinite(value))) errors[field.id] = 'Enter a valid number.'
    if (field.type === 'date' && (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))) errors[field.id] = 'Enter a valid date.'
    if (field.type === 'time' && (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value))) errors[field.id] = 'Enter a valid time.'
    if ((field.type === 'checkbox' || field.type === 'acknowledgement') && typeof value !== 'boolean') errors[field.id] = 'Choose yes or no.'
    if (field.type === 'select' && !field.options?.includes(String(value))) errors[field.id] = 'Choose one of the available options.'
    if (field.type === 'multi_select' && (!Array.isArray(value) || value.some(item => !field.options?.includes(String(item))))) errors[field.id] = 'Choose only available options.'
  }
  return errors
}
