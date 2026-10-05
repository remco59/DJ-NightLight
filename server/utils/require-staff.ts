import { eq } from 'drizzle-orm'
import { users } from '../../db/schema'
import type { StaffRole } from '../../shared/auth'
import { roleAllowed } from '../../shared/auth'
import { db } from './db'

type SessionEvent = Parameters<typeof requireUserSession>[0]
type ClearSessionEvent = Parameters<typeof clearUserSession>[0]

export async function requireStaff(event: unknown, allowed?: readonly StaffRole[]) {
  const sessionEvent = event as SessionEvent
  const session = await requireUserSession(sessionEvent)
  const sessionUser = session.user

  if (!sessionUser?.id) {
    throw createError({ statusCode: 401, statusMessage: 'Je moet ingelogd zijn' })
  }

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.id, sessionUser.id))
    .limit(1)

  if (!user || !user.active || user.sessionVersion !== sessionUser.sessionVersion) {
    await clearUserSession(event as ClearSessionEvent)
    throw createError({ statusCode: 401, statusMessage: 'Je sessie is niet meer geldig' })
  }

  if (!roleAllowed(user.role, allowed)) {
    throw createError({ statusCode: 403, statusMessage: 'Onvoldoende rechten' })
  }

  return user
}
