import { and, eq } from 'drizzle-orm'
import { socialAccounts, socialSettings } from '../../db/schema'
import { instagramRedirectUri, isTokenExpired, shouldRefreshToken } from '../../shared/instagram'
import { decryptSecret, encryptSecret } from '../../shared/secret-box'
import { db } from './db'
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  fetchInstagramProfile,
  InstagramApiError,
  refreshLongLivedToken,
} from './instagram'
import { loadInstagramIntegration } from './integration-settings'
import { structuredLog } from './structured-log'

function password() {
  return String(useRuntimeConfig().session.password || '')
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

/** Completes the OAuth round trip: code → short-lived token → long-lived token → account row. */
export async function connectInstagramAccount(input: { code: string, userId: string }) {
  const { credentials } = await loadInstagramIntegration()
  if (!credentials.appId || !credentials.appSecret) {
    throw new Error('De Meta-app is nog niet ingesteld')
  }

  const redirectUri = instagramRedirectUri(String(useRuntimeConfig().public.siteUrl || ''))
  const short = await exchangeCodeForToken({ ...credentials, redirectUri, code: input.code })
  const long = await exchangeForLongLivedToken({ appSecret: credentials.appSecret, accessToken: short.accessToken })
  const profile = await fetchInstagramProfile(long.accessToken)

  const now = new Date()
  const values = {
    username: profile.username,
    accountType: profile.accountType,
    accessTokenEncrypted: encryptSecret(long.accessToken, password()),
    tokenIssuedAt: now,
    tokenExpiresAt: new Date(now.getTime() + long.expiresInSeconds * 1000),
    scopes: short.permissions,
    status: 'active' as const,
    lastRefreshAttemptAt: null,
    lastRefreshError: null,
    connectedByUserId: input.userId,
    updatedAt: now,
  }

  const [account] = await db.insert(socialAccounts)
    .values({ provider: 'instagram', externalId: profile.externalId, ...values })
    .onConflictDoUpdate({ target: [socialAccounts.provider, socialAccounts.externalId], set: values })
    .returning()
  return account!
}

/**
 * Refreshes one account's long-lived token. A rejected token flips the account to
 * `needs_reauth`; any other failure is recorded and retried by the daily check.
 */
export async function refreshInstagramToken(accountId: string) {
  const [account] = await db.select().from(socialAccounts).where(eq(socialAccounts.id, accountId)).limit(1)
  if (!account) throw new Error('Account niet gevonden')

  const attemptedAt = new Date()
  try {
    const token = await refreshLongLivedToken(decryptSecret(account.accessTokenEncrypted, password()))
    await db.update(socialAccounts).set({
      accessTokenEncrypted: encryptSecret(token.accessToken, password()),
      tokenIssuedAt: attemptedAt,
      tokenExpiresAt: new Date(attemptedAt.getTime() + token.expiresInSeconds * 1000),
      status: 'active',
      lastRefreshAttemptAt: attemptedAt,
      lastRefreshError: null,
      updatedAt: attemptedAt,
    }).where(eq(socialAccounts.id, account.id))
    return { ok: true as const }
  } catch (error) {
    const permanent = error instanceof InstagramApiError && error.permanent
    await db.update(socialAccounts).set({
      status: permanent ? 'needs_reauth' : account.status,
      lastRefreshAttemptAt: attemptedAt,
      lastRefreshError: errorText(error).slice(0, 500),
      updatedAt: attemptedAt,
    }).where(eq(socialAccounts.id, account.id))
    structuredLog(permanent ? 'error' : 'warn', 'instagram_token_refresh_failed', {
      accountId: account.id,
      permanent,
      message: errorText(error),
    })
    return { ok: false as const, permanent, message: errorText(error) }
  }
}

/** Daily check, run from the worker tick: refresh tokens close to expiry, flag the ones that already expired. */
export async function refreshDueInstagramTokens(now = Date.now()) {
  const accounts = await db.select().from(socialAccounts)
    .where(and(eq(socialAccounts.provider, 'instagram'), eq(socialAccounts.status, 'active')))

  for (const account of accounts) {
    if (isTokenExpired(account.tokenExpiresAt, now)) {
      await db.update(socialAccounts)
        .set({ status: 'needs_reauth', lastRefreshError: 'Het token is verlopen', updatedAt: new Date() })
        .where(eq(socialAccounts.id, account.id))
      structuredLog('error', 'instagram_token_expired', { accountId: account.id })
      continue
    }
    if (shouldRefreshToken({ ...account, now })) await refreshInstagramToken(account.id)
  }
}

export async function recordSocialWorkerRun() {
  const now = new Date()
  await db.insert(socialSettings)
    .values({ key: 'default', lastWorkerRunAt: now })
    .onConflictDoUpdate({ target: socialSettings.key, set: { lastWorkerRunAt: now } })
}
