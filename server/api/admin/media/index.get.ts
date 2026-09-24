import { desc, eq } from 'drizzle-orm'
import { gigs, mediaAssets, venues } from '../../../../db/schema'
import { mediaKindFromMime } from '../../../../shared/media'
import { db } from '../../../utils/db'
import { requireStaff } from '../../../utils/require-staff'
import { gigTitleSql } from '../../../utils/gig-title'

export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const query = getQuery(event)
  const q = String(query.q || '').trim().toLowerCase()
  const tag = String(query.tag || '').trim().toLowerCase()
  // Image pickers across the back office only understand images; the video
  // editor asks for everything with ?kind=all.
  const kind = String(query.kind || 'image')

  const rows = await db.select({
    id: mediaAssets.id,
    originalFilename: mediaAssets.originalFilename,
    mimeType: mediaAssets.mimeType,
    byteSize: mediaAssets.byteSize,
    width: mediaAssets.width,
    height: mediaAssets.height,
    durationMs: mediaAssets.durationMs,
    metadata: mediaAssets.metadata,
    title: mediaAssets.title,
    altText: mediaAssets.altText,
    tags: mediaAssets.tags,
    gigId: mediaAssets.gigId,
    venueId: mediaAssets.venueId,
    createdAt: mediaAssets.createdAt,
    updatedAt: mediaAssets.updatedAt,
    hasThumbnail: mediaAssets.thumbnailKey,
    gigTitle: gigTitleSql(),
    venueName: venues.name,
  }).from(mediaAssets)
    .leftJoin(gigs, eq(mediaAssets.gigId, gigs.id))
    .leftJoin(venues, eq(mediaAssets.venueId, venues.id))
    .orderBy(desc(mediaAssets.createdAt))
    .limit(500)

  const assets = rows
    .filter((row) => {
      if (kind !== 'all' && mediaKindFromMime(row.mimeType) !== kind) return false
      if (tag && !row.tags.includes(tag)) return false
      if (!q) return true
      return [
        row.title,
        row.altText,
        row.originalFilename,
        row.gigTitle || '',
        row.venueName || '',
        row.tags.join(' '),
      ].some(value => value.toLowerCase().includes(q))
    })
    .map(row => ({
      ...row,
      hasThumbnail: Boolean(row.hasThumbnail),
      url: `/api/media/${row.id}`,
      thumbnailUrl: row.hasThumbnail || mediaKindFromMime(row.mimeType) === 'image' ? `/api/media/${row.id}?variant=thumb` : null,
    }))

  const gigOptions = await db.select({ id: gigs.id, title: gigTitleSql() }).from(gigs).orderBy(desc(gigs.startsAt)).limit(250)
  const venueOptions = await db.select({ id: venues.id, name: venues.name }).from(venues).orderBy(venues.name).limit(250)
  return { assets, options: { gigs: gigOptions, venues: venueOptions } }
})
