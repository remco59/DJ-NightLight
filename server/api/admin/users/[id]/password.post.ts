import { eq, sql as drizzleSql } from 'drizzle-orm'
import { users } from '../../../../../db/schema'
import { resetManagedUserPasswordSchema } from '../../../../../shared/schemas/user'
import { recordAudit } from '../../../../utils/audit'
import { db } from '../../../../utils/db'
import { requireStaff } from '../../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, ['owner'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'User id is required' })
  if (id === actor.id) {
    throw createError({ statusCode: 409, statusMessage: 'Use My account to change your own password' })
  }

  const input = await readValidatedBody(event, resetManagedUserPasswordSchema.parse)
  const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.id, id)).limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  const passwordHash = await hashPassword(input.password)
  await db.update(users).set({
    passwordHash,
    sessionVersion: drizzleSql`${users.sessionVersion} + 1`,
    updatedAt: new Date(),
  }).where(eq(users.id, id))

  await recordAudit({
    userId: actor.id,
    entityType: 'user',
    entityId: id,
    action: 'password_reset',
    metadata: { sessionsRevoked: true },
  })

  return { ok: true }
})
