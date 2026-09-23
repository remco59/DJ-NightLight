import { describe, expect, it } from 'vitest'
import { beatFrames, detectBeatGrid, withDownbeatAt } from '../shared/beat-grid'

const RATE = 200

/** Bass envelope with a decaying kick on every beat from `firstBeat` seconds, silence before `silentUntil`. */
function kicks(bpm: number, seconds: number, firstBeat: number, silentUntil = 0) {
  const envelope = new Uint8Array(seconds * RATE)
  const period = 60 / bpm
  for (let time = firstBeat; time < seconds; time += period) {
    if (time < silentUntil) continue
    const at = Math.round(time * RATE)
    for (let step = 0; step < 30 && at + step < envelope.length; step++) {
      envelope[at + step] = Math.max(envelope[at + step]!, Math.round(255 * Math.exp(-step / 8)))
    }
  }
  return envelope
}

describe('beat detection', () => {
  it('finds the tempo and phase of a four-on-the-floor track without drifting', () => {
    const grid = detectBeatGrid(kicks(128, 180, 0.3), RATE)!
    expect(grid.bpm).toBeCloseTo(128, 1)
    const period = 60 / grid.bpm
    // The grid still lands on the kicks at the end of three minutes.
    const lastKick = 0.3 + Math.floor((179 - 0.3) / (60 / 128)) * (60 / 128)
    const nearest = grid.offset + Math.round((lastKick - grid.offset) / period) * period
    expect(Math.abs(nearest - lastKick)).toBeLessThan(0.02)
  })

  it('handles other tempos and a silent intro', () => {
    expect(detectBeatGrid(kicks(174, 60, 0.1), RATE)!.bpm).toBeCloseTo(174, 0)
    expect(detectBeatGrid(kicks(100, 60, 0.25, 20), RATE)!.bpm).toBeCloseTo(100, 0)
  })

  it('reports no grid for silence or a sustained tone', () => {
    expect(detectBeatGrid(new Uint8Array(RATE * 30), RATE)).toBeNull()
    expect(detectBeatGrid(new Uint8Array(RATE * 30).fill(200), RATE)).toBeNull()
  })
})

describe('beat grid lines', () => {
  it('maps beats inside the clip to timeline frames and marks bars', () => {
    // 120 BPM = a beat every 15 frames at 30 fps; downbeat at 0.5s in the source.
    const grid = { bpm: 120, offset: 0.5 }
    // The grid runs both ways from the downbeat, so the beat at 0s is on it too.
    const lines = beatFrames({ start: 100, duration: 60, trimStart: 0 }, grid, 30)
    expect(lines.map(line => line.frame)).toEqual([100, 115, 130, 145])
    expect(lines.map(line => line.bar)).toEqual([false, true, false, false])
    // Trimming 1s off the head shifts the source under the clip: the next bar is at 2.5s.
    const trimmed = beatFrames({ start: 100, duration: 60, trimStart: 30 }, grid, 30)
    expect(trimmed.map(line => line.frame)).toEqual([100, 115, 130, 145])
    expect(trimmed.map(line => line.bar)).toEqual([false, false, false, true])
  })

  it('moves the downbeat without changing the tempo', () => {
    const grid = withDownbeatAt({ bpm: 120, offset: 0.5 }, 9.25)
    expect(grid.bpm).toBe(120)
    // Bars are 2s long at 120 BPM, so only the phase within a bar is kept.
    expect(grid.offset).toBeCloseTo(1.25)
  })
})
