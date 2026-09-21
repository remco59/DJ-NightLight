import { eq, sql as drizzleSql } from 'drizzle-orm'
import { users } from '../../../../db/schema'
import { updateManagedUserSchema } from '../../../../shared/schemas/user'
import { recordAudit } from '../../../utils/audit'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, ['owner'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'User id is required' })

  const input = await readValidatedBody(event, updateManagedUserSchema.parse)
  const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'User not found' })

  if (existing.role === 'owner' && input.role) {
    throw createError({ statusCode: 409, statusMessage: 'The owner role cannot be changed here' })
  }
  if (existing.role === 'owner' && input.active === false) {
    throw createError({ statusCode: 409, statusMessage: 'The owner account cannot be disabled' })
  }
  if (actor.id === id && input.active === false) {
    throw createError({ statusCode: 409, statusMessage: 'You cannot disable your own account' })
  }

  if (input.email && input.email !== existing.email) {
    const [duplicate] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1)
    if (duplicate) throw createError({ statusCode: 409, statusMessage: 'An account with this email already exists' })
  }

  const nextRole = existing.role === 'owner' ? 'owner' : (input.role ?? existing.role)
  const nextActive = input.active ?? existing.active
  const securityChanged = nextRole !== existing.role || nextActive !== existing.active

  const [updated] = await db.update(users).set({
    email: input.email ?? existing.email,
    name: input.name ?? existing.name,
    role: nextRole,
    active: nextActive,
    sessionVersion: securityChanged
      ? drizzleSql`${users.sessionVersion} + 1`
      : existing.sessionVersion,
    updatedAt: new Date(),
  }).where(eq(users.id, id)).returning({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    active: users.active,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
  })

  if (!updated) throw createError({ statusCode: 500, statusMessage: 'Could not update account' })

  await recordAudit({
    userId: actor.id,
    entityType: 'user',
    entityId: id,
    action: nextActive ? 'user_updated' : 'user_disabled',
    metadata: {
      previousRole: existing.role,
      role: nextRole,
      previousActive: existing.active,
      active: nextActive,
    },
  })

  return { user: updated }
})
