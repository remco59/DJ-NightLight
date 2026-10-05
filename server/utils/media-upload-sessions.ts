import { randomUUID } from 'node:crypto'
import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import {
  MEDIA_UPLOAD_CHUNK_BYTES,
  MEDIA_UPLOAD_SESSION_MAX_AGE_MS,
  mediaUploadChunkCount,
} from '../../shared/media-upload'
import { MAX_VIDEO_BYTES } from './media-library'

export type MediaUploadSession = {
  id: string
  filename: string
  byteSize: number
  chunkSize: number
  chunkCount: number
  createdAt: string
}

const ID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function uploadsRoot() {
  const config = useRuntimeConfig()
  return resolve(String(config.storageUploads), '.chunk-uploads')
}

function sessionDir(id: string) {
  if (!ID_PATTERN.test(id)) throw createError({ statusCode: 400, statusMessage: 'Ongeldige upload-ID' })
  return join(uploadsRoot(), id)
}

function manifestPath(id: string) {
  return join(sessionDir(id), 'manifest.json')
}

function chunkPath(id: string, index: number) {
  return join(sessionDir(id), `chunk-${String(index).padStart(6, '0')}.bin`)
}

export async function cleanupStaleMediaUploadSessions() {
  const root = uploadsRoot()
  let ids: string[]
  try {
    ids = await readdir(root)
  } catch {
    return
  }
  const cutoff = Date.now() - MEDIA_UPLOAD_SESSION_MAX_AGE_MS
  await Promise.all(ids.filter(id => ID_PATTERN.test(id)).map(async (id) => {
    try {
      const info = await stat(manifestPath(id))
      if (info.mtimeMs < cutoff) await rm(sessionDir(id), { recursive: true, force: true })
    } catch {
      // A concurrently completed/removed session is harmless.
    }
  }))
}

export async function createMediaUploadSession(filename: string, byteSize: number) {
  if (!Number.isInteger(byteSize) || byteSize <= 0 || byteSize > MAX_VIDEO_BYTES) {
    throw createError({ statusCode: 422, statusMessage: 'Bestandsgrootte is ongeldig of groter dan 250 MB' })
  }
  const id = randomUUID()
  const session: MediaUploadSession = {
    id,
    filename: filename.slice(0, 255) || 'media',
    byteSize,
    chunkSize: MEDIA_UPLOAD_CHUNK_BYTES,
    chunkCount: mediaUploadChunkCount(byteSize),
    createdAt: new Date().toISOString(),
  }
  await mkdir(sessionDir(id), { recursive: true })
  await writeFile(manifestPath(id), JSON.stringify(session), { flag: 'wx' })
  return session
}

export async function readMediaUploadSession(id: string) {
  let raw: string
  try {
    raw = await readFile(manifestPath(id), 'utf8')
  } catch {
    throw createError({ statusCode: 404, statusMessage: 'Uploadsessie bestaat niet meer' })
  }
  const session = JSON.parse(raw) as MediaUploadSession
  if (!session.id || session.id !== id || !session.chunkCount || session.chunkSize !== MEDIA_UPLOAD_CHUNK_BYTES) {
    throw createError({ statusCode: 409, statusMessage: 'Uploadsessie is beschadigd' })
  }
  if (Date.now() - Date.parse(session.createdAt) > MEDIA_UPLOAD_SESSION_MAX_AGE_MS) {
    await removeMediaUploadSession(id)
    throw createError({ statusCode: 410, statusMessage: 'Uploadsessie is verlopen' })
  }
  return session
}

export async function listUploadedChunkIndexes(session: MediaUploadSession) {
  const files = await readdir(sessionDir(session.id))
  return files.flatMap((name) => {
    const match = /^chunk-(\d{6})\.bin$/.exec(name)
    if (!match) return []
    const index = Number(match[1])
    return index >= 0 && index < session.chunkCount ? [index] : []
  }).sort((a, b) => a - b)
}

export async function writeMediaUploadChunk(session: MediaUploadSession, index: number, data: Uint8Array) {
  if (!Number.isInteger(index) || index < 0 || index >= session.chunkCount) {
    throw createError({ statusCode: 422, statusMessage: 'Ongeldig chunknummer' })
  }
  const expected = index === session.chunkCount - 1
    ? session.byteSize - (session.chunkSize * index)
    : session.chunkSize
  if (data.byteLength !== expected) {
    throw createError({
      statusCode: 422,
      statusMessage: `Chunk heeft ${data.byteLength} bytes; verwacht ${expected}`,
    })
  }
  const target = chunkPath(session.id, index)
  const temp = `${target}.${randomUUID()}.tmp`
  await writeFile(temp, data, { flag: 'wx' })
  await rename(temp, target)
}

export async function assembleMediaUpload(session: MediaUploadSession) {
  const present = new Set(await listUploadedChunkIndexes(session))
  if (present.size !== session.chunkCount) {
    throw createError({ statusCode: 409, statusMessage: 'Nog niet alle chunks zijn ontvangen' })
  }
  const chunks: Buffer[] = []
  let total = 0
  for (let index = 0; index < session.chunkCount; index += 1) {
    const chunk = await readFile(chunkPath(session.id, index))
    total += chunk.byteLength
    if (total > session.byteSize) throw createError({ statusCode: 409, statusMessage: 'Upload is groter dan verwacht' })
    chunks.push(chunk)
  }
  if (total !== session.byteSize) throw createError({ statusCode: 409, statusMessage: 'Upload is niet compleet' })
  return Buffer.concat(chunks, total)
}

export async function removeMediaUploadSession(id: string) {
  await rm(sessionDir(id), { recursive: true, force: true })
}
