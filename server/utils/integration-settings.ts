import { and, desc, eq, ne } from 'drizzle-orm'
import { calendarSyncSettings, emailProviderSettings, socialAccounts, socialSettings } from '../../db/schema'
import {
  instagramHealth,
  hasPublishScope,
  parseLoginType,
  type InstagramLoginType,
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
  return config.instagram as { appId?: string, appSecret?: string, loginConfigId?: string, loginType?: string, igAppId?: string, igAppSecret?: string }
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

type SocialSettingsRow = typeof socialSettings.$inferSelect | undefined

/** App credentials for one login type; settings saved in NightLight win over the environment. */
function instagramCredentialsFor(row: SocialSettingsRow, loginType: InstagramLoginType) {
  const env = runtimeInstagram()
  if (loginType === 'instagram') {
    const saved = Boolean(row?.instagramAppId && row?.instagramAppSecretEncrypted)
    const fromEnv = Boolean(env.igAppId && env.igAppSecret)
    const credentials = saved
      ? { appId: row!.instagramAppId!, appSecret: decryptSecret(row!.instagramAppSecretEncrypted!, password()), configId: '' }
      : { appId: String(env.igAppId || ''), appSecret: String(env.igAppSecret || ''), configId: '' }
    const source: IntegrationSource = saved ? 'settings' : fromEnv ? 'environment' : 'none'
    return { credentials, source }
  }
  const saved = Boolean(row?.appId && row?.appSecretEncrypted)
  const fromEnv = Boolean(env.appId && env.appSecret)
  const credentials = saved
    ? { appId: row!.appId!, appSecret: decryptSecret(row!.appSecretEncrypted!, password()), configId: row!.loginConfigId || '' }
    : { appId: String(env.appId || ''), appSecret: String(env.appSecret || ''), configId: String(env.loginConfigId || '') }
  const source: IntegrationSource = saved ? 'settings' : fromEnv ? 'environment' : 'none'
  return { credentials, source }
}

/** The login type for the next connection: the saved choice, else the environment, else Facebook Login. */
function activeLoginType(row: SocialSettingsRow) {
  const env = runtimeInstagram()
  return parseLoginType(row?.loginType ?? env.loginType)
}

/** Credentials for a given login type, for code that works on an account (checks, renewal). */
export async function loadInstagramCredentials(loginType: InstagramLoginType) {
  const [row] = await db.select().from(socialSettings)
    .where(eq(socialSettings.key, 'default')).limit(1)
  return instagramCredentialsFor(row, loginType).credentials
}

export async function loadInstagramIntegration() {
  const [row] = await db.select().from(socialSettings)
    .where(eq(socialSettings.key, 'default')).limit(1)
  // A disconnected account that still has posts is kept as `disabled` (its token is wiped); it counts as not connected.
  const [account] = await db.select().from(socialAccounts)
    .where(and(eq(socialAccounts.provider, 'instagram'), ne(socialAccounts.status, 'disabled')))
    .orderBy(desc(socialAccounts.updatedAt)).limit(1)

  const loginType = activeLoginType(row)
  const facebook = instagramCredentialsFor(row, 'facebook')
  const instagram = instagramCredentialsFor(row, 'instagram')
  const active = loginType === 'instagram' ? instagram : facebook
  const { credentials, source } = active
  const configured = Boolean(credentials.appId && credentials.appSecret)

  // Health follows the account that is connected, which can still use the other login type than the setting.
  const accountLoginType = account ? parseLoginType(account.loginType) : loginType
  const accountCredentials = (accountLoginType === 'instagram' ? instagram : facebook).credentials
  const lastRun = row?.lastWorkerRunAt ?? null
  const health = instagramHealth({
    appConfigured: Boolean(accountCredentials.appId && accountCredentials.appSecret),
    account: account
      ? { status: account.status, tokenExpiresAt: account.tokenExpiresAt, scopes: account.scopes, lastError: account.lastError, loginType: accountLoginType }
      : null,
    workerLastRunAt: lastRun,
  })

  const summary = (entry: typeof facebook) => ({
    source: entry.source,
    configured: Boolean(entry.credentials.appId && entry.credentials.appSecret),
    appIdPreview: entry.credentials.appId ? maskAppId(entry.credentials.appId) : null,
    loginConfigId: entry.credentials.configId,
  })

  return {
    row,
    account: account ?? null,
    loginType,
    credentials,
    status: {
      loginType,
      loginTypes: { facebook: summary(facebook), instagram: summary(instagram) },
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
            loginType: accountLoginType,
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
