import { desc } from 'drizzle-orm'
import { generatedPosts, mediaAssets } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'

export default defineEventHandler(async (event) => {
  await requireStaff(event)

  const assets = (await db.select({
    id: mediaAssets.id,
    title: mediaAssets.title,
    altText: mediaAssets.altText,
    originalFilename: mediaAssets.originalFilename,
    width: mediaAssets.width,
    height: mediaAssets.height,
    createdAt: mediaAssets.createdAt,
  }).from(mediaAssets).orderBy(desc(mediaAssets.createdAt)).limit(250)).map(asset => ({
    ...asset,
    url: `/api/media/${asset.id}`,
    thumbnailUrl: `/api/media/${asset.id}?variant=thumb`,
  }))

  const posts = (await db.select().from(generatedPosts)
    .orderBy(desc(generatedPosts.createdAt))
    .limit(100)).map(post => ({
      ...post,
      imageUrl: `/api/generated-posts/${post.id}`,
    }))

  return { assets, posts }
})
