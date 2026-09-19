import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { users } from '../../../db/schema'
import { db } from '../../utils/db'
import { assertLoginRateLimit, clearLoginRateLimit } from '../../utils/login-rate-limit'

const credentialsSchema = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(200),
})

export default defineEventHandler(async (event) => {
  const forwarded = event.node.req.headers['x-forwarded-for']
  const ip = (Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(',')[0])
    || event.node.req.socket.remoteAddress
    || 'unknown'

  const body = await readValidatedBody(event, credentialsSchema.parse)
  const rateKey = `${ip}:${body.email}`

  assertLoginRateLimit(rateKey)

  const [user] = await db
    .select()
    .from(users)
    .where(eq(users.email, body.email))
    .limit(1)

  if (!user?.active || !user.passwordHash || !verifyPassword(user.passwordHash, body.password)) {
    throw createError({ statusCode: 401, statusMessage: 'Invalid email or password' })
  }

  clearLoginRateLimit(rateKey)

  await setUserSession(event, {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      sessionVersion: user.sessionVersion,
    },
    loggedInAt: Date.now(),
  })

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  }
})
