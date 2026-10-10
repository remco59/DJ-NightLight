import { z } from 'zod'
import { and, eq, inArray } from 'drizzle-orm'
import { calendarSyncSettings, emailProviderSettings, socialAccounts, socialSettings } from '../../../../db/schema'
import { INSTAGRAM_LOGIN_TYPES } from '../../../../shared/instagram'
import { encryptSecret } from '../../../../shared/secret-box'
import { db } from '../../../utils/db'
import { clearGoogleCalendarTokenCache } from '../../../utils/google-calendar'
import { loadCalendarIntegration, loadEmailIntegration, loadInstagramCredentials, loadInstagramIntegration } from '../../../utils/integration-settings'
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
    // Which login these credentials are for; saving them also makes it the login used for the next connection.
    loginType: z.enum(INSTAGRAM_LOGIN_TYPES).default('facebook'),
    appId: z.string().trim().regex(/^\d{5,30}$/, 'Een Meta app-ID bestaat uit cijfers'),
    appSecret: z.string().trim().min(16, 'Het app secret is te kort').max(200),
    loginConfigId: z.string().trim().regex(/^\d{5,30}$/, 'Een configuratie-ID bestaat uit cijfers').or(z.literal('')).default(''),
  }),
  // Only switches the login type, keeping the saved credentials of both.
  z.object({
    provider: z.literal('instagram_login_type'),
    loginType: z.enum(INSTAGRAM_LOGIN_TYPES),
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

  if (input.provider === 'instagram_login_type') {
    await db.insert(socialSettings)
      .values({ key: 'default', loginType: input.loginType })
      .onConflictDoUpdate({ target: socialSettings.key, set: { loginType: input.loginType, updatedAt: new Date() } })
    return { instagram: (await loadInstagramIntegration()).status }
  }

  if (input.provider === 'instagram') {
    const previous = await loadInstagramCredentials(input.loginType)
    const values = input.loginType === 'instagram'
      ? {
          instagramAppId: input.appId,
          instagramAppSecretEncrypted: encryptSecret(input.appSecret, encryptionPassword),
          loginType: input.loginType,
          updatedAt: new Date(),
        }
      : {
          appId: input.appId,
          appSecretEncrypted: encryptSecret(input.appSecret, encryptionPassword),
          loginConfigId: input.loginConfigId || null,
          loginType: input.loginType,
          updatedAt: new Date(),
        }
    await db.insert(socialSettings)
      .values({ key: 'default', ...values })
      .onConflictDoUpdate({ target: socialSettings.key, set: values })

    // Tokens belong to the app that issued them: a different app means the account must be linked again.
    // Only accounts that were connected with this login type are affected.
    if (previous.appId && previous.appId !== input.appId) {
      await db.update(socialAccounts)
        .set({ status: 'needs_reauth', updatedAt: new Date() })
        .where(and(
          inArray(socialAccounts.provider, ['instagram', 'facebook']),
          eq(socialAccounts.loginType, input.loginType),
        ))
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
