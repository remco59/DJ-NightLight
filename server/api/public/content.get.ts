import { eq } from 'drizzle-orm'
import { siteContent } from '../../../db/schema'
import { db } from '../../utils/db'
import { defaultSiteContent } from '../../utils/site-content-defaults'

export default defineEventHandler(async () => {
  const [content] = await db.select().from(siteContent).where(eq(siteContent.key, 'default')).limit(1)

  return {
    content: content
      ? { ...content, key: undefined, updatedAt: undefined }
      : defaultSiteContent,
  }
})
