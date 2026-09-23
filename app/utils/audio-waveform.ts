// Detailed waveforms for the timeline. The peaks stored at upload (240 for a
// whole file) are far too coarse to find a drop, so the editor decodes each
// audio file once and keeps two envelopes at WAVEFORM_RATE buckets per second:
// the full signal and a low-passed bass band (kicks and drops show up as solid
// blocks of bass). Results are cached in IndexedDB per asset, so a track is
// only decoded again after the cache is cleared or WAVEFORM_VERSION changes.

export const WAVEFORM_RATE = 200
const WAVEFORM_VERSION = 1
// Decoding resamples to this rate: plenty for 200 peaks/s and the bass band,
// and ~6× less memory than 44.1 kHz for long DJ mixes.
const DECODE_SAMPLE_RATE = 16000
/** Longer sources keep the stored overview peaks; decoding them would use too much memory. */
export const MAX_DETAILED_SECONDS = 30 * 60
const BASS_SAMPLE_RATE = 11025
const BASS_CUTOFF_HZ = 150

export type Waveform = {
  /** Buckets per second. */
  rate: number
  /** Peak level per bucket, 0–255, normalised to the loudest bucket. */
  peaks: Uint8Array
  /** Bass-band peak per bucket, 0–255, normalised to its own loudest bucket. */
  bass: Uint8Array
}

/** Per-bucket peak of the absolute sample value across channels, scaled to 0–255. */
export function bucketPeaks(channels: Float32Array[], sampleRate: number, rate = WAVEFORM_RATE) {
  const length = channels[0]?.length || 0
  const perBucket = sampleRate / rate
  const count = Math.max(1, Math.ceil(length / perBucket))
  const raw = new Float32Array(count)
  let loudest = 0
  for (let bucket = 0; bucket < count; bucket++) {
    const from = Math.floor(bucket * perBucket)
    const to = Math.min(length, Math.floor((bucket + 1) * perBucket))
    let peak = 0
    for (const channel of channels) {
      for (let index = from; index < to; index++) {
        const value = Math.abs(channel[index]!)
        if (value > peak) peak = value
      }
    }
    raw[bucket] = peak
    if (peak > loudest) loudest = peak
  }
  const scaled = new Uint8Array(count)
  if (loudest > 0) {
    for (let bucket = 0; bucket < count; bucket++) scaled[bucket] = Math.round(raw[bucket]! / loudest * 255)
  }
  return scaled
}

async function bassBand(buffer: AudioBuffer) {
  const context = new OfflineAudioContext(1, Math.max(1, Math.ceil(buffer.duration * BASS_SAMPLE_RATE)), BASS_SAMPLE_RATE)
  const source = context.createBufferSource()
  source.buffer = buffer
  // Two cascaded low-passes give a steep enough slope to keep hi-hats and vocals out.
  let node: AudioNode = source
  for (let stage = 0; stage < 2; stage++) {
    const filter = context.createBiquadFilter()
    filter.type = 'lowpass'
    filter.frequency.value = BASS_CUTOFF_HZ
    filter.Q.value = 0.7
    node.connect(filter)
    node = filter
  }
  node.connect(context.destination)
  source.start()
  const rendered = await context.startRendering()
  return bucketPeaks([rendered.getChannelData(0)], BASS_SAMPLE_RATE)
}

async function analyse(url: string): Promise<Waveform> {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Audio could not be loaded (${response.status})`)
  const data = await response.arrayBuffer()
  // Decoding needs no audible context; an offline one avoids autoplay restrictions.
  const buffer = await new OfflineAudioContext(1, 1, DECODE_SAMPLE_RATE).decodeAudioData(data)
  const channels = Array.from({ length: buffer.numberOfChannels }, (_, index) => buffer.getChannelData(index))
  const peaks = bucketPeaks(channels, buffer.sampleRate)
  const bass = await bassBand(buffer)
  return { rate: WAVEFORM_RATE, peaks, bass }
}

// --- IndexedDB cache (best effort: private mode or blocked storage just skips it) --

const DB_NAME = 'nightlight-waveforms'
const STORE = 'waveforms'

function openCache() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function readCache(key: string): Promise<Waveform | null> {
  try {
    const db = await openCache()
    return await new Promise((resolve) => {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key)
      request.onsuccess = () => {
        const value = request.result as (Waveform & { version: number }) | undefined
        resolve(value?.version === WAVEFORM_VERSION ? { rate: value.rate, peaks: value.peaks, bass: value.bass } : null)
      }
      request.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

async function writeCache(key: string, waveform: Waveform) {
  try {
    const db = await openCache()
    db.transaction(STORE, 'readwrite').objectStore(STORE).put({ ...waveform, version: WAVEFORM_VERSION }, key)
  } catch {
    // Not cached; the next visit decodes again.
  }
}

const pending = new Map<string, Promise<Waveform>>()

/** Detailed waveform for an asset, from cache or by decoding it once (concurrent calls share the work). */
export function loadWaveform(assetId: string, url: string): Promise<Waveform> {
  const existing = pending.get(assetId)
  if (existing) return existing
  const job = (async () => {
    const cached = await readCache(assetId)
    if (cached) return cached
    const waveform = await analyse(url)
    void writeCache(assetId, waveform)
    return waveform
  })()
  pending.set(assetId, job)
  job.catch(() => pending.delete(assetId))
  return job
}

/**
 * Max peak and bass level (0–1) for each of `columns` screen columns, starting
 * `from` seconds into the source with `step` seconds per column.
 */
export function sampleColumns(waveform: Waveform, from: number, step: number, columns: number) {
  const peaks = new Float32Array(columns)
  const bass = new Float32Array(columns)
  const total = waveform.peaks.length
  for (let column = 0; column < columns; column++) {
    const first = Math.floor((from + column * step) * waveform.rate)
    const last = Math.max(first + 1, Math.floor((from + (column + 1) * step) * waveform.rate))
    let peak = 0
    let low = 0
    for (let bucket = Math.max(0, first); bucket < Math.min(total, last); bucket++) {
      if (waveform.peaks[bucket]! > peak) peak = waveform.peaks[bucket]!
      if ((waveform.bass[bucket] ?? 0) > low) low = waveform.bass[bucket]!
    }
    peaks[column] = peak / 255
    bass[column] = low / 255
  }
  return { peaks, bass }
}
