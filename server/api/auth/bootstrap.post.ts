import { count } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '../../../db/schema'
import { db } from '../../utils/db'

const bootstrapSchema = z.object({
  email: z.email().trim().toLowerCase(),
  name: z.string().trim().min(2).max(200),
  password: z.string().min(12).max(200),
})

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig()
  const configuredToken = config.ownerBootstrapToken

  if (!configuredToken) {
    throw createError({ statusCode: 404, statusMessage: 'Not found' })
  }

  const suppliedToken = event.node.req.headers['x-bootstrap-token']
  if (typeof suppliedToken !== 'string' || suppliedToken !== configuredToken) {
    throw createError({ statusCode: 403, statusMessage: 'Invalid bootstrap token' })
  }

  const [countRow] = await db.select({ value: count() }).from(users)
  if ((countRow?.value ?? 0) > 0) {
    throw createError({ statusCode: 409, statusMessage: 'An account already exists' })
  }

  const body = await readValidatedBody(event, bootstrapSchema.parse)
  const passwordHash = await hashPassword(body.password)

  const [user] = await db.insert(users).values({
    email: body.email,
    name: body.name,
    passwordHash,
    role: 'owner',
    active: true,
  }).returning({
    id: users.id,
    email: users.email,
    name: users.name,
    role: users.role,
  })

  return { user }
})
