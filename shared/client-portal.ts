import { z } from 'zod'
import { httpUrl } from './schemas/http-url'

const internalMediaUrlPattern = /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const optionalPortalImageUrl = z.preprocess(
  value => value ?? '',
  z.string().trim().max(2000),
).transform((value, ctx) => {
  if (!value) return null
  if (internalMediaUrlPattern.test(value) || httpUrl.safeParse(value).success) return value
  ctx.addIssue({ code: 'custom', message: 'Vul een geldige afbeeldings-URL in' })
  return z.NEVER
})

export const clientPortalImageInputSchema = z.object({
  imageUrl: optionalPortalImageUrl,
})

export type ClientPortalImageInput = z.infer<typeof clientPortalImageInputSchema>
