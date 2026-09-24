// Synthesises the motion template sound effects into public/sfx/.
//
// Every sound is generated from oscillators and seeded noise, so the output is
// reproducible and free of third-party licences. Lengths come from
// TEMPLATE_SOUNDS in shared/template-sounds.ts. Re-run after tweaking a voice:
//
//   npx tsx scripts/sfx/generate-sfx.ts

import { mkdir, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { TEMPLATE_SOUNDS, type TemplateSound } from '../../shared/template-sounds'

const SAMPLE_RATE = 44100
const PEAK = 0.89 // -1 dBFS
const OUT = resolve(process.cwd(), 'public/sfx')

function mulberry32(seed: number) {
  let state = seed >>> 0
  return () => {
    state = (state + 0x6D2B79F5) >>> 0
    let t = state
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Chamberlin state-variable filter; returns a band-pass step. */
function bandPass() {
  let low = 0
  let band = 0
  return (input: number, cutoff: number, q = 0.6) => {
    const f = 2 * Math.sin((Math.PI * Math.min(cutoff, SAMPLE_RATE / 6)) / SAMPLE_RATE)
    const high = input - low - q * band
    band += f * high
    low += f * band
    return band
  }
}

function onePoleLowPass(cutoff: number) {
  const a = Math.exp((-2 * Math.PI * cutoff) / SAMPLE_RATE)
  let state = 0
  return (input: number) => (state = (1 - a) * input + a * state)
}

/** Short attack, exponential decay and a clean fade over the last 20 ms. */
function envelope(t: number, length: number, attack: number, decay: number) {
  const rise = attack > 0 ? Math.min(1, t / attack) : 1
  const tail = Math.min(1, Math.max(0, (length - t) / 0.02))
  return rise * Math.exp(-Math.max(0, t - attack) / decay) * tail
}

type Voice = (t: number, index: number) => number

const voices: Record<TemplateSound, (length: number) => Voice> = {
  // Cinematic boom: a sub sweep, a body thump and a noise crack on top.
  impact: (length) => {
    const random = mulberry32(1)
    const crackFilter = onePoleLowPass(3500)
    let subPhase = 0
    let bodyPhase = 0
    return (t) => {
      const subFreq = 38 + 72 * Math.exp(-t / 0.08)
      subPhase += (2 * Math.PI * subFreq) / SAMPLE_RATE
      bodyPhase += (2 * Math.PI * (95 + 90 * Math.exp(-t / 0.03))) / SAMPLE_RATE
      // The second harmonic keeps the boom audible on phone speakers.
      const sub = (Math.sin(subPhase) + Math.sin(2 * subPhase) * 0.35) * envelope(t, length, 0.003, 0.38)
      const body = Math.sin(bodyPhase) * envelope(t, length, 0.001, 0.16) * 0.6
      const crack = crackFilter(random() * 2 - 1) * envelope(t, length, 0.0005, 0.035) * 1.4
      return Math.tanh((sub + body + crack) * 1.6)
    }
  },
  // Tight kick-like hit for words and cuts.
  punch: (length) => {
    const random = mulberry32(2)
    let phase = 0
    return (t) => {
      phase += (2 * Math.PI * (52 + 150 * Math.exp(-t / 0.025))) / SAMPLE_RATE
      const tone = (Math.sin(phase) + Math.sin(2 * phase) * 0.3) * envelope(t, length, 0.001, 0.11)
      const click = (random() * 2 - 1) * envelope(t, length, 0, 0.004) * 0.5
      return Math.tanh((tone + click) * 1.8)
    }
  },
  // Electric discharge: a falling buzzy tone with crackles.
  zap: (length) => {
    const random = mulberry32(3)
    const filter = bandPass()
    let phase = 0
    let crackle = 0
    return (t) => {
      const freq = 180 + 1700 * Math.exp(-t / 0.09) + 60 * Math.sin(2 * Math.PI * 38 * t)
      phase = (phase + freq / SAMPLE_RATE) % 1
      const buzz = (phase < 0.5 ? 1 : -1) * 0.45 + (2 * phase - 1) * 0.35
      if (random() < 0.0025) crackle = 1
      crackle *= 0.996
      const noise = filter(random() * 2 - 1, 2400 + 3000 * Math.exp(-t / 0.15), 0.35) * 1.4
      const sparks = (random() * 2 - 1) * crackle
      return Math.tanh((buzz + noise * 0.8 + sparks * 0.9) * envelope(t, length, 0.002, 0.2) * 1.3)
    }
  },
  // Air moving past: band-passed noise sweeping up and down.
  whoosh: (length) => {
    const random = mulberry32(4)
    const filter = bandPass()
    return (t) => {
      const position = t / length
      const swell = Math.sin(Math.PI * Math.min(1, position / 0.95)) ** 2 * (position < 0.55 ? 1 : Math.exp(-(position - 0.55) * 3))
      const cutoff = 350 + 2600 * Math.sin(Math.PI * Math.min(1, position * 1.1))
      return filter(random() * 2 - 1, cutoff, 0.5) * swell * 2.2
    }
  },
  // Digital stutter: short slices of crushed tones, noise and dropouts.
  glitch: (length) => {
    const random = mulberry32(5)
    const sliceLength = Math.round(SAMPLE_RATE * 0.028)
    let slice = { kind: 0, freq: 0, hold: 1 }
    let held = 0
    let phase = 0
    return (t, index) => {
      if (index % sliceLength === 0) {
        slice = { kind: Math.floor(random() * 4), freq: 200 + random() * 1800, hold: 1 + Math.floor(random() * 12) }
      }
      phase = (phase + slice.freq / SAMPLE_RATE) % 1
      let sample = 0
      if (slice.kind === 0) sample = phase < 0.5 ? 0.8 : -0.8
      else if (slice.kind === 1) sample = random() * 2 - 1
      else if (slice.kind === 2) sample = Math.sin(2 * Math.PI * phase) * 0.9
      // Sample-and-hold crushes the signal into a gritty staircase.
      if (index % slice.hold === 0) held = Math.round(sample * 6) / 6
      return held * envelope(t, length, 0.001, 0.25)
    }
  },
}

function render(sound: TemplateSound) {
  const length = TEMPLATE_SOUNDS[sound].seconds
  const count = Math.round(length * SAMPLE_RATE)
  const voice = voices[sound](length)
  const samples = new Float32Array(count)
  for (let index = 0; index < count; index++) samples[index] = voice(index / SAMPLE_RATE, index)
  let peak = 0
  for (const sample of samples) peak = Math.max(peak, Math.abs(sample))
  const gain = peak > 0 ? PEAK / peak : 0
  return samples.map(sample => sample * gain)
}

/** 16-bit mono PCM WAV. */
function wav(samples: Float32Array) {
  const buffer = Buffer.alloc(44 + samples.length * 2)
  buffer.write('RIFF', 0)
  buffer.writeUInt32LE(36 + samples.length * 2, 4)
  buffer.write('WAVE', 8)
  buffer.write('fmt ', 12)
  buffer.writeUInt32LE(16, 16)
  buffer.writeUInt16LE(1, 20)
  buffer.writeUInt16LE(1, 22)
  buffer.writeUInt32LE(SAMPLE_RATE, 24)
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28)
  buffer.writeUInt16LE(2, 32)
  buffer.writeUInt16LE(16, 34)
  buffer.write('data', 36)
  buffer.writeUInt32LE(samples.length * 2, 40)
  samples.forEach((sample, index) => buffer.writeInt16LE(Math.round(Math.max(-1, Math.min(1, sample)) * 32767), 44 + index * 2))
  return buffer
}

await mkdir(OUT, { recursive: true })
for (const sound of Object.keys(TEMPLATE_SOUNDS) as TemplateSound[]) {
  const file = resolve(process.cwd(), 'public', TEMPLATE_SOUNDS[sound].file)
  await writeFile(file, wav(render(sound)))
  console.log(`Wrote ${TEMPLATE_SOUNDS[sound].file}`)
}
