import { eq, sql } from 'drizzle-orm'
import { users } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event)

  await db
    .update(users)
    .set({
      sessionVersion: sql`${users.sessionVersion} + 1`,
      updatedAt: new Date(),
    })
    .where(eq(users.id, user.id))

  await clearUserSession(event)
  return { ok: true }
})
