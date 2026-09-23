import { describe, expect, it } from 'vitest'
import { bucketPeaks, sampleColumns, type Waveform } from '../app/utils/audio-waveform'

describe('waveform peaks', () => {
  it('keeps the loudest sample per bucket across channels, normalised to 0–255', () => {
    const left = new Float32Array([0.1, -0.2, 0.05, 0.5, 0, 0])
    const right = new Float32Array([0, 0.3, 0, -1, 0.25, 0])
    // 6 samples at 6 Hz, 3 buckets per second → 2 samples per bucket.
    expect(Array.from(bucketPeaks([left, right], 6, 3))).toEqual([77, 255, 64])
  })

  it('handles silence without dividing by zero', () => {
    expect(Array.from(bucketPeaks([new Float32Array(4)], 4, 2))).toEqual([0, 0])
  })
})

describe('waveform columns', () => {
  const waveform: Waveform = {
    rate: 10,
    peaks: Uint8Array.from([0, 51, 102, 153, 204, 255, 0, 0, 0, 0]),
    bass: Uint8Array.from([0, 0, 0, 0, 255, 255, 0, 0, 0, 0]),
  }

  it('takes the maximum over the buckets each column covers', () => {
    // Two columns of 0.25s from 0.1s: buckets 1–2 and 3–5.
    const { peaks, bass } = sampleColumns(waveform, 0.1, 0.25, 2)
    expect(Array.from(peaks, value => Math.round(value * 100) / 100)).toEqual([0.4, 1])
    expect(Array.from(bass)).toEqual([0, 1])
  })

  it('repeats a bucket when zoomed in past its resolution and is empty past the end', () => {
    const { peaks } = sampleColumns(waveform, 0.5, 0.02, 3)
    expect(Array.from(peaks)).toEqual([1, 1, 1])
    expect(Array.from(sampleColumns(waveform, 5, 0.1, 2).peaks)).toEqual([0, 0])
  })
})
