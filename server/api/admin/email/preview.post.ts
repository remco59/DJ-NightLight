import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { emailTemplates } from '../../../../db/schema'
import { emailHeroImageUrlSchema } from '../../../../shared/email-branding'
import {
  normalizeEmailText,
  renderBrandedEmailHtml,
  renderEmailTemplate,
} from '../../../../shared/email-automation'
import { db } from '../../../utils/db'
import { loadEmailBranding } from '../../../utils/email-branding'
import { requireStaff } from '../../../utils/require-staff'

const schema = z.object({
  templateKey: z.string().min(1).max(80),
  variables: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).default({}),
  subject: z.string().trim().min(1).max(300).optional(),
  body: z.string().trim().min(1).max(20_000).optional(),
  heroImageUrl: emailHeroImageUrlSchema.optional(),
})

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const input = await readValidatedBody(event, schema.parse)
  const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.key, input.templateKey)).limit(1)
  if (!template) throw createError({ statusCode: 404, statusMessage: 'Template niet gevonden' })

  const subject = renderEmailTemplate(input.subject ?? template.subject, input.variables)
  const body = normalizeEmailText(renderEmailTemplate(input.body ?? template.body, input.variables))
  const branding = await loadEmailBranding(template.key, input.heroImageUrl)
  return {
    subject,
    body,
    html: renderBrandedEmailHtml(template.key, body, input.variables, branding),
  }
})
