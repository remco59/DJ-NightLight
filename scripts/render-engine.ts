import { execFile } from 'node:child_process'
import { constants } from 'node:fs'
import { access, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { promisify } from 'node:util'
import type { FfmpegOverrideFn } from '@remotion/renderer'
import type { RenderEngine, RenderEngineCapability } from '../shared/render-engine'

const execFileAsync = promisify(execFile)

const SYSTEM_FFMPEG = '/usr/bin/ffmpeg'
export const INTEL_FFMPEG_DIR = process.env.INTEL_FFMPEG_DIR || '/opt/nightlight-intel-ffmpeg'
const DEFAULT_VIDEO_BITRATE = '10M'

export type RenderCapabilities = {
  engines: RenderEngineCapability[]
  intelDevice?: string
}

export type EngineRenderOptions = {
  binariesDirectory?: string
  ffmpegOverride?: FfmpegOverrideFn
  videoBitrate?: string
  disallowParallelEncoding?: boolean
}

async function exists(path: string, mode = constants.F_OK) {
  try {
    await access(path, mode)
    return true
  } catch {
    return false
  }
}

async function findRenderDevice() {
  try {
    const entries = (await readdir('/dev/dri')).filter(entry => entry.startsWith('renderD')).sort()
    return entries[0] ? `/dev/dri/${entries[0]}` : undefined
  } catch {
    return undefined
  }
}

async function systemFfmpegHasEncoder(encoder: string) {
  try {
    const { stdout } = await execFileAsync(SYSTEM_FFMPEG, ['-hide_banner', '-encoders'], { timeout: 8_000, maxBuffer: 4_000_000 })
    return stdout.includes(encoder)
  } catch {
    return false
  }
}

function lastErrorLine(error: unknown) {
  const stderr = (error as { stderr?: string }).stderr || (error as Error).message || ''
  return stderr.trim().split('\n').filter(Boolean).at(-1)?.slice(0, 200) || 'unknown error'
}

/** A real encode catches driver problems that the encoder list cannot reveal. */
async function vaapiTestEncode(device: string): Promise<string | null> {
  try {
    await execFileAsync(SYSTEM_FFMPEG, [
      '-hide_banner', '-loglevel', 'error',
      '-vaapi_device', device,
      '-f', 'lavfi', '-i', 'testsrc=size=256x256:rate=30:duration=0.2',
      '-vf', 'format=nv12,hwupload',
      '-c:v', 'h264_vaapi',
      '-f', 'null', '-',
    ], { timeout: 15_000, maxBuffer: 1_000_000 })
    return null
  } catch (error) {
    return lastErrorLine(error)
  }
}

async function detectIntel(): Promise<{ capability: RenderEngineCapability, device?: string }> {
  const unavailable = (detail: string, device?: string) => ({ capability: { id: 'intel' as const, available: false, detail }, device })
  if (process.arch !== 'x64') return unavailable('Intel VAAPI rendering needs the x64 render worker image.')

  const device = await findRenderDevice()
  if (!device) return unavailable('No Intel GPU found: /dev/dri has no render device.')
  if (!await exists(device, constants.R_OK | constants.W_OK)) {
    return unavailable(`Intel GPU found at ${device}, but the render worker has no permission to use it.`, device)
  }
  if (!await systemFfmpegHasEncoder('h264_vaapi')) return unavailable('The worker FFmpeg does not include the h264_vaapi encoder.', device)
  if (!await exists(join(INTEL_FFMPEG_DIR, 'remotion'))) return unavailable(`Remotion binaries for VAAPI are missing from ${INTEL_FFMPEG_DIR}.`, device)

  const failure = await vaapiTestEncode(device)
  if (failure) return unavailable(`VAAPI test encode on ${device} failed: ${failure}`, device)
  return { capability: { id: 'intel', available: true, detail: `Intel GPU ready (${device}).` }, device }
}

export async function detectRenderCapabilities(): Promise<RenderCapabilities> {
  const intel = await detectIntel()
  return {
    engines: [
      { id: 'cpu', available: true, detail: 'Software H.264 encoding. Always available.' },
      intel.capability,
    ],
    ...(intel.capability.available && intel.device ? { intelDevice: intel.device } : {}),
  }
}

function removeOption(args: string[], option: string) {
  const result: string[] = []
  for (let index = 0; index < args.length; index++) {
    if (args[index] === option) {
      index++
      continue
    }
    result.push(args[index]!)
  }
  return result
}

/** Sets an option's value, or inserts it just before the output path (the last argument). */
function setOption(args: string[], option: string, value: string) {
  const next = [...args]
  const index = next.lastIndexOf(option)
  if (index >= 0 && index + 1 < next.length) {
    next[index + 1] = value
    return next
  }
  next.splice(Math.max(0, next.length - 1), 0, option, value)
  return next
}

function appendVaapiUpload(args: string[]) {
  const index = args.lastIndexOf('-vf')
  const current = index >= 0 ? args[index + 1] : undefined
  if (current?.includes('hwupload')) return args
  return setOption(args, '-vf', current ? `${current},format=nv12,hwupload` : 'format=nv12,hwupload')
}

/**
 * Remotion only knows NVENC/VideoToolbox, so for Intel the final encode is
 * rewritten to VAAPI. Frames are uploaded to the GPU as NV12 and encoded there;
 * the -pix_fmt Remotion adds would conflict with the hardware surface format.
 */
export function createIntelVaapiFfmpegOverride(device: string): FfmpegOverrideFn {
  return ({ type, args }) => {
    if (type !== 'stitcher') return args
    if (args[args.lastIndexOf('-c:v') + 1] === 'copy') return args
    let next = removeOption(args, '-pix_fmt')
    next = setOption(next, '-c:v', 'h264_vaapi')
    next = appendVaapiUpload(next)
    if (!next.includes('-vaapi_device')) next = ['-vaapi_device', device, ...next]
    return next
  }
}

export function renderOptionsFor(engine: RenderEngine, capabilities: RenderCapabilities): EngineRenderOptions {
  if (engine === 'cpu') return {}
  if (!capabilities.intelDevice) throw new Error('Intel GPU (VAAPI) is unavailable')
  return {
    binariesDirectory: INTEL_FFMPEG_DIR,
    ffmpegOverride: createIntelVaapiFfmpegOverride(capabilities.intelDevice),
    videoBitrate: process.env.RENDER_VIDEO_BITRATE || DEFAULT_VIDEO_BITRATE,
    // Encode in the stitcher step, where the VAAPI override applies, instead of
    // Remotion's parallel pre-encoder.
    disallowParallelEncoding: true,
  }
}
