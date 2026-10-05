import { eq, sql } from 'drizzle-orm'
import { auditLogs, users } from '../../../../db/schema'
import { changePasswordSchema } from '../../../../shared/schemas/account-security'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const user = await requireStaff(event)
  const parsed = changePasswordSchema.safeParse(await readBody(event))

  if (!parsed.success) {
    throw createError({
      statusCode: 422,
      statusMessage: parsed.error.issues[0]?.message || 'Ongeldig verzoek om het wachtwoord te wijzigen',
    })
  }

  if (!user.passwordHash || !(await verifyPassword(user.passwordHash, parsed.data.currentPassword))) {
    throw createError({ statusCode: 400, statusMessage: 'Het huidige wachtwoord is onjuist.' })
  }

  const passwordHash = await hashPassword(parsed.data.newPassword)
  const updated = await db.transaction(async (tx) => {
    const [updatedUser] = await tx
      .update(users)
      .set({
        passwordHash,
        sessionVersion: sql`${users.sessionVersion} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(users.id, user.id))
      .returning({
        id: users.id,
        email: users.email,
        name: users.name,
        role: users.role,
        sessionVersion: users.sessionVersion,
      })

    if (!updatedUser) {
      throw createError({ statusCode: 500, statusMessage: 'Wachtwoord bijwerken is niet gelukt' })
    }

    await tx.insert(auditLogs).values({
      userId: user.id,
      entityType: 'user',
      entityId: user.id,
      action: 'password_changed',
      metadata: { otherSessionsRevoked: true },
    })

    return updatedUser
  })

  const authEvent = event as unknown as Parameters<typeof setUserSession>[0]
  await setUserSession(authEvent, {
    user: updated,
    loggedInAt: Date.now(),
  })

  return { ok: true }
})
