import { shouldChunkMediaUpload } from '~~/shared/media-upload'

export const MAX_MEDIA_UPLOAD_BYTES = 15 * 1024 * 1024
export const MAX_MEDIA_IMAGE_DIMENSION = 12000
export const MAX_MEDIA_IMAGE_PIXELS = 80_000_000

const allowedImageTypes = new Set(['image/jpeg', 'image/png', 'image/webp'])

export async function createMediaThumbnail(file: File) {
  if (!file.size) throw new Error('Het afbeeldingsbestand is leeg.')
  if (file.size > MAX_MEDIA_UPLOAD_BYTES) throw new Error('Een afbeelding mag maximaal 15 MB zijn.')
  if (file.type && !allowedImageTypes.has(file.type)) {
    throw new Error('Alleen JPEG-, PNG- en WebP-afbeeldingen worden ondersteund.')
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    throw new Error('Deze afbeelding kan niet worden gelezen. Gebruik een geldig JPEG-, PNG- of WebP-bestand.')
  }

  try {
    if (
      bitmap.width > MAX_MEDIA_IMAGE_DIMENSION
      || bitmap.height > MAX_MEDIA_IMAGE_DIMENSION
      || bitmap.width * bitmap.height > MAX_MEDIA_IMAGE_PIXELS
    ) {
      throw new Error('De afmetingen van de afbeelding zijn te groot.')
    }

    const max = 480
    const scale = Math.min(1, max / bitmap.width, max / bitmap.height)
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Thumbnail maken is niet gelukt.')

    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        blob => blob ? resolve(blob) : reject(new Error('Thumbnail opslaan is niet gelukt.')),
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
    element.onerror = () => reject(new Error('Deze browser kan dit bestand niet afspelen. Gebruik H.264 MP4- / WebM-video of MP3- / M4A- / WAV-audio.'))
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
  if (file.size > limit) throw new Error(isAudio ? 'Audio mag maximaal 50 MB zijn.' : 'Een video mag maximaal 250 MB zijn.')

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
    if (!Number.isFinite(video.duration) || !video.videoWidth) throw new Error('Deze browser kan deze video niet afspelen. Gebruik een H.264 MP4- of WebM-bestand.')
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

type ChunkUploadSession = {
  uploadId: string
  byteSize: number
  chunkSize: number
  chunkCount: number
  uploaded: number[]
}

function resumableStorageKey(file: File) {
  return `nightlight:media-upload:${file.name}:${file.size}:${file.lastModified}`
}

async function responseError(response: Response, fallback: string) {
  try {
    const body = await response.json() as { statusMessage?: string, message?: string }
    return new Error(body.statusMessage || body.message || fallback)
  } catch {
    return new Error(fallback)
  }
}

async function thumbnailAsBase64(blob: Blob | null) {
  if (!blob) return null
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let binary = ''
  const stride = 0x8000
  for (let offset = 0; offset < bytes.length; offset += stride) {
    binary += String.fromCharCode(...bytes.subarray(offset, Math.min(bytes.length, offset + stride)))
  }
  return btoa(binary)
}

async function chunkSession(file: File): Promise<ChunkUploadSession> {
  const key = resumableStorageKey(file)
  const stored = localStorage.getItem(key)
  if (stored) {
    try {
      const response = await fetch(`/api/admin/media/uploads/${encodeURIComponent(stored)}`)
      if (response.ok) return await response.json() as ChunkUploadSession
    } catch {
      // Fall through to a new session; an interrupted network should not make uploads unusable.
    }
    localStorage.removeItem(key)
  }

  const response = await fetch('/api/admin/media/uploads', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ filename: file.name, byteSize: file.size }),
  })
  if (!response.ok) throw await responseError(response, `Upload starten mislukt (HTTP ${response.status}).`)
  const session = await response.json() as ChunkUploadSession
  localStorage.setItem(key, session.uploadId)
  return session
}

async function putChunk(session: ChunkUploadSession, index: number, blob: Blob) {
  let lastError: Error | null = null
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(
        `/api/admin/media/uploads/${encodeURIComponent(session.uploadId)}/${index}`,
        { method: 'PUT', headers: { 'content-type': 'application/octet-stream' }, body: blob },
      )
      if (response.ok) return
      lastError = await responseError(response, `Chunk ${index + 1} uploaden mislukt (HTTP ${response.status}).`)
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Netwerkfout tijdens chunk-upload.')
    }
  }
  throw lastError || new Error('Chunk uploaden mislukt.')
}

async function uploadMediaFileChunked(
  file: File,
  fields: MediaUploadFields,
  onProgress?: (fraction: number) => void,
) {
  const probe = await probeTimedMedia(file)
  const session = await chunkSession(file)
  if (session.byteSize !== file.size) throw new Error('De hervatte upload hoort bij een ander bestand.')

  const uploaded = new Set(session.uploaded)
  let uploadedBytes = [...uploaded].reduce((sum, index) => {
    const start = index * session.chunkSize
    return sum + Math.max(0, Math.min(file.size, start + session.chunkSize) - start)
  }, 0)
  onProgress?.(uploadedBytes / file.size)

  for (let index = 0; index < session.chunkCount; index += 1) {
    if (uploaded.has(index)) continue
    const start = index * session.chunkSize
    const end = Math.min(file.size, start + session.chunkSize)
    await putChunk(session, index, file.slice(start, end))
    uploadedBytes += end - start
    onProgress?.(Math.min(0.98, uploadedBytes / file.size * 0.98))
  }

  const response = await fetch(
    `/api/admin/media/uploads/${encodeURIComponent(session.uploadId)}/complete`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        title: fields.title ?? file.name.replace(/\.[^.]+$/, ''),
        altText: fields.altText || '',
        tags: fields.tags || '',
        gigId: fields.gigId || '',
        venueId: fields.venueId || '',
        parentAssetId: fields.parentAssetId || '',
        variantLabel: fields.variantLabel || '',
        collectionIds: fields.collectionIds || [],
        source: fields.source || '',
        sourceUrl: fields.sourceUrl || '',
        metadata: probe.metadata,
        thumbnailBase64: await thumbnailAsBase64(probe.thumbnail),
      }),
    },
  )
  if (!response.ok) throw await responseError(response, `Upload afronden mislukt (HTTP ${response.status}).`)
  localStorage.removeItem(resumableStorageKey(file))
  onProgress?.(1)
  return await response.json() as { asset: { id: string } }
}

/** Uploads any supported image, video or audio file to the media library. */
export async function uploadMediaFile(
  file: File,
  fields: MediaUploadFields = {},
  onProgress?: (fraction: number) => void,
) {
  const problem = checkMediaFile(file)
  if (problem) throw new Error(problem)
  if (shouldChunkMediaUpload(file.size)) return await uploadMediaFileChunked(file, fields, onProgress)
  return await sendMediaUpload<{ asset: { id: string } }>(await buildMediaUploadForm(file, fields), onProgress)
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
  if (!file.size) return 'Dit bestand is leeg.'
  if (file.type.startsWith('image/')) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'Alleen JPEG-, PNG- en WebP-afbeeldingen worden ondersteund.'
    if (file.size > MAX_MEDIA_UPLOAD_BYTES) return 'Een afbeelding mag maximaal 15 MB zijn.'
    return null
  }
  const isAudio = file.type.startsWith('audio/') || /\.(mp3|m4a|wav|ogg)$/i.test(file.name)
  const isVideo = file.type.startsWith('video/') || /\.(mp4|mov|webm)$/i.test(file.name)
  if (!isAudio && !isVideo) return 'Gebruik JPEG, PNG, WebP, MP4, MOV, WebM, MP3, M4A, WAV of OGG.'
  if (isVideo && file.size > MAX_VIDEO_UPLOAD_BYTES) return 'Een video mag maximaal 250 MB zijn.'
  if (isAudio && file.size > MAX_AUDIO_UPLOAD_BYTES) return 'Audio mag maximaal 50 MB zijn.'
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
      else reject(new Error(body?.statusMessage || body?.message || `Uploaden mislukt (HTTP ${request.status}).`))
    }
    request.onerror = () => reject(new Error('Netwerkfout tijdens het uploaden. Controleer je verbinding en probeer het opnieuw.'))
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
    throw new Error('Vul een volledige URL in die begint met https://')
  }
  if (!/^https?:$/.test(parsed.protocol)) throw new Error('Alleen http- en https-links worden ondersteund.')
  let response: Response
  try {
    response = await fetch(parsed, { mode: 'cors', credentials: 'omit' })
  } catch {
    throw new Error('Deze site staat downloaden vanuit NightLight niet toe. Sla het bestand op en upload het.')
  }
  if (!response.ok) throw new Error(`De link gaf HTTP ${response.status} terug.`)
  const blob = await response.blob()
  const name = decodeURIComponent(parsed.pathname.split('/').filter(Boolean).pop() || 'remote-media')
  const extension = blob.type.split('/')[1]?.replace('jpeg', 'jpg').replace('quicktime', 'mov').replace('mpeg', 'mp3')
  const filename = /\.[a-z0-9]{2,5}$/i.test(name) || !extension ? name : `${name}.${extension}`
  return new File([blob], filename, { type: blob.type })
}
