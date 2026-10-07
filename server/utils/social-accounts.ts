import { and, desc, eq, ne } from 'drizzle-orm'
import { socialAccounts, socialSettings, type SocialAccount } from '../../db/schema'
import { instagramRedirectUri, shouldCheckConnection } from '../../shared/instagram'
import { decryptSecret, encryptSecret } from '../../shared/secret-box'
import { db } from './db'
import {
  exchangeCodeForToken,
  exchangeForLongLivedToken,
  inspectToken,
  InstagramApiError,
  type InstagramPage,
  listInstagramPages,
  selectInstagramPage,
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

export type ConnectOutcome =
  | { kind: 'connected', account: SocialAccount }
  | { kind: 'choose', userToken: string, pages: InstagramPage[] }

async function appCredentials() {
  const { credentials } = await loadInstagramIntegration()
  if (!credentials.appId || !credentials.appSecret) {
    throw new Error('De Meta-app is nog niet ingesteld')
  }
  return credentials
}

/** Stores the chosen Page's access token (encrypted) and makes it the one connected account. */
async function saveInstagramAccount(input: { page: InstagramPage, userId: string }) {
  const credentials = await appCredentials()
  const { page } = input

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

  // One Instagram account is connected at a time: choosing another replaces the previous one.
  await db.delete(socialAccounts)
    .where(and(eq(socialAccounts.provider, 'instagram'), ne(socialAccounts.id, account!.id)))
  return account!
}

/**
 * First half of the Facebook Login round trip: code → user token → long-lived user token → the Pages
 * that have an Instagram account. Connects straight away when the choice is clear (one candidate, or
 * the account that is already connected); otherwise the owner has to pick.
 */
export async function beginInstagramConnection(input: { code: string, userId: string }): Promise<ConnectOutcome> {
  const credentials = await appCredentials()
  const redirectUri = instagramRedirectUri(String(useRuntimeConfig().public.siteUrl || ''))
  const short = await exchangeCodeForToken({ ...credentials, redirectUri, code: input.code })
  const long = await exchangeForLongLivedToken({ ...credentials, accessToken: short.accessToken })

  const pages = await listInstagramPages(long.accessToken)
  if (!pages.length) {
    throw new InstagramApiError(
      'Geen Instagram-account gevonden. Koppel het Instagram-account aan een Facebook-pagina en geef NightLight toegang tot dat account en die pagina.',
      200,
      null,
      false,
    )
  }

  const [connected] = await db.select().from(socialAccounts)
    .where(eq(socialAccounts.provider, 'instagram'))
    .orderBy(desc(socialAccounts.updatedAt)).limit(1)
  const page = selectInstagramPage(pages, { preferredInstagramId: connected?.externalId })
  if (!page) return { kind: 'choose', userToken: long.accessToken, pages }
  return { kind: 'connected', account: await saveInstagramAccount({ page, userId: input.userId }) }
}

/** Candidates for the chooser; never includes tokens. */
export async function listInstagramChoices(userToken: string) {
  const pages = await listInstagramPages(userToken)
  return pages.map(({ instagramId, username, pageId, pageName }) => ({ instagramId, username, pageId, pageName }))
}

/** Second half: the owner picked one of the accounts Facebook granted access to. */
export async function completeInstagramChoice(input: { userToken: string, instagramId: string, userId: string }) {
  const page = (await listInstagramPages(input.userToken)).find(candidate => candidate.instagramId === input.instagramId)
  if (!page) {
    throw new InstagramApiError('Dit Instagram-account is niet (meer) beschikbaar. Verbind opnieuw.', 200, null, false)
  }
  return saveInstagramAccount({ page, userId: input.userId })
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
