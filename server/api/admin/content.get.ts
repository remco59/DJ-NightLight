import { eq } from 'drizzle-orm'
import { siteContent } from '../../../db/schema'
import { defaultSiteContent } from '../../utils/site-content-defaults'
import { db } from '../../utils/db'
import { requireStaff } from '../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const [content] = await db.select().from(siteContent).where(eq(siteContent.key, 'default')).limit(1)

  return {
    content: content
      ? { ...content, key: undefined, updatedAt: undefined }
      : defaultSiteContent,
  }
})
