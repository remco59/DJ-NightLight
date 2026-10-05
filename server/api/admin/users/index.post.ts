import { eq } from 'drizzle-orm'
import { users } from '../../../../db/schema'
import { createManagedUserSchema } from '../../../../shared/schemas/user'
import { recordAudit } from '../../../utils/audit'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  const actor = await requireStaff(event, ['owner'])
  const input = await readValidatedBody(event, createManagedUserSchema.parse)

  const [duplicate] = await db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1)
  if (duplicate) throw createError({ statusCode: 409, statusMessage: 'Er bestaat al een account met dit e-mailadres' })

  const passwordHash = await hashPassword(input.password)
  const [created] = await db.insert(users).values({
    email: input.email,
    name: input.name,
    role: input.role,
    passwordHash,
    active: true,
  }).returning({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
    active: users.active,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
  })

  if (!created) throw createError({ statusCode: 500, statusMessage: 'Account aanmaken is niet gelukt' })

  await recordAudit({
    userId: actor.id,
    entityType: 'user',
    entityId: created.id,
    action: 'user_created',
    metadata: { role: created.role, email: created.email },
  })

  event.node.res.statusCode = 201
  return { user: created }
})
