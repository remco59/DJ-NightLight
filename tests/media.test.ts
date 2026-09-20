import { describe, expect, it } from 'vitest'
import { inspectImage, normalizeTags } from '../shared/media'

describe('media validation', () => {
  it('reads PNG dimensions from the file signature instead of trusting MIME metadata', () => {
    const png = new Uint8Array(24)
    png.set([0x89, 0x50, 0x4e, 0x47], 0)
    png.set([0x49, 0x48, 0x44, 0x52], 12)
    new DataView(png.buffer).setUint32(16, 1920)
    new DataView(png.buffer).setUint32(20, 1080)
    expect(inspectImage(png)).toEqual({ mimeType: 'image/png', extension: 'png', width: 1920, height: 1080 })
  })

  it('rejects files that only claim to be images', () => {
    expect(() => inspectImage(new TextEncoder().encode('not an image at all, despite its filename.jpg'))).toThrow()
  })

  it('normalizes and deduplicates tags', () => {
    expect(normalizeTags('Wedding, Party, wedding,  ')).toEqual(['wedding', 'party'])
  })
})
