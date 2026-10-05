import { eq, sql as drizzleSql } from 'drizzle-orm'
import { users } from '../../../../db/schema'
import { updateManagedUserSchema } from '../../../../shared/schemas/user'
import { recordAudit } from '../../../utils/audit'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, ['owner'])
  const id = getRouterParam(event, 'id')
  if (!id) throw createError({ statusCode: 400, statusMessage: 'Gebruikers-ID is verplicht' })

  const input = await readValidatedBody(event, updateManagedUserSchema.parse)
  const [existing] = await db.select().from(users).where(eq(users.id, id)).limit(1)
  if (!existing) throw createError({ statusCode: 404, statusMessage: 'Gebruiker niet gevonden' })

  if (existing.role === 'owner' && input.role) {
    throw createError({ statusCode: 409, statusMessage: 'De rol van eigenaar kan hier niet worden gewijzigd' })
  }
  if (existing.role === 'owner' && input.active === false) {
    throw createError({ statusCode: 409, statusMessage: 'Het account van de eigenaar kan niet worden uitgeschakeld' })
  }
  if (actor.id === id && input.active === false) {
    throw createError({ statusCode: 409, statusMessage: 'Je kunt je eigen account niet uitschakelen' })
  }

  if (input.email && input.email !== existing.email) {
    const [duplicate] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1)
    if (duplicate) throw createError({ statusCode: 409, statusMessage: 'Er bestaat al een account met dit e-mailadres' })
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

  if (!updated) throw createError({ statusCode: 500, statusMessage: 'Account bijwerken is niet gelukt' })

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
