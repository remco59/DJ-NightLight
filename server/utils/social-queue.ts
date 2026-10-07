import { and, asc, desc, eq, gte, inArray, isNotNull, lt, sql, type SQL } from 'drizzle-orm'
import { generatedPosts, socialAccounts, socialPostMedia, socialPosts, videoRenderJobs } from '../../db/schema'
import {
  checkCaption,
  checkScheduleMoment,
  INSTAGRAM_ALT_TEXT_MAX,
  socialTabStatuses,
  startOfAmsterdamWeek,
  type SocialPostItem,
  type SocialPostStatusKey,
  type SocialTab,
} from '../../shared/social'
import { recordAudit } from './audit'
import { db } from './db'
import { isPubliclyReachable } from './social-publish-core'
import { SocialPublishError } from './social-publish'

const itemColumns = {
  id: socialPosts.id,
  title: socialPosts.title,
  kind: socialPosts.kind,
  status: socialPosts.status,
  caption: socialPosts.caption,
  altText: socialPosts.altText,
  scheduledAt: socialPosts.scheduledAt,
  publishedAt: socialPosts.publishedAt,
  permalink: socialPosts.permalink,
  lastError: socialPosts.lastError,
  retryCount: socialPosts.retryCount,
  nextRetryAt: socialPosts.nextRetryAt,
  provider: socialAccounts.provider,
  accountName: socialAccounts.username,
  generatedPostId: socialPostMedia.generatedPostId,
  templateKey: generatedPosts.templateKey,
  videoRenderJobId: socialPostMedia.videoRenderJobId,
  durationSeconds: videoRenderJobs.durationSeconds,
  mediaCount: sql<number>`(select count(*)::int from ${socialPostMedia} m where m.post_id = ${socialPosts.id})`,
}

function toItem(row: Awaited<ReturnType<typeof selectItems>>[number]): SocialPostItem {
  const { videoRenderJobId, ...rest } = row
  return {
    ...rest,
    videoUrl: videoRenderJobId ? `/api/generated-videos/${videoRenderJobId}` : null,
    status: row.status as SocialPostStatusKey,
    scheduledAt: row.scheduledAt?.toISOString() ?? null,
    publishedAt: row.publishedAt?.toISOString() ?? null,
    nextRetryAt: row.nextRetryAt?.toISOString() ?? null,
    thumbnailUrl: row.generatedPostId ? `/api/generated-posts/${row.generatedPostId}` : null,
  }
}

function selectItems(where: SQL | undefined, order: SQL[], limit: number) {
  return db.select(itemColumns).from(socialPosts)
    .innerJoin(socialAccounts, eq(socialAccounts.id, socialPosts.accountId))
    .leftJoin(socialPostMedia, and(eq(socialPostMedia.postId, socialPosts.id), eq(socialPostMedia.position, 0)))
    .leftJoin(generatedPosts, eq(generatedPosts.id, socialPostMedia.generatedPostId))
    .leftJoin(videoRenderJobs, eq(videoRenderJobs.id, socialPostMedia.videoRenderJobId))
    .where(where)
    .orderBy(...order)
    .limit(limit)
}

export async function listSocialPosts(query: { tab?: SocialTab, start?: Date, end?: Date, limit?: number }) {
  const limit = Math.min(Math.max(query.limit ?? 100, 1), 200)
  const conditions: SQL[] = []

  if (query.tab) {
    conditions.push(inArray(socialPosts.status, [...socialTabStatuses[query.tab]]))
  }
  if (query.start && query.end) {
    // Agenda: what is going out, went out or failed to go out in the visible period. Concepts have no moment yet.
    const moment = sql`coalesce(${socialPosts.publishedAt}, ${socialPosts.scheduledAt})`
    conditions.push(
      inArray(socialPosts.status, ['scheduled', 'publishing', 'published', 'failed']),
      isNotNull(moment),
      gte(moment as SQL<Date>, query.start),
      lt(moment as SQL<Date>, query.end),
    )
  }

  const order = query.tab === 'queue'
    ? [asc(sql`coalesce(${socialPosts.scheduledAt}, ${socialPosts.createdAt})`)]
    : [desc(sql`coalesce(${socialPosts.publishedAt}, ${socialPosts.updatedAt})`)]
  const rows = await selectItems(and(...conditions), query.start ? [asc(socialPosts.scheduledAt)] : order, limit)
  return rows.map(toItem)
}

export async function socialOverview() {
  const grouped = await db.select({ status: socialPosts.status, count: sql<number>`count(*)::int` })
    .from(socialPosts).groupBy(socialPosts.status)
  const count = (statuses: readonly string[]) => grouped.filter(row => statuses.includes(row.status)).reduce((sum, row) => sum + row.count, 0)

  const [week] = await db.select({ count: sql<number>`count(*)::int` }).from(socialPosts)
    .where(and(eq(socialPosts.status, 'published'), gte(socialPosts.publishedAt, startOfAmsterdamWeek())))

  return {
    counts: {
      queue: count(socialTabStatuses.queue),
      history: count(socialTabStatuses.history),
      failed: count(socialTabStatuses.failed),
    },
    stats: {
      scheduled: count(['scheduled']),
      publishedThisWeek: week?.count ?? 0,
      failed: count(['failed']),
    },
  }
}

async function loadPost(id: string) {
  const [row] = await db.select().from(socialPosts).where(eq(socialPosts.id, id)).limit(1)
  if (!row) throw new SocialPublishError('Post niet gevonden', 404)
  return row
}

export type SocialPostPatch = {
  caption?: string
  altText?: string | null
  /** `null` clears the planned moment of a concept. */
  scheduledAt?: string | null
  /** `schedule` queues the post for `scheduledAt`, `draft` turns it back into a concept. */
  action?: 'schedule' | 'draft'
}

/** Edits a concept or a planned post. A post the worker already picked up can no longer be changed (409). */
export async function updateSocialPost(id: string, patch: SocialPostPatch, input: { userId: string, siteUrl: string }) {
  const row = await loadPost(id)
  if (row.status !== 'draft' && row.status !== 'scheduled') {
    throw new SocialPublishError('Deze post kan niet meer worden aangepast', 409)
  }

  const caption = patch.caption === undefined ? row.caption : patch.caption.trim()
  const captionCheck = checkCaption(caption)
  if (!captionCheck.ok) throw new SocialPublishError(captionCheck.message)
  const altText = patch.altText === undefined ? row.altText : (patch.altText?.trim() || null)
  if (altText && altText.length > INSTAGRAM_ALT_TEXT_MAX) {
    throw new SocialPublishError(`De alternatieve tekst mag maximaal ${INSTAGRAM_ALT_TEXT_MAX} tekens hebben`)
  }

  const action = patch.action ?? (row.status === 'scheduled' ? 'schedule' : 'draft')
  const now = new Date()
  let scheduledAt = patch.scheduledAt === undefined ? row.scheduledAt : (patch.scheduledAt ? new Date(patch.scheduledAt) : null)

  if (action === 'schedule') {
    if (!isPubliclyReachable(input.siteUrl)) {
      throw new SocialPublishError('NUXT_PUBLIC_SITE_URL wijst naar een lokaal adres. Meta moet de afbeelding via internet kunnen ophalen.', 409)
    }
    const [account] = await db.select().from(socialAccounts).where(eq(socialAccounts.id, row.accountId)).limit(1)
    if (!account || account.status !== 'active') {
      throw new SocialPublishError('De koppeling met Meta is niet actief. Verbind het account opnieuw.', 409)
    }
    // An unchanged moment of an already planned post is not re-checked against "in the future".
    const unchanged = row.status === 'scheduled' && patch.scheduledAt === undefined
    if (!unchanged) {
      const check = checkScheduleMoment(scheduledAt, now, account.tokenExpiresAt)
      if (!check.ok) throw new SocialPublishError(check.message)
      scheduledAt = check.at
    }
  }

  const status = action === 'schedule' ? 'scheduled' : 'draft'
  const [updated] = await db.update(socialPosts).set({
    caption, altText, scheduledAt, status, retryCount: 0, nextRetryAt: null, lastError: null,
    // A container prepared ahead of time carries the old caption, so Meta gets a new one.
    containerId: null, updatedAt: now,
  }).where(and(eq(socialPosts.id, id), inArray(socialPosts.status, ['draft', 'scheduled']))).returning()
  if (!updated) throw new SocialPublishError('Deze post is net opgepakt door de worker en kan niet meer worden aangepast', 409)

  await recordAudit({
    userId: input.userId,
    entityType: 'social_post',
    entityId: id,
    action: status === 'scheduled' ? 'social_post.scheduled' : 'social_post.updated',
    metadata: { scheduledAt: scheduledAt?.toISOString() ?? null },
  })
  return updated
}

/** Cancels a concept, a planned post or a failed one. A post that is being published right now cannot be stopped. */
export async function cancelSocialPost(id: string, userId: string) {
  await loadPost(id)
  const [cancelled] = await db.update(socialPosts).set({ status: 'cancelled', nextRetryAt: null, updatedAt: new Date() })
    .where(and(eq(socialPosts.id, id), inArray(socialPosts.status, ['draft', 'scheduled', 'failed']))).returning()
  if (!cancelled) throw new SocialPublishError('Deze post kan niet meer worden geannuleerd', 409)
  await recordAudit({ userId, entityType: 'social_post', entityId: id, action: 'social_post.cancelled' })
  return cancelled
}

/** Queues a failed post again; the worker publishes it within a minute. */
export async function retrySocialPost(id: string, userId: string) {
  const row = await loadPost(id)
  const [account] = await db.select().from(socialAccounts).where(eq(socialAccounts.id, row.accountId)).limit(1)
  if (!account || account.status !== 'active') {
    throw new SocialPublishError('De koppeling met Meta is niet actief. Verbind het account opnieuw in Instellingen en probeer het dan nog eens.', 409)
  }
  const now = new Date()
  const [queued] = await db.update(socialPosts).set({
    status: 'scheduled', scheduledAt: now, retryCount: 0, nextRetryAt: null, lastError: null, updatedAt: now,
  }).where(and(eq(socialPosts.id, id), eq(socialPosts.status, 'failed'))).returning()
  if (!queued) throw new SocialPublishError('Alleen een mislukte post kan opnieuw worden geprobeerd', 409)
  await recordAudit({ userId, entityType: 'social_post', entityId: id, action: 'social_post.retry_requested' })
  return queued
}
