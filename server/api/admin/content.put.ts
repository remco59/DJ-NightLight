import { siteContent } from '../../../db/schema'
import { siteContentInputSchema } from '../../../shared/schemas/site-content'
import { db } from '../../utils/db'
import { requireStaff } from '../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const input = await readValidatedBody(event, siteContentInputSchema.parse)

  const [content] = await db
    .insert(siteContent)
    .values({ key: 'default', ...input, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: siteContent.key,
      set: { ...input, updatedAt: new Date() },
    })
    .returning()

  if (!content) throw createError({ statusCode: 500, statusMessage: 'Could not save website content' })
  return { content }
})
