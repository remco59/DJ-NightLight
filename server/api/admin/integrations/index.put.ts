import { z } from 'zod'
import { calendarSyncSettings, emailProviderSettings } from '../../../../db/schema'
import { encryptSecret } from '../../../../shared/secret-box'
import { db } from '../../../utils/db'
import { clearGoogleCalendarTokenCache } from '../../../utils/google-calendar'
import { loadCalendarIntegration, loadEmailIntegration } from '../../../utils/integration-settings'
import { requireStaff } from '../../../utils/require-staff'

const schema = z.discriminatedUnion('provider', [
  z.object({
    provider: z.literal('calendar'),
    enabled: z.boolean(),
    calendarId: z.string().trim().min(1).max(255),
    cancellationBehavior: z.enum(['delete', 'mark_cancelled', 'keep']),
    credentials: z.object({
      clientId: z.string().trim().min(1).max(500),
      clientSecret: z.string().trim().min(1).max(4000),
      refreshToken: z.string().trim().min(1).max(8000),
    }).optional(),
  }),
  z.object({
    provider: z.literal('email'),
    apiKey: z.string().trim().min(8).max(8000).optional(),
    from: z.string().trim().max(500),
    reviewUrl: z.string().trim().max(2000),
  }),
])

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Invalid integration settings' })
  }

  const input = parsed.data
  const encryptionPassword = String(useRuntimeConfig().session.password || '')

  if (input.provider === 'calendar') {
    const values: Partial<typeof calendarSyncSettings.$inferInsert> = {
      enabled: input.enabled,
      calendarId: input.calendarId,
      cancellationBehavior: input.cancellationBehavior,
      updatedAt: new Date(),
    }

    if (input.credentials) {
      values.clientId = input.credentials.clientId
      values.clientSecretEncrypted = encryptSecret(input.credentials.clientSecret, encryptionPassword)
      values.refreshTokenEncrypted = encryptSecret(input.credentials.refreshToken, encryptionPassword)
    }

    await db.insert(calendarSyncSettings)
      .values({ key: 'default', enabled: input.enabled, calendarId: input.calendarId, cancellationBehavior: input.cancellationBehavior, ...values })
      .onConflictDoUpdate({ target: calendarSyncSettings.key, set: values })

    clearGoogleCalendarTokenCache()
    return { calendar: (await loadCalendarIntegration()).status }
  }

  const values: Partial<typeof emailProviderSettings.$inferInsert> = {
    fromAddress: input.from,
    reviewUrl: input.reviewUrl,
    updatedAt: new Date(),
  }
  if (input.apiKey) values.apiKeyEncrypted = encryptSecret(input.apiKey, encryptionPassword)

  await db.insert(emailProviderSettings)
    .values({ key: 'default', ...values })
    .onConflictDoUpdate({ target: emailProviderSettings.key, set: values })

  return { email: (await loadEmailIntegration()).status }
})
