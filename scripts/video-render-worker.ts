import { createReadStream } from 'node:fs'
import { readFile, mkdir, realpath, rm, stat } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { bundle } from '@remotion/bundler'
import { makeCancelSignal, renderMedia, renderStill, selectComposition, type CancelSignal } from '@remotion/renderer'
import type { VideoDesign } from '../shared/video-generator'
import { RENDER_ENGINE_LABELS, parseRenderEngineSetting, resolveRenderEngine } from '../shared/render-engine'
import { detectRenderCapabilities, renderOptionsFor, type RenderCapabilities } from './render-engine'
import { ensureVideoRenderProxy } from './render-proxy'
import {
  collectProjectAssetIds,
  parseVideoProject,
  projectThumbnailFrame,
  type ProjectAssetMap,
  type VideoProject,
} from '../shared/video-project'

const connectionString = process.env.DATABASE_URL
const uploadsRoot = process.env.STORAGE_UPLOADS || '/app/storage/uploads'
// Read-only server media folder whose files are linked in place (`library:<path>` keys).
const libraryRoot = process.env.STORAGE_LIBRARY || ''
const LIBRARY_KEY_PREFIX = 'library:'
const generatedRoot = process.env.STORAGE_GENERATED || '/app/storage/generated'
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE

if (!connectionString) throw new Error('DATABASE_URL is required')

const sql = postgres(connectionString, { max: 1, prepare: false })
let stopping = false
let capabilities: RenderCapabilities = { engines: [] }

const CAPABILITY_REFRESH_MS = 60_000
const CANCEL_POLL_MS = 2000
// Remotion's default is 30s; software-rendered motion blur and large source videos can exceed that on a frame.
const DELAY_RENDER_TIMEOUT_MS = Math.max(30_000, Number(process.env.REMOTION_DELAY_RENDER_TIMEOUT_MS) || 180_000)

type JobRow = {
  id: string
  source_media_asset_id: string | null
  project_snapshot: VideoProject | null
  template_key: string
  motion_preset: string
  brand_preset: string
  design: VideoDesign
  audio_key: string | null
  audio_mime_type: string | null
}

type ThumbnailProjectRow = {
  id: string
  project: VideoProject
  revision: number
  thumbnail_key: string | null
}

const thumbnailRetryAfter = new Map<string, { revision: number, at: number }>()

type AssetRow = {
  storage_key: string
  mime_type: string
}

type ServedAsset = {
  path: string
  mime_type: string
}

type ProjectAssetRow = AssetRow & {
  id: string
  width: number
  height: number
  duration_ms: number | null
}

function safePath(root: string, key: string) {
  const base = resolve(root)
  const target = resolve(root, key)
  if (target !== base && !target.startsWith(base + '/')) throw new Error('Unsafe storage path')
  return target
}

/** Original file of an asset: in uploads, or in the server media folder for linked files. */
async function assetSourcePath(storageKey: string) {
  if (!storageKey.startsWith(LIBRARY_KEY_PREFIX)) return safePath(uploadsRoot, storageKey)
  if (!libraryRoot) throw new Error('The server media folder is not mounted in the render worker (STORAGE_LIBRARY)')
  const [root, target] = await Promise.all([
    realpath(libraryRoot),
    realpath(safePath(libraryRoot, storageKey.slice(LIBRARY_KEY_PREFIX.length))),
  ])
  if (target !== root && !target.startsWith(root + '/')) throw new Error('Unsafe storage path')
  return target
}

function dataUri(mimeType: string, data: Buffer) {
  return `data:${mimeType};base64,${data.toString('base64')}`
}

function outputKey() {
  const date = new Date()
  return [
    'videos',
    String(date.getUTCFullYear()),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    `${randomUUID()}.mp4`,
  ].join('/')
}

function thumbnailOutputKey(projectId: string, revision: number) {
  return ['video-thumbnails', projectId, `${revision}.jpg`].join('/')
}

async function nextThumbnailProject() {
  const rows = await sql`
    SELECT id, project, revision, thumbnail_key
    FROM video_projects
    WHERE thumbnail_key IS NULL OR thumbnail_revision < revision
    ORDER BY updated_at ASC
    LIMIT 20
  ` as unknown as ThumbnailProjectRow[]

  const now = Date.now()
  return rows.find((row) => {
    const retry = thumbnailRetryAfter.get(row.id)
    return !retry || retry.revision !== row.revision || retry.at <= now
  }) || null
}

async function claimJob() {
  return sql.begin(async (tx) => {
    const rows = await tx`
      SELECT
        id,
        source_media_asset_id,
        project_snapshot,
        template_key,
        motion_preset,
        brand_preset,
        design,
        audio_key,
        audio_mime_type
      FROM video_render_jobs
      WHERE status = 'queued'
      ORDER BY created_at ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    ` as unknown as JobRow[]

    const job = rows[0]
    if (!job) return null

    await tx`
      UPDATE video_render_jobs
      SET status = 'rendering',
          progress = 1,
          error = NULL,
          started_at = NOW(),
          finished_at = NULL,
          updated_at = NOW()
      WHERE id = ${job.id}
    `
    return job
  })
}

// Returns false when the job was cancelled meanwhile; a cancelled job keeps
// that status.
async function markFailed(jobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  const rows = await sql`
    UPDATE video_render_jobs
    SET status = 'failed',
        error = ${message.slice(0, 10000)},
        finished_at = NOW(),
        updated_at = NOW()
    WHERE id = ${jobId} AND status = 'rendering'
    RETURNING id
  `
  return rows.length > 0
}

// Staff can cancel a job from the editor while it renders. The worker polls the
// job and aborts Remotion as soon as it is no longer 'rendering' (cancelled or
// deleted).
function watchForCancellation(jobId: string) {
  const { cancelSignal, cancel } = makeCancelSignal()
  const timer = setInterval(() => {
    void (sql`SELECT status FROM video_render_jobs WHERE id = ${jobId}` as unknown as Promise<{ status: string }[]>)
      .then((rows) => {
        if (rows[0]?.status !== 'rendering') cancel()
      })
      .catch(() => undefined)
  }, CANCEL_POLL_MS)
  return { cancelSignal, stop: () => clearInterval(timer) }
}

// Headless Chromium and Remotion's video extractor fetch project media over
// HTTP. Large clips are streamed from local storage with byte-range support
// instead of being inlined as data URIs. Only assets of the running job are
// exposed, on the loopback interface.
const servedAssets = new Map<string, ServedAsset>()
let assetServer: Server | null = null
let assetServerOrigin = ''
let capabilityTimer: ReturnType<typeof setInterval> | null = null

async function startAssetServer() {
  assetServer = createServer((request, response) => {
    void (async () => {
      const id = /^\/assets\/([0-9a-f-]{36})$/.exec(request.url || '')?.[1]
      const asset = id ? servedAssets.get(id) : undefined
      if (!asset) {
        response.writeHead(404).end()
        return
      }
      const path = asset.path
      const { size } = await stat(path)
      const range = /^bytes=(\d*)-(\d*)$/.exec(request.headers.range || '')
      const headers = { 'content-type': asset.mime_type, 'accept-ranges': 'bytes', 'access-control-allow-origin': '*' }
      if (range && (range[1] || range[2])) {
        const start = range[1] ? Number(range[1]) : Math.max(0, size - Number(range[2]))
        const end = range[1] && range[2] ? Math.min(size - 1, Number(range[2])) : size - 1
        if (start > end) {
          response.writeHead(416, { 'content-range': `bytes */${size}` }).end()
          return
        }
        response.writeHead(206, { ...headers, 'content-range': `bytes ${start}-${end}/${size}`, 'content-length': end - start + 1 })
        createReadStream(path, { start, end }).pipe(response)
        return
      }
      response.writeHead(200, { ...headers, 'content-length': size })
      createReadStream(path).pipe(response)
    })().catch(() => {
      if (!response.headersSent) response.writeHead(500)
      response.end()
    })
  })
  await new Promise<void>(resolveListen => assetServer!.listen(0, '127.0.0.1', resolveListen))
  assetServerOrigin = `http://127.0.0.1:${(assetServer.address() as AddressInfo).port}`
}

// The web container cannot see the GPU, so the worker reports what it detected
// through the database for the Settings page.
async function refreshCapabilities() {
  capabilities = await detectRenderCapabilities()
  await sql`
    INSERT INTO render_worker_status (key, capabilities, detected_at, heartbeat_at)
    VALUES ('default', ${sql.json(capabilities.engines)}, NOW(), NOW())
    ON CONFLICT (key) DO UPDATE
    SET capabilities = EXCLUDED.capabilities,
        detected_at = EXCLUDED.detected_at,
        heartbeat_at = EXCLUDED.heartbeat_at
  `
}

async function resolveJobEngine(job: JobRow) {
  const rows = await sql`SELECT engine FROM render_settings WHERE key = 'default' LIMIT 1` as unknown as { engine: string }[]
  const engine = resolveRenderEngine(parseRenderEngineSetting(rows[0]?.engine), capabilities.engines)
  await sql`UPDATE video_render_jobs SET render_engine = ${engine}, updated_at = NOW() WHERE id = ${job.id}`
  console.log(`Video job ${job.id} renders with ${RENDER_ENGINE_LABELS[engine]}`)
  return renderOptionsFor(engine, capabilities)
}

async function renderComposition(job: JobRow, serveUrl: string, cancelSignal: CancelSignal, id: string, inputProps: Record<string, unknown>) {
  const browser = browserExecutable ? { browserExecutable } : {}
  const composition = await selectComposition({
    serveUrl,
    id,
    inputProps,
    ...browser,
  })

  const engineOptions = await resolveJobEngine(job)

  const key = outputKey()
  const target = safePath(generatedRoot, key)
  await mkdir(dirname(target), { recursive: true })

  let lastPercent = 1
  try {
    await renderMedia({
      composition,
      serveUrl,
      codec: 'h264',
      outputLocation: target,
      inputProps,
      ...browser,
      ...engineOptions,
      delayRenderTimeoutInMilliseconds: DELAY_RENDER_TIMEOUT_MS,
      cancelSignal,
      onProgress: ({ progress }) => {
        const percent = Math.max(2, Math.min(99, Math.round(progress * 100)))
        if (percent < lastPercent + 3) return
        lastPercent = percent
        void sql`
          UPDATE video_render_jobs
          SET progress = ${percent}, updated_at = NOW()
          WHERE id = ${job.id} AND status = 'rendering'
        `.catch(() => undefined)
      },
    })

    const completed = await sql`
      UPDATE video_render_jobs
      SET status = 'completed',
          progress = 100,
          output_key = ${key},
          output_mime_type = 'video/mp4',
          error = NULL,
          finished_at = NOW(),
          updated_at = NOW()
      WHERE id = ${job.id} AND status = 'rendering'
      RETURNING id
    `
    if (!completed.length) throw new Error('Render was cancelled')
  } catch (error) {
    await rm(target, { force: true }).catch(() => undefined)
    throw error
  }
}

async function prepareProjectAssets(project: VideoProject) {
  const ids = collectProjectAssetIds(project)
  const rows = ids.length
    ? await sql`
      SELECT id, storage_key, mime_type, width, height, duration_ms
      FROM media_assets
      WHERE id IN ${sql(ids)}
    ` as unknown as ProjectAssetRow[]
    : []
  if (rows.length !== ids.length) throw new Error('The project uses media that is no longer in the media library')

  const assets: ProjectAssetMap = {}
  for (const row of rows) {
    const sourcePath = await assetSourcePath(row.storage_key)
    const proxyPath = row.mime_type.startsWith('video/')
      ? await ensureVideoRenderProxy({
          assetId: row.id,
          sourcePath,
          generatedRoot,
          log: message => console.log(message),
        })
      : null
    const mimeType = proxyPath ? 'video/mp4' : row.mime_type

    servedAssets.set(row.id, { path: proxyPath || sourcePath, mime_type: mimeType })
    assets[row.id] = {
      src: `${assetServerOrigin}/assets/${row.id}`,
      mimeType,
      width: row.width,
      height: row.height,
      durationMs: row.duration_ms,
    }
  }
  return assets
}

async function renderProjectJob(job: JobRow, serveUrl: string, cancelSignal: CancelSignal) {
  const project = parseVideoProject(job.project_snapshot)
  try {
    const assets = await prepareProjectAssets(project)
    await renderComposition(job, serveUrl, cancelSignal, 'NightLightProject', { project, assets })
  } finally {
    servedAssets.clear()
  }
}

async function renderProjectThumbnail(row: ThumbnailProjectRow, serveUrl: string) {
  const project = parseVideoProject(row.project)
  const browser = browserExecutable ? { browserExecutable } : {}
  const key = thumbnailOutputKey(row.id, row.revision)
  const target = safePath(generatedRoot, key)
  await mkdir(dirname(target), { recursive: true })

  try {
    const assets = await prepareProjectAssets(project)
    const inputProps = { project, assets }
    const composition = await selectComposition({
      serveUrl,
      id: 'NightLightProject',
      inputProps,
      ...browser,
    })

    await renderStill({
      composition,
      serveUrl,
      output: target,
      inputProps,
      frame: projectThumbnailFrame(project),
      imageFormat: 'jpeg',
      ...browser,
      delayRenderTimeoutInMilliseconds: DELAY_RENDER_TIMEOUT_MS,
    })

    const updated = await sql`
      UPDATE video_projects
      SET thumbnail_key = ${key},
          thumbnail_revision = ${row.revision},
          thumbnail_updated_at = NOW()
      WHERE id = ${row.id} AND revision = ${row.revision}
      RETURNING id
    `

    if (!updated.length) {
      await rm(target, { force: true }).catch(() => undefined)
      return
    }

    thumbnailRetryAfter.delete(row.id)
    if (row.thumbnail_key && row.thumbnail_key !== key) {
      await rm(safePath(generatedRoot, row.thumbnail_key), { force: true }).catch(() => undefined)
    }
    console.log(`Updated thumbnail for video project ${row.id} revision ${row.revision}`)
  } finally {
    servedAssets.clear()
  }
}

async function renderJob(job: JobRow, serveUrl: string, cancelSignal: CancelSignal) {
  if (job.project_snapshot) {
    await renderProjectJob(job, serveUrl, cancelSignal)
    return
  }
  if (!job.source_media_asset_id) throw new Error('Render job has neither a project nor a source image')

  const assets = await sql`
    SELECT storage_key, mime_type
    FROM media_assets
    WHERE id = ${job.source_media_asset_id}
    LIMIT 1
  ` as unknown as AssetRow[]
  const asset = assets[0]
  if (!asset) throw new Error('Source media asset no longer exists')

  const imageBuffer = await readFile(await assetSourcePath(asset.storage_key))
  const imageSrc = dataUri(asset.mime_type, imageBuffer)

  let audioSrc: string | null = null
  if (job.audio_key) {
    const audioBuffer = await readFile(safePath(generatedRoot, job.audio_key))
    audioSrc = dataUri(job.audio_mime_type || 'audio/mpeg', audioBuffer)
  }

  await renderComposition(job, serveUrl, cancelSignal, 'NightLightVertical', {
    imageSrc,
    audioSrc,
    design: job.design,
  })
}

async function recoverStaleJobs() {
  await sql`
    UPDATE video_render_jobs
    SET status = 'queued',
        progress = 0,
        error = 'Recovered after interrupted render worker',
        started_at = NULL,
        updated_at = NOW()
    WHERE status = 'rendering'
      AND updated_at < NOW() - INTERVAL '30 minutes'
  `
}

async function sleep(ms: number) {
  await new Promise(resolve => setTimeout(resolve, ms))
}

async function main() {
  await recoverStaleJobs()
  await refreshCapabilities()
  for (const engine of capabilities.engines) {
    console.log(`Render engine ${RENDER_ENGINE_LABELS[engine.id]}: ${engine.available ? 'available' : 'unavailable'} — ${engine.detail}`)
  }
  capabilityTimer = setInterval(() => {
    refreshCapabilities().catch(error => console.error('Render capability detection failed', error))
  }, CAPABILITY_REFRESH_MS)
  await startAssetServer()
  const serveUrl = await bundle({
    entryPoint: resolve(process.cwd(), 'remotion/index.ts'),
    onProgress: (progress) => {
      if (progress % 25 === 0) console.log(`Remotion bundle: ${progress}%`)
    },
  })

  console.log('NightLight video render worker ready')

  while (!stopping) {
    const job = await claimJob()
    if (!job) {
      const thumbnail = await nextThumbnailProject()
      if (!thumbnail) {
        await sleep(1500)
        continue
      }

      try {
        await renderProjectThumbnail(thumbnail, serveUrl)
      } catch (error) {
        thumbnailRetryAfter.set(thumbnail.id, { revision: thumbnail.revision, at: Date.now() + 30_000 })
        console.error(`Thumbnail render failed for video project ${thumbnail.id}`, error)
      }
      continue
    }

    console.log(`Rendering video job ${job.id}`)
    const cancellation = watchForCancellation(job.id)
    try {
      await renderJob(job, serveUrl, cancellation.cancelSignal)
      console.log(`Completed video job ${job.id}`)
    } catch (error) {
      if (await markFailed(job.id, error)) console.error(`Video job ${job.id} failed`, error)
      else console.log(`Cancelled video job ${job.id}`)
    } finally {
      cancellation.stop()
    }
  }
}

for (const signal of ['SIGTERM', 'SIGINT'] as const) {
  process.on(signal, () => {
    stopping = true
  })
}

try {
  await main()
} finally {
  if (capabilityTimer) clearInterval(capabilityTimer)
  assetServer?.close()
  await sql.end({ timeout: 5 })
}
