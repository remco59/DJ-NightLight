import { z } from 'zod'

const internalMediaUrlPattern = /^\/api\/media\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const emailHeroImageUrlSchema = z.preprocess(
  value => value ?? '',
  z.string().trim().max(2000),
).transform((value, ctx) => {
  if (!value) return null
  const isHttpsUrl = /^https:\/\//i.test(value) && z.url().safeParse(value).success
  if (internalMediaUrlPattern.test(value) || isHttpsUrl) return value
  ctx.addIssue({ code: 'custom', message: 'Kies een afbeelding uit Media of gebruik een geldige HTTPS-URL' })
  return z.NEVER
})

export const emailBrandingInputSchema = z.object({
  imageUrl: emailHeroImageUrlSchema,
})
