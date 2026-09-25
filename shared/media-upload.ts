export const MEDIA_UPLOAD_CHUNK_BYTES = 8 * 1024 * 1024
export const MEDIA_UPLOAD_CHUNK_THRESHOLD_BYTES = 64 * 1024 * 1024
export const MEDIA_UPLOAD_SESSION_MAX_AGE_MS = 24 * 60 * 60 * 1000

export function mediaUploadChunkCount(byteSize: number, chunkSize = MEDIA_UPLOAD_CHUNK_BYTES) {
  if (!Number.isFinite(byteSize) || byteSize <= 0) return 0
  return Math.ceil(byteSize / chunkSize)
}

export function shouldChunkMediaUpload(byteSize: number) {
  return byteSize > MEDIA_UPLOAD_CHUNK_THRESHOLD_BYTES
}
