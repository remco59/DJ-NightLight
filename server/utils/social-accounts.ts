import { and, eq } from 'drizzle-orm'
import { socialAccounts, socialSettings } from '../../db/schema'
import { instagramRedirectUri, shouldCheckConnection } from '../../shared/instagram'
import { decryptSecret, encryptSecret } from '../../shared/secret-box'
import { db } from './db'
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  inspectToken,
  InstagramApiError,
  listInstagramPages,
} from './instagram'
import { loadInstagramIntegration } from './integration-settings'
import { structuredLog } from './structured-log'

function password() {
  return String(useRuntimeConfig().session.password || '')
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : String(error)
}

/** Used when Meta reports no expiry at all; the daily check corrects it from the real answer. */
const FALLBACK_ACCESS_DAYS = 60

/**
 * Completes the Facebook Login round trip: code → user token → long-lived user token → the Facebook
 * Page that has an Instagram account → that Page's access token (stored encrypted) → account row.
 */
export async function connectInstagramAccount(input: { code: string, userId: string }) {
  const { credentials } = await loadInstagramIntegration()
  if (!credentials.appId || !credentials.appSecret) {
    throw new Error('De Meta-app is nog niet ingesteld')
  }

  const redirectUri = instagramRedirectUri(String(useRuntimeConfig().public.siteUrl || ''))
  const short = await exchangeCodeForToken({ ...credentials, redirectUri, code: input.code })
  const long = await exchangeForLongLivedToken({ ...credentials, accessToken: short.accessToken })

  const pages = await listInstagramPages(long.accessToken)
  const page = pages[0]
  if (!page) {
    throw new InstagramApiError(
      'Geen Instagram-account gevonden. Koppel het Instagram-account aan een Facebook-pagina en geef NightLight toegang tot die pagina.',
      200,
      null,
      false,
    )
  }

  const inspection = await inspectToken({ ...credentials, token: page.pageAccessToken })
  if (!inspection.isValid || inspection.appId !== credentials.appId) {
    throw new InstagramApiError(inspection.errorMessage || 'Meta keurde de toegang niet goed', 200, null, true)
  }

  const now = new Date()
  const values = {
    username: page.username || page.pageName,
    accountType: null,
    pageId: page.pageId,
    pageName: page.pageName,
    accessTokenEncrypted: encryptSecret(page.pageAccessToken, password()),
    tokenIssuedAt: now,
    tokenExpiresAt: inspection.expiresAt ?? new Date(now.getTime() + FALLBACK_ACCESS_DAYS * 86_400_000),
    scopes: inspection.scopes,
    status: 'active' as const,
    lastCheckedAt: now,
    lastError: null,
    connectedByUserId: input.userId,
    updatedAt: now,
  }

  const [account] = await db.insert(socialAccounts)
    .values({ provider: 'instagram', externalId: page.instagramId, ...values })
    .onConflictDoUpdate({ target: [socialAccounts.provider, socialAccounts.externalId], set: values })
    .returning()
  return account!
}

/**
 * Asks Meta whether the stored access still works and updates expiry and permissions.
 * Access that Meta rejects flips the account to `needs_reauth`; other failures are recorded and retried.
 */
export async function checkInstagramConnection(accountId: string) {
  const [account] = await db.select().from(socialAccounts).where(eq(socialAccounts.id, accountId)).limit(1)
  if (!account) throw new Error('Account niet gevonden')
  const { credentials } = await loadInstagramIntegration()

  const checkedAt = new Date()
  try {
    if (!credentials.appId || !credentials.appSecret) throw new Error('De Meta-app is niet ingesteld')
    const inspection = await inspectToken({ ...credentials, token: decryptSecret(account.accessTokenEncrypted, password()) })

    if (!inspection.isValid || inspection.appId !== credentials.appId) {
      await db.update(socialAccounts).set({
        status: 'needs_reauth',
        lastCheckedAt: checkedAt,
        lastError: inspection.errorMessage || 'Meta keurt de toegang niet meer goed',
        updatedAt: checkedAt,
      }).where(eq(socialAccounts.id, account.id))
      return { ok: false as const, permanent: true, message: inspection.errorMessage || 'Meta keurt de toegang niet meer goed' }
    }

    await db.update(socialAccounts).set({
      tokenExpiresAt: inspection.expiresAt ?? account.tokenExpiresAt,
      scopes: inspection.scopes,
      lastCheckedAt: checkedAt,
      lastError: null,
      updatedAt: checkedAt,
    }).where(eq(socialAccounts.id, account.id))
    return { ok: true as const }
  } catch (error) {
    const permanent = error instanceof InstagramApiError && error.permanent
    await db.update(socialAccounts).set({
      status: permanent ? 'needs_reauth' : account.status,
      lastCheckedAt: checkedAt,
      lastError: errorText(error).slice(0, 500),
      updatedAt: checkedAt,
    }).where(eq(socialAccounts.id, account.id))
    structuredLog(permanent ? 'error' : 'warn', 'instagram_connection_check_failed', {
      accountId: account.id,
      permanent,
      message: errorText(error),
    })
    return { ok: false as const, permanent, message: errorText(error) }
  }
}

/** Daily check, run from the worker tick. */
export async function checkDueInstagramConnections(now = Date.now()) {
  const accounts = await db.select().from(socialAccounts)
    .where(and(eq(socialAccounts.provider, 'instagram'), eq(socialAccounts.status, 'active')))

  for (const account of accounts) {
    if (shouldCheckConnection({ status: account.status, lastCheckedAt: account.lastCheckedAt, now })) {
      await checkInstagramConnection(account.id)
    }
  }
}

export async function recordSocialWorkerRun() {
  const now = new Date()
  await db.insert(socialSettings)
    .values({ key: 'default', lastWorkerRunAt: now })
    .onConflictDoUpdate({ target: socialSettings.key, set: { lastWorkerRunAt: now } })
}
