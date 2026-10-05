import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { emailTemplates } from '../../../../../db/schema'
import { emailHeroImageUrlSchema } from '../../../../../shared/email-branding'
import { db, sql } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/require-staff'

const schema = z.object({
  enabled: z.boolean(),
  subject: z.string().trim().min(1).max(300),
  body: z.string().trim().min(1).max(20_000),
  scheduleAnchor: z.enum(['event', 'gig_start', 'gig_end', 'invoice_due']),
  offsetMinutes: z.coerce.number().int().min(-525600).max(525600),
  heroImageUrl: emailHeroImageUrlSchema,
})

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager'])
  const key = getRouterParam(event, 'key')
  if (!key) throw createError({ statusCode: 400, statusMessage: 'Templatesleutel is verplicht' })
  const input = await readValidatedBody(event, schema.parse)
  const { heroImageUrl, ...templateInput } = input
  const [template] = await db.update(emailTemplates)
    .set({ ...templateInput, updatedAt: new Date() })
    .where(eq(emailTemplates.key, key))
    .returning()
  if (!template) throw createError({ statusCode: 404, statusMessage: 'Template niet gevonden' })

  await sql`
    UPDATE email_templates
    SET hero_image_url = ${heroImageUrl}
    WHERE key = ${key}
  `

  return { template: { ...template, heroImageUrl } }
})
