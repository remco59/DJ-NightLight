import { eq } from 'drizzle-orm'
import { calendarSyncSettings, emailProviderSettings } from '../../db/schema'
import { decryptSecret, maskSecret } from '../../shared/secret-box'
import { db } from './db'

type IntegrationSource = 'settings' | 'environment' | 'none'

function runtimeCalendar() {
  const config = useRuntimeConfig()
  return config.googleCalendar as { clientId?: string, clientSecret?: string, refreshToken?: string }
}

function runtimeEmail() {
  const config = useRuntimeConfig()
  return config.email as { apiKey?: string, from?: string, reviewUrl?: string }
}

function password() {
  return String(useRuntimeConfig().session.password || '')
}

export async function loadCalendarIntegration() {
  const [row] = await db.select().from(calendarSyncSettings)
    .where(eq(calendarSyncSettings.key, 'default')).limit(1)
  const env = runtimeCalendar()
  const savedConfigured = Boolean(row?.clientId && row?.clientSecretEncrypted && row?.refreshTokenEncrypted)
  const envConfigured = Boolean(env.clientId && env.clientSecret && env.refreshToken)

  const credentials = savedConfigured
    ? {
        clientId: row!.clientId!,
        clientSecret: decryptSecret(row!.clientSecretEncrypted!, password()),
        refreshToken: decryptSecret(row!.refreshTokenEncrypted!, password()),
      }
    : {
        clientId: String(env.clientId || ''),
        clientSecret: String(env.clientSecret || ''),
        refreshToken: String(env.refreshToken || ''),
      }

  const source: IntegrationSource = savedConfigured ? 'settings' : envConfigured ? 'environment' : 'none'
  return {
    row,
    credentials,
    status: {
      source,
      configured: Boolean(credentials.clientId && credentials.clientSecret && credentials.refreshToken),
      clientId: credentials.clientId,
      clientSecretConfigured: Boolean(credentials.clientSecret),
      refreshTokenConfigured: Boolean(credentials.refreshToken),
      enabled: row?.enabled ?? false,
      calendarId: row?.calendarId || 'primary',
      cancellationBehavior: row?.cancellationBehavior || 'delete',
    },
  }
}

export async function loadEmailIntegration() {
  const [row] = await db.select().from(emailProviderSettings)
    .where(eq(emailProviderSettings.key, 'default')).limit(1)
  const env = runtimeEmail()
  const apiKey = row?.apiKeyEncrypted
    ? decryptSecret(row.apiKeyEncrypted, password())
    : String(env.apiKey || '')
  const from = row?.fromAddress !== null && row?.fromAddress !== undefined
    ? row.fromAddress
    : String(env.from || '')
  const reviewUrl = row?.reviewUrl !== null && row?.reviewUrl !== undefined
    ? row.reviewUrl
    : String(env.reviewUrl || '')

  const source: IntegrationSource = row
    ? 'settings'
    : apiKey || from || reviewUrl
      ? 'environment'
      : 'none'

  return {
    row,
    config: { apiKey, from, reviewUrl },
    status: {
      source,
      configured: Boolean(apiKey && from),
      apiKeyConfigured: Boolean(apiKey),
      apiKeyPreview: apiKey ? maskSecret(apiKey) : null,
      from,
      reviewUrl,
    },
  }
}
