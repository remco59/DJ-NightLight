export const MAX_MEDIA_UPLOAD_BYTES = 15 * 1024 * 1024
export const MAX_MEDIA_IMAGE_DIMENSION = 12000
export const MAX_MEDIA_IMAGE_PIXELS = 80_000_000

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function createMediaThumbnail(file: File) {
  if (!file.size) throw new Error('Image file is empty.')
  if (file.size > MAX_MEDIA_UPLOAD_BYTES) throw new Error('Image must be 15 MB or smaller.')
  if (file.type && !allowedImageTypes.has(file.type)) {
    throw new Error('Only JPEG, PNG and WebP images are supported.')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('Could not read this image. Use a valid JPEG, PNG or WebP file.')
  }

  try {
    if (
      bitmap.width > MAX_MEDIA_IMAGE_DIMENSION
      || bitmap.height > MAX_MEDIA_IMAGE_DIMENSION
      || bitmap.width * bitmap.height > MAX_MEDIA_IMAGE_PIXELS
    ) {
      throw new Error('Image dimensions are too large.')
    }

    const max = 480
    const scale = Math.min(1, max / bitmap.width, max / bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Could not create image thumbnail.')

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Could not encode image thumbnail.')),
        'image/jpeg',
        .82,
      )
    })
  } finally {
    bitmap.close()
  }
}
