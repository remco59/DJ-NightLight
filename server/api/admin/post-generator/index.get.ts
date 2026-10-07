import { desc, eq, inArray, like } from 'drizzle-orm'
import { generatedPosts, mediaAssets, socialAccounts, socialPostMedia, socialPosts } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const assets = (await db.select({
    id: mediaAssets.id,
    title: mediaAssets.title,
    altText: mediaAssets.altText,
    originalFilename: mediaAssets.originalFilename,
    source: mediaAssets.source,
    width: mediaAssets.width,
    height: mediaAssets.height,
    createdAt: mediaAssets.createdAt,
  }).from(mediaAssets).where(like(mediaAssets.mimeType, 'image/%')).orderBy(desc(mediaAssets.createdAt)).limit(250)).map(asset => ({
    ...asset,
    url: `/api/media/${asset.id}`,
    thumbnailUrl: `/api/media/${asset.id}?variant=thumb`,
  }))

  const rows = await db.select().from(generatedPosts)
    .orderBy(desc(generatedPosts.createdAt))
    .limit(100)

  // Newest social post per export and platform, for the status badge in Recente exports.
  const badges = new Map<string, Array<{ provider: string, status: string, permalink: string | null, scheduledAt: Date | null, lastError: string | null }>>()
  if (rows.length) {
    const links = await db.select({
      generatedPostId: socialPostMedia.generatedPostId,
      provider: socialAccounts.provider,
      status: socialPosts.status,
      permalink: socialPosts.permalink,
      scheduledAt: socialPosts.scheduledAt,
      lastError: socialPosts.lastError,
    }).from(socialPostMedia)
      .innerJoin(socialPosts, eq(socialPosts.id, socialPostMedia.postId))
      .innerJoin(socialAccounts, eq(socialAccounts.id, socialPosts.accountId))
      .where(inArray(socialPostMedia.generatedPostId, rows.map(row => row.id)))
      .orderBy(desc(socialPosts.createdAt))
    for (const link of links) {
      if (!link.generatedPostId) continue
      const list = badges.get(link.generatedPostId) ?? []
      if (!list.some(item => item.provider === link.provider)) list.push(link)
      badges.set(link.generatedPostId, list)
    }
  }

  const posts = rows.map(post => ({
    ...post,
    imageUrl: `/api/generated-posts/${post.id}`,
    social: badges.get(post.id) ?? [],
  }))

  return { assets, posts }
})
