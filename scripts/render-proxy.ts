import { execFile } from 'node:child_process'
import { mkdir, rename, rm, stat } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const SYSTEM_FFMPEG = '/usr/bin/ffmpeg'
const SYSTEM_FFPROBE = '/usr/bin/ffprobe'
const MAX_PROXY_DIMENSION = 1920

export type VideoProbe = {
  codecName: string
  pixFmt: string
  width: number
  height: number
  colorTransfer: string
  colorPrimaries: string
  colorSpace: string
}

type FfprobeOutput = {
  streams?: Array<{
    codec_name?: string
    pix_fmt?: string
    width?: number
    height?: number
    color_transfer?: string
    color_primaries?: string
    color_space?: string
  }>
}

const HDR_TRANSFERS = new Set(['arib-std-b67', 'smpte2084', 'smpte428'])

export function needsVideoRenderProxy(probe: VideoProbe) {
  const codecNeedsProxy = probe.codecName !== 'h264'
  const highBitDepth = /(?:p|gbrp)(?:10|12|14|16)(?:le|be)?$/.test(probe.pixFmt)
    || /(?:10|12|14|16)le/.test(probe.pixFmt)
  const hdr = HDR_TRANSFERS.has(probe.colorTransfer)
    || probe.colorPrimaries.startsWith('bt2020')
    || probe.colorSpace.startsWith('bt2020')
  const oversized = Math.max(probe.width, probe.height) > MAX_PROXY_DIMENSION
  return codecNeedsProxy || highBitDepth || hdr || oversized
}

export function renderProxyVideoFilter(probe: VideoProbe) {
  const scale = "scale=w='min(1920,iw)':h='min(1920,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2"
  const hdr = HDR_TRANSFERS.has(probe.colorTransfer)
    || probe.colorPrimaries.startsWith('bt2020')
    || probe.colorSpace.startsWith('bt2020')

  if (!hdr) return `${scale},format=yuv420p`

  // Convert HLG/PQ/BT.2020 sources to a predictable SDR BT.709 proxy.
  return [
    'zscale=t=linear:npl=100',
    'format=gbrpf32le',
    'tonemap=hable:desat=0',
    'zscale=p=bt709:t=bt709:m=bt709:r=tv',
    scale,
    'format=yuv420p',
  ].join(',')
}

export async function probeVideo(path: string): Promise<VideoProbe> {
  const { stdout } = await execFileAsync(SYSTEM_FFPROBE, [
    '-v', 'error',
    '-select_streams', 'v:0',
    '-show_entries', 'stream=codec_name,pix_fmt,width,height,color_transfer,color_primaries,color_space',
    '-of', 'json',
    path,
  ], { maxBuffer: 1_000_000 })

  const parsed = JSON.parse(stdout) as FfprobeOutput
  const stream = parsed.streams?.[0]
  if (!stream?.codec_name || !stream.width || !stream.height) {
    throw new Error('Could not probe the source video for render-proxy compatibility')
  }

  return {
    codecName: stream.codec_name,
    pixFmt: stream.pix_fmt || '',
    width: stream.width,
    height: stream.height,
    colorTransfer: stream.color_transfer || '',
    colorPrimaries: stream.color_primaries || '',
    colorSpace: stream.color_space || '',
  }
}

async function reusableProxy(sourcePath: string, proxyPath: string) {
  try {
    const [source, proxy] = await Promise.all([stat(sourcePath), stat(proxyPath)])
    return proxy.size > 0 && proxy.mtimeMs >= source.mtimeMs
  } catch {
    return false
  }
}

export async function ensureVideoRenderProxy(options: {
  assetId: string
  sourcePath: string
  generatedRoot: string
  log?: (message: string) => void
}) {
  const probe = await probeVideo(options.sourcePath)
  if (!needsVideoRenderProxy(probe)) return null

  const target = join(options.generatedRoot, 'render-proxies', `${options.assetId}.mp4`)
  if (await reusableProxy(options.sourcePath, target)) {
    options.log?.(`Using cached render proxy for media ${options.assetId}`)
    return target
  }

  await mkdir(dirname(target), { recursive: true })
  const temporary = `${target}.tmp-${process.pid}-${Date.now()}.mp4`
  options.log?.(
    `Creating render proxy for media ${options.assetId} (${probe.codecName}, ${probe.pixFmt || 'unknown'}, ${probe.width}x${probe.height})`,
  )

  try {
    await execFileAsync(SYSTEM_FFMPEG, [
      '-hide_banner',
      '-loglevel', 'error',
      '-i', options.sourcePath,
      '-map', '0:v:0',
      '-map', '0:a?',
      '-vf', renderProxyVideoFilter(probe),
      '-c:v', 'libx264',
      '-preset', 'veryfast',
      '-crf', '20',
      '-c:a', 'aac',
      '-b:a', '192k',
      '-movflags', '+faststart',
      '-map_metadata', '-1',
      '-sn',
      '-dn',
      '-y',
      temporary,
    ], { maxBuffer: 4_000_000 })

    await rename(temporary, target)
    options.log?.(`Render proxy ready for media ${options.assetId}`)
    return target
  } catch (error) {
    await rm(temporary, { force: true }).catch(() => undefined)
    throw new Error(
      `Could not create render proxy for media ${options.assetId}: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error },
    )
  }
}
