import { desc, eq } from 'drizzle-orm'
import { calendarSyncSettings, emailProviderSettings, socialAccounts, socialSettings } from '../../db/schema'
import {
  instagramHealth,
  hasPublishScope,
  instagramRedirectUri,
  maskAppId,
  maskExternalId,
  WORKER_ONLINE_WINDOW_MS,
} from '../../shared/instagram'
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

function runtimeInstagram() {
  const config = useRuntimeConfig()
  return config.instagram as { appId?: string, appSecret?: string, loginConfigId?: string }
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

export async function loadInstagramIntegration() {
  const [row] = await db.select().from(socialSettings)
    .where(eq(socialSettings.key, 'default')).limit(1)
  const [account] = await db.select().from(socialAccounts)
    .where(eq(socialAccounts.provider, 'instagram'))
    .orderBy(desc(socialAccounts.updatedAt)).limit(1)
  const env = runtimeInstagram()
  const savedConfigured = Boolean(row?.appId && row?.appSecretEncrypted)
  const envConfigured = Boolean(env.appId && env.appSecret)

  const credentials = savedConfigured
    ? { appId: row!.appId!, appSecret: decryptSecret(row!.appSecretEncrypted!, password()), configId: row!.loginConfigId || '' }
    : { appId: String(env.appId || ''), appSecret: String(env.appSecret || ''), configId: String(env.loginConfigId || '') }

  const source: IntegrationSource = savedConfigured ? 'settings' : envConfigured ? 'environment' : 'none'
  const configured = Boolean(credentials.appId && credentials.appSecret)
  const lastRun = row?.lastWorkerRunAt ?? null
  const health = instagramHealth({
    appConfigured: configured,
    account: account
      ? { status: account.status, tokenExpiresAt: account.tokenExpiresAt, scopes: account.scopes, lastError: account.lastError }
      : null,
    workerLastRunAt: lastRun,
  })

  return {
    row,
    account: account ?? null,
    credentials,
    status: {
      source,
      configured,
      appIdPreview: credentials.appId ? maskAppId(credentials.appId) : null,
      appSecretConfigured: Boolean(credentials.appSecret),
      loginConfigId: credentials.configId,
      redirectUri: instagramRedirectUri(String(useRuntimeConfig().public.siteUrl || '')),
      account: account
        ? {
            id: account.id,
            username: account.username,
            accountType: account.accountType,
            externalIdPreview: maskExternalId(account.externalId),
            pageName: account.pageName,
            status: account.status,
            tokenIssuedAt: account.tokenIssuedAt.toISOString(),
            tokenExpiresAt: account.tokenExpiresAt.toISOString(),
            canPublish: hasPublishScope(account.scopes),
            lastCheckedAt: account.lastCheckedAt?.toISOString() ?? null,
            lastError: account.lastError,
          }
        : null,
      lastPublishedAt: row?.lastPublishedAt?.toISOString() ?? null,
      lastWorkerRunAt: lastRun?.toISOString() ?? null,
      workerOnline: Boolean(lastRun && Date.now() - lastRun.getTime() <= WORKER_ONLINE_WINDOW_MS),
      health,
    },
  }
}
