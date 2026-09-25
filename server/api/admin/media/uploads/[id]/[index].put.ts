import type { H3Event } from 'h3'
import { requireStaff } from '../../../../../utils/require-staff'
import {
  readMediaUploadSession,
  writeMediaUploadChunk,
} from '../../../../../utils/media-upload-sessions'

async function readChunk(event: H3Event, maxBytes: number) {
  const chunks: Buffer[] = []
  let total = 0
  for await (const value of event.node.req) {
    const chunk = Buffer.isBuffer(value) ? value : Buffer.from(value)
    total += chunk.byteLength
    if (total > maxBytes) throw createError({ statusCode: 413, statusMessage: 'Chunk is te groot' })
    chunks.push(chunk)
  }
  return Buffer.concat(chunks, total)
}

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const uploadId = getRouterParam(event, 'id') || ''
  const index = Number(getRouterParam(event, 'index'))
  const session = await readMediaUploadSession(uploadId)
  const data = await readChunk(event, session.chunkSize)
  await writeMediaUploadChunk(session, index, data)
  event.node.res.statusCode = 204
  return null
})
