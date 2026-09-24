import { inArray } from 'drizzle-orm'
import { z } from 'zod'
import { mediaAssets } from '../../../../db/schema'
import { db } from '../../../utils/db'
import { getMediaStorage } from '../../../utils/media-storage'
import { requireStaff } from '../../../utils/require-staff'
import { uniqueZipNames, writeStoredZip } from '../../../utils/zip'

const MAX_ARCHIVE_BYTES = 1024 * 1024 * 1024

const idsSchema = z.string()
  .transform(value => [...new Set(value.split(',').map(id => id.trim()).filter(Boolean))])
  .pipe(z.array(z.string().uuid()).min(1).max(200))

/** Streams the selected originals as one stored ZIP archive. */
export default defineEventHandler(async (event) => {
  await requireStaff(event)
  const parsed = idsSchema.safeParse(String(getQuery(event).ids || ''))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Select between 1 and 200 media items' })

  const rows = await db.select().from(mediaAssets).where(inArray(mediaAssets.id, parsed.data))
  if (!rows.length) throw createError({ statusCode: 404, statusMessage: 'Media assets not found' })
  if (rows.reduce((total, row) => total + row.byteSize, 0) > MAX_ARCHIVE_BYTES) {
    throw createError({ statusCode: 413, statusMessage: 'Selection is larger than 1 GB; download fewer items at once' })
  }

  const storage = getMediaStorage()
  const names = uniqueZipNames(rows.map(row => row.originalFilename))
  const stamp = new Date().toISOString().slice(0, 10)
  const response = event.node.res
  response.statusCode = 200
  response.setHeader('content-type', 'application/zip')
  response.setHeader('content-disposition', `attachment; filename="nightlight-media-${stamp}.zip"`)
  response.setHeader('cache-control', 'no-store')

  async function* entries() {
    for (const [index, row] of rows.entries()) {
      try {
        yield { name: names[index]!, data: await storage.read(row.storageKey), modifiedAt: row.createdAt }
      } catch {
        // A missing file on disk should not abort the rest of the archive.
      }
    }
  }

  await writeStoredZip(entries(), chunk => new Promise<void>((resolve, reject) => {
    response.write(chunk, error => error ? reject(error) : resolve())
  }))
  response.end()
})
