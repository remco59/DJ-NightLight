import { createReadStream } from 'node:fs'
import { readFile, mkdir, rm, stat } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { dirname, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import postgres from 'postgres'
import { bundle } from '@remotion/bundler'
import { renderMedia, selectComposition } from '@remotion/renderer'
import type { VideoDesign } from '../shared/video-generator'
import {
  collectProjectAssetIds,
  parseVideoProject,
  type ProjectAssetMap,
  type VideoProject,
} from '../shared/video-project'

const connectionString = process.env.DATABASE_URL
const uploadsRoot = process.env.STORAGE_UPLOADS || '/app/storage/uploads'
const generatedRoot = process.env.STORAGE_GENERATED || '/app/storage/generated'
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE

if (!connectionString) throw new Error('DATABASE_URL is required')

const sql = postgres(connectionString, { max: 1, prepare: false })
let stopping = false

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

type AssetRow = {
  storage_key: string
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

async function markFailed(jobId: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  await sql`
    UPDATE video_render_jobs
    SET status = 'failed',
        error = ${message.slice(0, 10000)},
        finished_at = NOW(),
        updated_at = NOW()
    WHERE id = ${jobId}
  `
}

// Headless Chromium and Remotion's video extractor fetch project media over
// HTTP. Large clips are streamed from local storage with byte-range support
// instead of being inlined as data URIs. Only assets of the running job are
// exposed, on the loopback interface.
const servedAssets = new Map<string, AssetRow>()
let assetServer: Server | null = null
let assetServerOrigin = ''

async function startAssetServer() {
  assetServer = createServer((request, response) => {
    void (async () => {
      const id = /^\/assets\/([0-9a-f-]{36})$/.exec(request.url || '')?.[1]
      const asset = id ? servedAssets.get(id) : undefined
      if (!asset) {
        response.writeHead(404).end()
        return
      }
      const path = safePath(uploadsRoot, asset.storage_key)
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

async function renderComposition(job: JobRow, serveUrl: string, id: string, inputProps: Record<string, unknown>) {
  const browser = browserExecutable ? { browserExecutable } : {}
  const composition = await selectComposition({
    serveUrl,
    id,
    inputProps,
    ...browser,
  })

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

    await sql`
      UPDATE video_render_jobs
      SET status = 'completed',
          progress = 100,
          output_key = ${key},
          output_mime_type = 'video/mp4',
          error = NULL,
          finished_at = NOW(),
          updated_at = NOW()
      WHERE id = ${job.id}
    `
  } catch (error) {
    await rm(target, { force: true }).catch(() => undefined)
    throw error
  }
}

async function renderProjectJob(job: JobRow, serveUrl: string) {
  const project = parseVideoProject(job.project_snapshot)
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
    servedAssets.set(row.id, row)
    assets[row.id] = {
      src: `${assetServerOrigin}/assets/${row.id}`,
      mimeType: row.mime_type,
      width: row.width,
      height: row.height,
      durationMs: row.duration_ms,
    }
  }
  try {
    await renderComposition(job, serveUrl, 'NightLightProject', { project, assets })
  } finally {
    servedAssets.clear()
  }
}

async function renderJob(job: JobRow, serveUrl: string) {
  if (job.project_snapshot) {
    await renderProjectJob(job, serveUrl)
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

  const imageBuffer = await readFile(safePath(uploadsRoot, asset.storage_key))
  const imageSrc = dataUri(asset.mime_type, imageBuffer)

  let audioSrc: string | null = null
  if (job.audio_key) {
    const audioBuffer = await readFile(safePath(generatedRoot, job.audio_key))
    audioSrc = dataUri(job.audio_mime_type || 'audio/mpeg', audioBuffer)
  }

  await renderComposition(job, serveUrl, 'NightLightVertical', {
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
      await sleep(1500)
      continue
    }

    console.log(`Rendering video job ${job.id}`)
    try {
      await renderJob(job, serveUrl)
      console.log(`Completed video job ${job.id}`)
    } catch (error) {
      console.error(`Video job ${job.id} failed`, error)
      await markFailed(job.id, error)
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
  assetServer?.close()
  await sql.end({ timeout: 5 })
}
