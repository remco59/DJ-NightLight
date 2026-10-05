import { execFile, spawn } from 'node:child_process'
import { promisify } from 'node:util'
import sharp from 'sharp'

// Files linked from the server media folder never pass through the browser,
// so duration, dimensions, a thumbnail and waveform peaks are produced here
// with ffprobe/ffmpeg (installed in the web image) and sharp.

const execFileAsync = promisify(execFile)
const PEAK_COUNT = 240
const PEAK_SAMPLE_RATE = 8000
const PROBE_TIMEOUT_MS = 30_000
const PEAKS_TIMEOUT_MS = 120_000

export class MediaProbeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MediaProbeError'
  }
}

export type ProbeResult = {
  durationMs: number
  width: number
  height: number
  fps?: number
  hasAudio: boolean
}

type FfprobeStream = {
  codec_type?: string
  width?: number
  height?: number
  r_frame_rate?: string
  avg_frame_rate?: string
  tags?: { rotate?: string }
  side_data_list?: Array<{ rotation?: number }>
}

type FfprobeOutput = { streams?: FfprobeStream[], format?: { duration?: string } }

function parseFrameRate(value: string | undefined) {
  const [numerator, denominator] = (value || '').split('/').map(Number)
  if (!numerator || !denominator) return undefined
  const fps = numerator / denominator
  return fps >= 1 && fps <= 240 ? Math.round(fps * 100) / 100 : undefined
}

function isQuarterTurn(stream: FfprobeStream) {
  const rotation = Number(stream.side_data_list?.find(entry => entry.rotation !== undefined)?.rotation ?? stream.tags?.rotate ?? 0)
  return Math.abs(rotation) % 180 === 90
}

export function parseProbeOutput(output: FfprobeOutput): ProbeResult {
  const streams = output.streams || []
  const video = streams.find(stream => stream.codec_type === 'video' && stream.width && stream.height)
  const durationMs = Math.round(Number(output.format?.duration) * 1000)
  if (!Number.isFinite(durationMs) || durationMs < 1) throw new MediaProbeError('De duur van het mediabestand kon niet worden bepaald')
  const swap = video ? isQuarterTurn(video) : false
  return {
    durationMs,
    width: video ? (swap ? video.height! : video.width!) : 0,
    height: video ? (swap ? video.width! : video.height!) : 0,
    fps: video ? parseFrameRate(video.avg_frame_rate) ?? parseFrameRate(video.r_frame_rate) : undefined,
    hasAudio: streams.some(stream => stream.codec_type === 'audio'),
  }
}

function missingBinary(error: unknown) {
  return (error as NodeJS.ErrnoException)?.code === 'ENOENT'
}

export async function probeMedia(path: string): Promise<ProbeResult> {
  try {
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', path,
    ], { timeout: PROBE_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 })
    return parseProbeOutput(JSON.parse(stdout) as FfprobeOutput)
  } catch (error) {
    if (error instanceof MediaProbeError) throw error
    if (missingBinary(error)) throw new MediaProbeError('ffprobe ontbreekt op de server, dus dit bestand kan niet worden gekoppeld')
    throw new MediaProbeError('Het mediabestand kon niet worden gelezen')
  }
}

/** JPEG frame (max 480 px) a little way into the video, so the first frame is not a black fade-in. */
export async function videoThumbnail(path: string, durationMs: number): Promise<Buffer | null> {
  const seek = Math.min(1, durationMs / 2000)
  try {
    const { stdout } = await execFileAsync('ffmpeg', [
      '-v', 'error', '-ss', seek.toFixed(2), '-i', path, '-frames:v', '1',
      '-vf', "scale='min(480,iw)':-2", '-f', 'image2pipe', '-c:v', 'mjpeg', '-q:v', '5', '-',
    ], { timeout: PROBE_TIMEOUT_MS, maxBuffer: 4 * 1024 * 1024, encoding: 'buffer' })
    return stdout.length ? stdout : null
  } catch {
    return null
  }
}

export async function imageThumbnail(data: Uint8Array): Promise<Buffer | null> {
  try {
    return await sharp(data, { failOn: 'none' }).rotate().resize({ width: 480, height: 480, fit: 'inside', withoutEnlargement: true }).jpeg({ quality: 78 }).toBuffer()
  } catch {
    return null
  }
}

/** Reduces a stream of 16-bit samples to `count` normalised peaks (0..1) without buffering the file. */
export class PeakCollector {
  private peaks: number[] = []
  private current = 0
  private filled = 0
  private pending: Buffer = Buffer.alloc(0)

  constructor(private samplesPerPeak: number) {}

  push(chunk: Buffer) {
    const data = this.pending.length ? Buffer.concat([this.pending, chunk]) : chunk
    const usable = data.length - (data.length % 2)
    for (let offset = 0; offset < usable; offset += 2) {
      const value = Math.abs(data.readInt16LE(offset))
      if (value > this.current) this.current = value
      if (++this.filled >= this.samplesPerPeak) this.flush()
    }
    this.pending = data.subarray(usable)
  }

  private flush() {
    this.peaks.push(this.current / 32768)
    this.current = 0
    this.filled = 0
  }

  finish(count = PEAK_COUNT) {
    if (this.filled) this.flush()
    const loudest = Math.max(...this.peaks, 0)
    if (!loudest) return []
    return this.peaks.slice(0, count).map(value => Math.round(value / loudest * 1000) / 1000)
  }
}

/** Coarse overview peaks for the library (the editor decodes detailed waveforms itself). */
export async function audioPeaks(path: string, durationMs: number): Promise<number[]> {
  const samplesPerPeak = Math.max(1, Math.ceil(durationMs / 1000 * PEAK_SAMPLE_RATE / PEAK_COUNT))
  const collector = new PeakCollector(samplesPerPeak)
  return await new Promise<number[]>((resolve) => {
    const child = spawn('ffmpeg', ['-v', 'error', '-i', path, '-vn', '-ac', '1', '-ar', String(PEAK_SAMPLE_RATE), '-f', 's16le', '-'], { stdio: ['ignore', 'pipe', 'ignore'] })
    const timer = setTimeout(() => child.kill('SIGKILL'), PEAKS_TIMEOUT_MS)
    child.stdout.on('data', (chunk: Buffer) => collector.push(chunk))
    child.on('error', () => { clearTimeout(timer); resolve([]) })
    child.on('close', (code) => {
      clearTimeout(timer)
      resolve(code === 0 ? collector.finish() : [])
    })
  })
}
