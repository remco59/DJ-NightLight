import { z } from 'zod'
import { eq } from 'drizzle-orm'
import { calendarSyncSettings, emailProviderSettings, socialAccounts, socialSettings } from '../../../../db/schema'
import { encryptSecret } from '../../../../shared/secret-box'
import { db } from '../../../utils/db'
import { clearGoogleCalendarTokenCache } from '../../../utils/google-calendar'
import { loadCalendarIntegration, loadEmailIntegration, loadInstagramIntegration } from '../../../utils/integration-settings'
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
  z.object({
    provider: z.literal('instagram'),
    appId: z.string().trim().regex(/^\d{5,30}$/, 'Een Meta app-ID bestaat uit cijfers'),
    appSecret: z.string().trim().min(16, 'Het app secret is te kort').max(200),
    loginConfigId: z.string().trim().regex(/^\d{5,30}$/, 'Een configuratie-ID bestaat uit cijfers').or(z.literal('')),
  }),
])

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner'])
  const parsed = schema.safeParse(await readBody(event))
  if (!parsed.success) {
    throw createError({ statusCode: 422, statusMessage: parsed.error.issues[0]?.message || 'Ongeldige integratie-instellingen' })
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

  if (input.provider === 'instagram') {
    const previous = await loadInstagramIntegration()
    const values = {
      appId: input.appId,
      appSecretEncrypted: encryptSecret(input.appSecret, encryptionPassword),
      loginConfigId: input.loginConfigId || null,
      updatedAt: new Date(),
    }
    await db.insert(socialSettings)
      .values({ key: 'default', ...values })
      .onConflictDoUpdate({ target: socialSettings.key, set: values })

    // Tokens belong to the app that issued them: a different app means the account must be linked again.
    if (previous.credentials.appId && previous.credentials.appId !== input.appId) {
      await db.update(socialAccounts)
        .set({ status: 'needs_reauth', updatedAt: new Date() })
        .where(eq(socialAccounts.provider, 'instagram'))
    }
    return { instagram: (await loadInstagramIntegration()).status }
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
