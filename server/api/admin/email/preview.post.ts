import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { emailTemplates } from '../../../../db/schema'
import { renderEmailTemplate } from '../../../../shared/email-automation'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

const schema = z.object({
  templateKey: z.string().min(1).max(80),
  variables: z.record(z.string(), z.union([z.string(), z.number(), z.null()])).default({}),
})

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const input = await readValidatedBody(event, schema.parse)
  const [template] = await db.select().from(emailTemplates).where(eq(emailTemplates.key, input.templateKey)).limit(1)
  if (!template) throw createError({ statusCode: 404, statusMessage: 'Template not found' })
  return {
    subject: renderEmailTemplate(template.subject, input.variables),
    body: renderEmailTemplate(template.body, input.variables),
  }
})
