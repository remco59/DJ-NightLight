import { desc, eq } from 'drizzle-orm'
import { termsVersions } from '../../db/schema'
import { db } from '../utils/db'

/** The terms a client reads and accepts: the newest published version, or an older published one by number. */
export default defineEventHandler(async (event) => {
  const requested = Number(getQuery(event).version)
  const rows = await db.select().from(termsVersions).where(eq(termsVersions.status, 'published')).orderBy(desc(termsVersions.version))
  const terms = Number.isInteger(requested) && requested > 0 ? rows.find(row => row.version === requested) : rows[0]
  if (!terms || !terms.publishedAt) throw createError({ statusCode: 404, statusMessage: 'Er zijn nog geen gepubliceerde voorwaarden' })
  setHeader(event, 'Cache-Control', 'public, max-age=60')
  return { terms: { id: terms.id, version: terms.version, title: terms.title, body: terms.body, summary: terms.summary, publishedAt: terms.publishedAt.toISOString() } }
})
