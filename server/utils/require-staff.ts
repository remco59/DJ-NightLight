import { eq } from 'drizzle-orm'
import { users } from '../../db/schema'
import type { StaffRole } from '../../shared/auth'
import { roleAllowed } from '../../shared/auth'
import { db } from './db'

type AuthEvent = Parameters<typeof requireUserSession>[0]

export async function requireStaff(event: unknown, allowed?: readonly StaffRole[]) {
  const authEvent = event as AuthEvent
  const session = await requireUserSession(authEvent)
  const sessionUser = session.user

  if (!sessionUser?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Authentication required' })
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1)

  if (!user || !user.active || user.sessionVersion !== sessionUser.sessionVersion) {
    await clearUserSession(authEvent)
    throw createError({ statusCode: 401, statusMessage: 'Session is no longer valid' })
  }

  if (!roleAllowed(user.role, allowed)) {
    throw createError({ statusCode: 403, statusMessage: 'Insufficient permissions' })
  }

  return user
}
