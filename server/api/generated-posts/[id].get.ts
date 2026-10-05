import { eq } from 'drizzle-orm'
import { generatedPosts } from '../../../db/schema'
import { db } from '../../utils/db'
import { getGeneratedStorage } from '../../utils/media-storage'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'ID van de gegenereerde post is verplicht' })
  const [post] = await db.select().from(generatedPosts).where(eq(generatedPosts.id, id)).limit(1)
  if (!post) throw createError({ statusCode: 404, statusMessage: 'Gegenereerde post niet gevonden' })

  try {
    const data = await getGeneratedStorage().read(post.outputKey)
    setHeader(event, 'content-type', post.outputMimeType)
    setHeader(event, 'cache-control', 'public, max-age=31536000, immutable')
    setHeader(event, 'content-length', data.length)
    return data
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Bestand van de gegenereerde post ontbreekt' })
  }
})
