export type ImageInfo = {
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
  extension: 'jpg' | 'png' | 'webp'
  width: number
  height: number
}

function readUInt24LE(buffer: Uint8Array, offset: number) {
  return buffer[offset]! | (buffer[offset + 1]! << 8) | (buffer[offset + 2]! << 16)
}

export function inspectImage(buffer: Uint8Array): ImageInfo {
  if (buffer.length < 24) throw new Error('Image is too small')

  if (
    buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47
    && buffer[12] === 0x49 && buffer[13] === 0x48 && buffer[14] === 0x44 && buffer[15] === 0x52
  ) {
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength)
    const width = view.getUint32(16)
    const height = view.getUint32(20)
    if (!width || !height) throw new Error('Invalid PNG dimensions')
    return { mimeType: 'image/png', extension: 'png', width, height }
  }

  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    let offset = 2
    while (offset + 9 < buffer.length) {
      if (buffer[offset] !== 0xff) { offset += 1; continue }
      const marker = buffer[offset + 1]!
      offset += 2
      if (marker === 0xd8 || marker === 0xd9) continue
      if (offset + 2 > buffer.length) break
      const length = (buffer[offset]! << 8) | buffer[offset + 1]!
      if (length < 2 || offset + length > buffer.length) break
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
        const height = (buffer[offset + 3]! << 8) | buffer[offset + 4]!
        const width = (buffer[offset + 5]! << 8) | buffer[offset + 6]!
        if (!width || !height) throw new Error('Invalid JPEG dimensions')
        return { mimeType: 'image/jpeg', extension: 'jpg', width, height }
      }
      offset += length
    }
    throw new Error('JPEG dimensions could not be read')
  }

  const ascii = (start: number, length: number) => String.fromCharCode(...buffer.slice(start, start + length))
  if (ascii(0, 4) === 'RIFF' && ascii(8, 4) === 'WEBP') {
    const chunk = ascii(12, 4)
    if (chunk === 'VP8X' && buffer.length >= 30) {
      return {
        mimeType: 'image/webp',
        extension: 'webp',
        width: readUInt24LE(buffer, 24) + 1,
        height: readUInt24LE(buffer, 27) + 1,
      }
    }
    if (chunk === 'VP8L' && buffer.length >= 25 && buffer[20] === 0x2f) {
      const b1 = buffer[21]!, b2 = buffer[22]!, b3 = buffer[23]!, b4 = buffer[24]!
      return {
        mimeType: 'image/webp',
        extension: 'webp',
        width: 1 + (((b2 & 0x3f) << 8) | b1),
        height: 1 + (((b4 & 0x0f) << 10) | (b3 << 2) | ((b2 & 0xc0) >> 6)),
      }
    }
    if (chunk === 'VP8 ' && buffer.length >= 30 && buffer[23] === 0x9d && buffer[24] === 0x01 && buffer[25] === 0x2a) {
      return {
        mimeType: 'image/webp',
        extension: 'webp',
        width: (buffer[26]! | (buffer[27]! << 8)) & 0x3fff,
        height: (buffer[28]! | (buffer[29]! << 8)) & 0x3fff,
      }
    }
    throw new Error('Unsupported WebP encoding')
  }

  throw new Error('Only JPEG, PNG and WebP images are supported')
}

export function normalizeTags(value: string | string[]) {
  const raw = Array.isArray(value) ? value : value.split(',')
  return [...new Set(raw.map(tag => tag.trim().toLowerCase()).filter(Boolean))].slice(0, 30)
}

export function mediaUrl(id: string, variant: 'original' | 'thumb' = 'original') {
  return `/api/media/${id}${variant === 'thumb' ? '?variant=thumb' : ''}`
}
