import { and, eq } from 'drizzle-orm'
import { users } from '../../db/schema'
import { db } from './db'

export async function validateGigAssignee(userId: string | null) {
  if (!userId) return null

  const [dj] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(
      eq(users.id, userId),
      eq(users.role, 'dj'),
      eq(users.active, true),
    ))
    .limit(1)

  if (!dj) {
    throw createError({ statusCode: 422, statusMessage: 'De toegewezen gebruiker moet een actieve DJ zijn' })
  }

  return dj.id
}
