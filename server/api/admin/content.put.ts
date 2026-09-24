import { siteContent } from '../../../db/schema'
import { siteContentInputSchema } from '../../../shared/schemas/site-content'
import { db } from '../../utils/db'
import { requireStaff } from '../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])

  const body = await readBody(event)
  const parsed = siteContentInputSchema.safeParse(body)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    const field = issue?.path.length ? issue.path.join('.') : 'website-inhoud'
    throw createError({
      statusCode: 422,
      statusMessage: issue ? `${field}: ${issue.message}` : 'De website-inhoud is ongeldig',
    })
  }

  const input = parsed.data
  const [content] = await db
    .insert(siteContent)
    .values({ key: 'default', ...input, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteContent.key,
      set: { ...input, updatedAt: new Date() },
    })
    .returning()

  if (!content) throw createError({ statusCode: 500, statusMessage: 'Website-inhoud opslaan is niet gelukt' })
  return { content }
})
