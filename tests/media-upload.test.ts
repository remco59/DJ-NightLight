import { describe, expect, it } from 'vitest'
import {
  MEDIA_UPLOAD_CHUNK_BYTES,
  MEDIA_UPLOAD_CHUNK_THRESHOLD_BYTES,
  mediaUploadChunkCount,
  shouldChunkMediaUpload,
} from '../shared/media-upload'

describe('chunked media upload policy', () => {
  it('keeps normal uploads on the existing multipart path', () => {
    expect(shouldChunkMediaUpload(MEDIA_UPLOAD_CHUNK_THRESHOLD_BYTES)).toBe(false)
    expect(shouldChunkMediaUpload(MEDIA_UPLOAD_CHUNK_THRESHOLD_BYTES + 1)).toBe(true)
  })

  it('uses 8 MB chunks and rounds the final chunk up', () => {
    expect(MEDIA_UPLOAD_CHUNK_BYTES).toBe(8 * 1024 * 1024)
    expect(mediaUploadChunkCount(116 * 1024 * 1024)).toBe(15)
    expect(mediaUploadChunkCount(MEDIA_UPLOAD_CHUNK_BYTES)).toBe(1)
    expect(mediaUploadChunkCount(MEDIA_UPLOAD_CHUNK_BYTES + 1)).toBe(2)
  })

  it('handles empty or invalid sizes safely', () => {
    expect(mediaUploadChunkCount(0)).toBe(0)
    expect(mediaUploadChunkCount(-1)).toBe(0)
    expect(mediaUploadChunkCount(Number.NaN)).toBe(0)
  })
})
