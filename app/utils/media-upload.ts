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

export const MAX_VIDEO_UPLOAD_BYTES = 250 * 1024 * 1024
export const MAX_AUDIO_UPLOAD_BYTES = 50 * 1024 * 1024

export type TimedMediaProbe = {
  metadata: {
    durationMs: number
    width: number
    height: number
    hasAudio?: boolean
    peaks?: number[]
  }
  thumbnail: Blob | null
}

function loadMediaElement<T extends HTMLMediaElement>(element: T, url: string) {
  return new Promise<T>((resolve, reject) => {
    element.preload = 'auto'
    element.muted = true
    element.onloadeddata = () => resolve(element)
    element.onerror = () => reject(new Error('This browser cannot decode this file. Use H.264 MP4 / WebM video or MP3 / M4A / WAV audio.'))
    element.src = url
  })
}

async function videoPoster(video: HTMLVideoElement) {
  const at = Math.min(0.5, (video.duration || 1) / 2)
  await new Promise<void>((resolve) => {
    video.onseeked = () => resolve()
    video.currentTime = at
  })
  const max = 480
  const scale = Math.min(1, max / video.videoWidth, max / video.videoHeight)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(video.videoWidth * scale))
  canvas.height = Math.max(1, Math.round(video.videoHeight * scale))
  canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
  return await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', .8))
}

/** Normalised peak amplitudes for drawing timeline waveforms. */
export function audioPeaks(channel: Float32Array, buckets = 240) {
  const size = Math.max(1, Math.floor(channel.length / buckets))
  const peaks: number[] = []
  for (let bucket = 0; bucket < buckets; bucket++) {
    let peak = 0
    const start = bucket * size
    for (let index = start; index < Math.min(channel.length, start + size); index += 16) {
      peak = Math.max(peak, Math.abs(channel[index]!))
    }
    peaks.push(peak)
  }
  const loudest = Math.max(0.0001, ...peaks)
  return peaks.map(value => Math.round(value / loudest * 1000) / 1000)
}

/**
 * Reads duration, dimensions, a poster frame and waveform peaks in the
 * browser before upload; the server has no media probing tools.
 */
export async function probeTimedMedia(file: File): Promise<TimedMediaProbe> {
  const isAudio = file.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg)$/i.test(file.name)
  const limit = isAudio ? MAX_AUDIO_UPLOAD_BYTES : MAX_VIDEO_UPLOAD_BYTES
  if (file.size > limit) throw new Error(isAudio ? 'Audio must be 50 MB or smaller.' : 'Video must be 250 MB or smaller.')

  const url = URL.createObjectURL(file)
  try {
    if (isAudio) {
      const audio = await loadMediaElement(document.createElement('audio'), url)
      let peaks: number[] | undefined
      try {
        const context = new AudioContext()
        const buffer = await context.decodeAudioData(await file.arrayBuffer())
        peaks = audioPeaks(buffer.getChannelData(0))
        await context.close()
      } catch {
        peaks = undefined
      }
      return {
        metadata: { durationMs: Math.round(audio.duration * 1000), width: 0, height: 0, peaks },
        thumbnail: null,
      }
    }

    const video = await loadMediaElement(document.createElement('video'), url)
    if (!Number.isFinite(video.duration) || !video.videoWidth) throw new Error('This browser cannot decode this video. Use an H.264 MP4 or WebM file.')
    const thumbnail = await videoPoster(video).catch(() => null)
    return {
      metadata: {
        durationMs: Math.round(video.duration * 1000),
        width: video.videoWidth,
        height: video.videoHeight,
      },
      thumbnail,
    }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Uploads any supported image, video or audio file to the media library. */
export async function uploadMediaFile(file: File, fields: MediaUploadFields = {}) {
  return await $fetch<{ asset: { id: string } }>('/api/admin/media', { method: 'POST', body: await buildMediaUploadForm(file, fields) })
}

export type MediaUploadFields = {
  title?: string
  altText?: string
  tags?: string
  gigId?: string
  venueId?: string
  parentAssetId?: string
  variantLabel?: string
  collectionIds?: string[]
  source?: 'upload' | 'url' | 'derived'
  sourceUrl?: string
}

export const ACCEPTED_MEDIA_TYPES = 'image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm,audio/mpeg,audio/mp4,audio/wav,audio/ogg,.mov,.m4a'

/** Rejects files the library cannot store before any bytes are sent. */
export function checkMediaFile(file: File) {
  if (!file.size) return 'This file is empty.'
  if (file.type.startsWith('image/')) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Only JPEG, PNG and WebP images are supported.'
    if (file.size > MAX_MEDIA_UPLOAD_BYTES) return 'Images must be 15 MB or smaller.'
    return null
  }
  const isAudio = file.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg)$/i.test(file.name)
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name)
  if (!isAudio && !isVideo) return 'Use JPEG, PNG, WebP, MP4, MOV, WebM, MP3, M4A, WAV or OGG.'
  if (isVideo && file.size > MAX_VIDEO_UPLOAD_BYTES) return 'Videos must be 250 MB or smaller.'
  if (isAudio && file.size > MAX_AUDIO_UPLOAD_BYTES) return 'Audio must be 50 MB or smaller.'
  return null
}

/** Builds the multipart body the media endpoint expects, including the thumbnail and probed metadata. */
export async function buildMediaUploadForm(file: File, fields: MediaUploadFields = {}) {
  const problem = checkMediaFile(file)
  if (problem) throw new Error(problem)
  const form = new FormData()
  form.append('file', file)
  form.append('title', fields.title ?? file.name.replace(/\.[^.]+$/, ''))
  form.append('altText', fields.altText || '')
  form.append('tags', fields.tags || '')
  form.append('gigId', fields.gigId || '')
  form.append('venueId', fields.venueId || '')
  form.append('parentAssetId', fields.parentAssetId || '')
  form.append('variantLabel', fields.variantLabel || '')
  form.append('collectionIds', (fields.collectionIds || []).join(','))
  form.append('source', fields.source || '')
  form.append('sourceUrl', fields.sourceUrl || '')
  if (file.type.startsWith('image/')) {
    form.append('thumbnail', await createMediaThumbnail(file), 'thumbnail.jpg')
  } else {
    const probe = await probeTimedMedia(file)
    form.append('metadata', JSON.stringify(probe.metadata))
    if (probe.thumbnail) form.append('thumbnail', probe.thumbnail, 'thumbnail.jpg')
  }
  return form
}

/**
 * Posts an upload with XMLHttpRequest so the caller can show byte progress
 * ($fetch has no upload progress events).
 */
export function sendMediaUpload<T = { asset: { id: string } }>(form: FormData, onProgress?: (fraction: number) => void) {
  return new Promise<T>((resolve, reject) => {
    const request = new XMLHttpRequest()
    request.open('POST', '/api/admin/media')
    request.responseType = 'json'
    request.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(event.loaded / event.total)
    }
    request.onload = () => {
      const body = request.response as { statusMessage?: string, message?: string } | null
      if (request.status >= 200 && request.status < 300) resolve(body as T)
      else reject(new Error(body?.statusMessage || body?.message || `Upload failed (HTTP ${request.status}).`))
    }
    request.onerror = () => reject(new Error('Network error while uploading. Check your connection and try again.'))
    request.send(form)
  })
}

/**
 * Fetches a remote file in the browser so it goes through the same validation
 * as a manual upload. Only works for hosts that allow cross-origin downloads.
 */
export async function fetchRemoteMedia(url: string) {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    throw new Error('Enter a full URL starting with https://')
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('Only http and https links are supported.')
  let response: Response
  try {
    response = await fetch(parsed, { mode: 'cors', credentials: 'omit' })
  } catch {
    throw new Error('This site does not allow downloads from NightLight. Save the file and upload it instead.')
  }
  if (!response.ok) throw new Error(`The link returned HTTP ${response.status}.`)
  const blob = await response.blob()
  const name = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || 'remote-media')
  const extension = blob.type.split('/')[1]?.replace('jpeg', 'jpg').replace('quicktime', 'mov').replace('mpeg', 'mp3')
  const filename = /\.[a-z0-9]{2,5}$/i.test(name) || !extension ? name : `${name}.${extension}`
  return new File([blob], filename, { type: blob.type })
}
