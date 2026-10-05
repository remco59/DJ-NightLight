import { z } from 'zod'
import { requireStaff } from '../../../../utils/require-staff'
import {
  cleanupStaleMediaUploadSessions,
  createMediaUploadSession,
} from '../../../../utils/media-upload-sessions'

const bodySchema = z.object({
  filename: z.string().min(1).max(255),
  byteSize: z.number().int().positive(),
})

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const parsed = bodySchema.safeParse(await readBody(event))
  if (!parsed.success) throw createError({ statusCode: 422, statusMessage: 'Ongeldige uploadgegevens' })

  await cleanupStaleMediaUploadSessions().catch(() => undefined)
  const session = await createMediaUploadSession(parsed.data.filename, parsed.data.byteSize)
  event.node.res.statusCode = 201
  return {
    uploadId: session.id,
    byteSize: session.byteSize,
    chunkSize: session.chunkSize,
    chunkCount: session.chunkCount,
    uploaded: [] as number[],
  }
})
