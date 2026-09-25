import { describe, expect, it } from 'vitest'
import { needsVideoRenderProxy, renderProxyVideoFilter, type VideoProbe } from '../scripts/render-proxy'

const base: VideoProbe = {
  codecName: 'h264',
  pixFmt: 'yuv420p',
  width: 1920,
  height: 1080,
  colorTransfer: 'bt709',
  colorPrimaries: 'bt709',
  colorSpace: 'bt709',
}

describe('video render proxies', () => {
  it('keeps ordinary H.264 8-bit SDR media on the original', () => {
    expect(needsVideoRenderProxy(base)).toBe(false)
  })

  it('creates a proxy for HEVC, high bit depth, HDR and oversized sources', () => {
    expect(needsVideoRenderProxy({ ...base, codecName: 'hevc' })).toBe(true)
    expect(needsVideoRenderProxy({ ...base, pixFmt: 'yuv420p10le' })).toBe(true)
    expect(needsVideoRenderProxy({ ...base, colorTransfer: 'arib-std-b67', colorPrimaries: 'bt2020', colorSpace: 'bt2020nc' })).toBe(true)
    expect(needsVideoRenderProxy({ ...base, width: 3840, height: 2160 })).toBe(true)
  })

  it('uses a lightweight SDR filter for ordinary proxies', () => {
    expect(renderProxyVideoFilter({ ...base, codecName: 'vp9' })).toContain('format=yuv420p')
    expect(renderProxyVideoFilter({ ...base, codecName: 'vp9' })).not.toContain('tonemap=')
  })

  it('tone-maps HDR proxies to BT.709', () => {
    const filter = renderProxyVideoFilter({
      ...base,
      codecName: 'hevc',
      pixFmt: 'yuv420p10le',
      colorTransfer: 'arib-std-b67',
      colorPrimaries: 'bt2020',
      colorSpace: 'bt2020nc',
    })
    expect(filter).toContain('tonemap=hable')
    expect(filter).toContain('zscale=p=bt709:t=bt709:m=bt709:r=tv')
    expect(filter).toContain('format=yuv420p')
  })
})
