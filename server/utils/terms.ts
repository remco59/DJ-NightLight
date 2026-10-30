import { desc, eq } from 'drizzle-orm'
import { termsVersions } from '../../db/schema'
import { db } from './db'

/** The newest published terms: the version a client accepts. Null until the owner has published one. */
export async function getLatestPublishedTerms() {
  const [terms] = await db.select().from(termsVersions).where(eq(termsVersions.status, 'published')).orderBy(desc(termsVersions.version)).limit(1)
  return terms ?? null
}
