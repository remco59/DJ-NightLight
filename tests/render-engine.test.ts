import { describe, expect, it } from 'vitest'
import { createIntelVaapiFfmpegOverride, renderOptionsFor } from '../scripts/render-engine'
import {
  parseRenderEngineSetting,
  renderSettingsInputSchema,
  resolveRenderEngine,
  type RenderEngineCapability,
} from '../shared/render-engine'

const cpu: RenderEngineCapability = { id: 'cpu', available: true, detail: 'Software' }
const intelReady: RenderEngineCapability = { id: 'intel', available: true, detail: 'Intel GPU ready' }
const intelMissing: RenderEngineCapability = { id: 'intel', available: false, detail: 'No Intel GPU found' }

const stitcherArgs = [
  '-r', '30', '-f', 'image2', '-s', '1080x1920', '-start_number', '0', '-i', '/tmp/frames/element-%04d.jpeg',
  '-i', '/tmp/audio.aac', '-c:a', 'copy',
  '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-video_track_timescale', '90000', '-b:v', '10M',
  '-map_metadata', '-1', '-y', '/storage/out.mp4',
]

describe('render engine selection', () => {
  it('prefers the Intel GPU in automatic mode when it is available', () => {
    expect(resolveRenderEngine('auto', [cpu, intelReady])).toBe('intel')
  })

  it('falls back to the CPU in automatic mode without a usable GPU', () => {
    expect(resolveRenderEngine('auto', [cpu, intelMissing])).toBe('cpu')
    expect(resolveRenderEngine('auto', [])).toBe('cpu')
  })

  it('always allows the CPU', () => {
    expect(resolveRenderEngine('cpu', [])).toBe('cpu')
  })

  it('refuses an explicitly chosen engine that is unavailable instead of using the CPU', () => {
    expect(() => resolveRenderEngine('intel', [cpu, intelMissing])).toThrow('Intel GPU (VAAPI) is niet beschikbaar: No Intel GPU found')
  })

  it('validates saved settings', () => {
    expect(renderSettingsInputSchema.safeParse({ engine: 'intel' }).success).toBe(true)
    expect(renderSettingsInputSchema.safeParse({ engine: 'nvidia' }).success).toBe(false)
    expect(parseRenderEngineSetting('bogus')).toBe('auto')
    expect(parseRenderEngineSetting(undefined)).toBe('auto')
  })

  it('adds no options for CPU rendering and VAAPI options for Intel', () => {
    expect(renderOptionsFor('cpu', { engines: [cpu] })).toEqual({})
    const intel = renderOptionsFor('intel', { engines: [cpu, intelReady], intelDevice: '/dev/dri/renderD128' })
    expect(intel.binariesDirectory).toBe('/opt/nightlight-intel-ffmpeg')
    expect(intel.disallowParallelEncoding).toBe(true)
    expect(intel.videoBitrate).toBeTruthy()
    expect(intel.ffmpegOverride).toBeTypeOf('function')
    expect(() => renderOptionsFor('intel', { engines: [cpu, intelMissing] })).toThrow()
  })
})

describe('Intel VAAPI ffmpeg override', () => {
  const override = createIntelVaapiFfmpegOverride('/dev/dri/renderD128')

  it('leaves the pre-stitcher untouched', () => {
    const args = ['-i', 'in', '-c:v', 'libx264', 'out.mp4']
    expect(override({ type: 'pre-stitcher', args })).toEqual(args)
  })

  it('switches the final encode to VAAPI and uploads NV12 frames', () => {
    const result = override({ type: 'stitcher', args: stitcherArgs })
    expect(result.slice(0, 2)).toEqual(['-vaapi_device', '/dev/dri/renderD128'])
    expect(result[result.indexOf('-c:v') + 1]).toBe('h264_vaapi')
    expect(result).not.toContain('-pix_fmt')
    expect(result[result.indexOf('-vf') + 1]).toBe('format=nv12,hwupload')
    expect(result.at(-1)).toBe('/storage/out.mp4')
    expect(result[result.indexOf('-c:a') + 1]).toBe('copy')
  })

  it('appends the upload to an existing video filter', () => {
    const args = [...stitcherArgs.slice(0, -1), '-vf', 'zscale=matrix=709:matrixin=709:range=limited', '/storage/out.mp4']
    const result = override({ type: 'stitcher', args })
    expect(result[result.indexOf('-vf') + 1]).toBe('zscale=matrix=709:matrixin=709:range=limited,format=nv12,hwupload')
    expect(result.filter(arg => arg === '-vf')).toHaveLength(1)
  })

  it('is idempotent', () => {
    const once = override({ type: 'stitcher', args: stitcherArgs })
    expect(override({ type: 'stitcher', args: once })).toEqual(once)
  })

  it('does not re-encode a stream that is only copied', () => {
    const args = ['-i', 'pre-encoded.mp4', '-c:v', 'copy', '/storage/out.mp4']
    expect(override({ type: 'stitcher', args })).toEqual(args)
  })
})
