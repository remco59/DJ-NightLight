import { requireStaff } from '../../../../utils/require-staff'
import {
  listUploadedChunkIndexes,
  readMediaUploadSession,
} from '../../../../utils/media-upload-sessions'
import { requireUuidParam } from '../../../../utils/route-params'

export default defineEventHandler(async (event) => {
  await requireStaff(event, ['owner', 'manager', 'content_editor'])
  const uploadId = requireUuidParam(event, 'id')
  const session = await readMediaUploadSession(uploadId)
  return {
    uploadId: session.id,
    byteSize: session.byteSize,
    chunkSize: session.chunkSize,
    chunkCount: session.chunkCount,
    uploaded: await listUploadedChunkIndexes(session),
  }
})
