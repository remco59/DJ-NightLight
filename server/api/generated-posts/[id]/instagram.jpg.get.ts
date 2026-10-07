import { eq } from 'drizzle-orm'
import { generatedPosts } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { ensureInstagramJpeg } from '../../../utils/social-publish'
import { requireUuidParam } from '../../../utils/route-params'

/** JPEG copy of an export, because Instagram does not accept PNG. Public and immutable like the PNG. */
export default defineEventHandler(async (event) => {
  const id = requireUuidParam(event, 'id')
  const [post] = await db.select().from(generatedPosts).where(eq(generatedPosts.id, id)).limit(1)
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Gegenereerde post niet gevonden' })

  try {
    const data = await ensureInstagramJpeg(post)
    setHeader(event, 'content-type', 'image/jpeg')
    setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')
    setHeader(event, 'content-length', data.length)
    return data
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Bestand van de gegenereerde post ontbreekt' })
  }
})
