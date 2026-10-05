// Beat grids for audio clips. Detection runs on the bass envelope the editor
// already computes for waveforms (see app/utils/audio-waveform.ts): kicks are
// sharp rises in bass energy, the tempo is the lag at which those rises repeat
// best, and a fine search over tempo and phase then lines the grid up with the
// kicks across the whole track so it does not drift over a 3-minute song.

export type BeatGrid = {
  bpm: number
  /** Source time in seconds of a downbeat (first beat of a bar); only its phase matters. */
  offset: number
}

export const MIN_BPM = 70
export const MAX_BPM = 180
export const BEATS_PER_BAR = 4
const MAX_ANALYSIS_SECONDS = 6 * 60

/** Rise in energy per bucket, lightly smoothed so a kick spread over two buckets still counts once. */
export function onsetStrength(envelope: ArrayLike<number>) {
  const onset = new Float32Array(envelope.length)
  for (let index = 1; index < envelope.length; index++) {
    onset[index] = Math.max(0, envelope[index]! - envelope[index - 1]!)
  }
  const smooth = new Float32Array(onset.length)
  for (let index = 0; index < onset.length; index++) {
    smooth[index] = onset[index]! + 0.5 * ((onset[index - 1] ?? 0) + (onset[index + 1] ?? 0))
  }
  return smooth
}

/** Most dance music sits around 120–130 BPM; this keeps half/double-tempo guesses from winning. */
function tempoPrior(bpm: number) {
  const octaves = Math.log2(bpm / 125)
  return Math.exp(-0.5 * (octaves / 0.45) ** 2)
}

function combScore(onset: Float32Array, phase: number, period: number) {
  let score = 0
  for (let position = phase; position < onset.length; position += period) score += onset[Math.round(position)] ?? 0
  return score
}

/**
 * Tempo and phase of the beat in a bass envelope sampled at `rate` buckets per
 * second, or null when there is no clear pulse (silence, ambient intros).
 */
export function detectBeatGrid(envelope: ArrayLike<number>, rate: number): BeatGrid | null {
  // Six minutes are plenty to lock tempo and phase; longer sources would only
  // make the search slower (it runs on the main thread).
  const length = Math.min(envelope.length, rate * MAX_ANALYSIS_SECONDS)
  const onset = onsetStrength(Array.from({ length }, (_, index) => envelope[index]!))
  let energy = 0
  for (const value of onset) energy += value
  if (energy <= 0 || onset.length < rate * 4) return null

  // Coarse tempo: autocorrelation of the onsets, weighted by the tempo prior.
  const minLag = Math.floor(rate * 60 / MAX_BPM)
  const maxLag = Math.ceil(rate * 60 / MIN_BPM)
  let bestLag = 0
  let bestScore = 0
  let total = 0
  for (let lag = minLag; lag <= maxLag; lag++) {
    let sum = 0
    for (let index = 0; index + lag < onset.length; index++) sum += onset[index]! * onset[index + lag]!
    const score = sum * tempoPrior(rate * 60 / lag)
    total += score
    if (score > bestScore) {
      bestScore = score
      bestLag = lag
    }
  }
  // A pulse must stand out from the average lag, otherwise there is no beat to follow.
  if (!bestLag || bestScore < 1.5 * total / (maxLag - minLag + 1)) return null

  // Fine tempo and phase: the grid that collects the most onset energy over the whole track.
  const coarse = rate * 60 / bestLag
  let best = { bpm: coarse, phase: 0, score: -1 }
  for (let bpm = coarse * 0.97; bpm <= coarse * 1.03; bpm += 0.02) {
    const period = rate * 60 / bpm
    for (let phase = 0; phase < period; phase += 0.5) {
      const score = combScore(onset, phase, period)
      if (score > best.score) best = { bpm, phase, score }
    }
  }
  return { bpm: Math.round(best.bpm * 100) / 100, offset: best.phase / rate }
}

/** Seconds per beat. */
export function beatPeriod(grid: BeatGrid) {
  return 60 / grid.bpm
}

/** A grid whose downbeat falls on `time` (source seconds), keeping the tempo. */
export function withDownbeatAt(grid: BeatGrid, time: number): BeatGrid {
  const bar = beatPeriod(grid) * BEATS_PER_BAR
  return { bpm: grid.bpm, offset: ((time % bar) + bar) % bar }
}

export type GridLine = { frame: number, bar: boolean }

/**
 * Timeline frames of the beats inside a clip. `trimStart` and `duration` are in
 * project frames; beats before the clip's source in-point are skipped.
 */
export function beatFrames(
  clip: { start: number, duration: number, trimStart: number },
  grid: BeatGrid,
  fps: number,
): GridLine[] {
  const period = beatPeriod(grid)
  const from = clip.trimStart / fps
  const to = (clip.trimStart + clip.duration) / fps
  const lines: GridLine[] = []
  for (let beat = Math.ceil((from - grid.offset) / period); grid.offset + beat * period < to; beat++) {
    const time = grid.offset + beat * period
    const frame = Math.round(clip.start + (time - from) * fps)
    lines.push({ frame, bar: ((beat % BEATS_PER_BAR) + BEATS_PER_BAR) % BEATS_PER_BAR === 0 })
  }
  return lines
}
