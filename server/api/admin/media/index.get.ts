import { desc } from 'drizzle-orm'
import { gigs, venues } from '../../../../db/schema'
import type { MediaLibraryResponse } from '../../../../shared/media-library'
import { db } from '../../../utils/db'
import { listMediaCollections, listMediaLibrary } from '../../../utils/media-library'
import { requireStaff } from '../../../utils/require-staff'
import { gigTitleSql } from '../../../utils/gig-title'

export default defineEventHandler(async (event): Promise<MediaLibraryResponse> => {
  await requireStaff(event)
  const query = getQuery(event)
  const q = String(query.q || '').trim().toLowerCase()
  const tag = String(query.tag || '').trim().toLowerCase()
  // Image pickers across the back office only understand images; the library
  // and the video editor ask for everything with ?kind=all.
  const kind = String(query.kind || 'image')

  const everything = await listMediaLibrary()
  const assets = everything.filter((asset) => {
    if (kind !== 'all' && !asset.mimeType.startsWith(`${kind}/`)) return false
    if (tag && !asset.tags.includes(tag)) return false
    if (!q) return true
    return [
      asset.title,
      asset.altText,
      asset.originalFilename,
      asset.gigTitle || '',
      asset.venueName || '',
      asset.tags.join(' '),
    ].some(value => value.toLowerCase().includes(q))
  })

  const gigOptions = await db.select({ id: gigs.id, title: gigTitleSql(), startsAt: gigs.startsAt }).from(gigs).orderBy(desc(gigs.startsAt)).limit(250)
  const venueOptions = await db.select({ id: venues.id, name: venues.name }).from(venues).orderBy(venues.name).limit(250)
  return {
    assets,
    collections: await listMediaCollections(everything),
    options: {
      gigs: gigOptions.map(gig => ({ ...gig, startsAt: gig.startsAt?.toISOString() || null })),
      venues: venueOptions,
    },
  }
})
