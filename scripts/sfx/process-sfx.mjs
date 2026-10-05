// Builds the motion template sound effects in public/sfx/ from real recordings.
//
//   SFX_SOURCE=/path/to/recordings node scripts/sfx/process-sfx.mjs
//
// Needs ffmpeg on the PATH. The source recordings are not part of the
// repository (see public/sfx/LICENSE.txt); the script looks for them in
// SFX_SOURCE (default scripts/sfx/source) by the names in SOURCES, ignoring
// any upload prefix before the first dash.
//
// Each sound is cut and shaped with ffmpeg, then levelled so the loudest
// 20 ms of every file sits at the same level and cue volumes stay comparable.
// Lengths and hit points must match TEMPLATE_SOUNDS in
// shared/template-sounds.ts; tests/template-sounds.test.ts checks the lengths.

import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const SOURCE = resolve(process.env.SFX_SOURCE || 'scripts/sfx/source')
const OUT = resolve('public/sfx')
const RATE = 44100
/** Level of the loudest 20 ms window of every sound, in dBFS. */
const TARGET_RMS_PEAK = -12
/** Sample ceiling after levelling (-1 dBFS). */
const CEILING = 0.89

const SOURCES = {
  impact: 'Ghosthack-HTH_FX_Impact_09.wav',
  strike: 'electricity-charge-sound-effect.mp3',
  crackle: 'biww-short-electric-561891.mp3',
  shock: 'Electric_shock.mp3',
}

const files = readdirSync(SOURCE)
function source(key) {
  const name = SOURCES[key]
  const found = files.find(file => file === name || file.endsWith(`-${name}`))
  if (!found) throw new Error(`Missing source recording ${name} in ${SOURCE}`)
  return join(SOURCE, found)
}

const STEREO = `aformat=sample_rates=${RATE}:channel_layouts=stereo`

/**
 * Each sound: its inputs, an ffmpeg filter graph that ends in [out], and the
 * exact length in seconds (matching TEMPLATE_SOUNDS).
 */
const SOUNDS = {
  // The Ghosthack impact: hit at 0 with its natural decay, trimmed and faded.
  impact: {
    inputs: ['impact'],
    seconds: 1.5,
    graph: `[0:a]${STEREO},atrim=0:1.5,afade=t=out:st=1.15:d=0.35[out]`,
  },
  // The first beat of the impact: a short thud for letter and photo slams.
  punch: {
    inputs: ['impact'],
    seconds: 0.35,
    graph: `[0:a]${STEREO},atrim=0:0.35,afade=t=out:st=0.2:d=0.15[out]`,
  },
  // A bolt strike: the electric swell builds and the charge discharges on its peak.
  // The swell peaks 0.48 s into its cut and the strike's own peak lands there too.
  zap: {
    inputs: ['shock', 'strike'],
    seconds: 1.5,
    graph: [
      `[0:a]${STEREO},atrim=0.18:1.2,asetpts=PTS-STARTPTS,afade=t=in:d=0.04,volume=-3dB[swell]`,
      `[1:a]${STEREO},atrim=0.05:1.15,asetpts=PTS-STARTPTS,afade=t=out:st=0.8:d=0.3,adelay=430|430[strike]`,
      `[swell][strike]amix=inputs=2:normalize=0:duration=longest,atrim=0:1.5,afade=t=out:st=1.2:d=0.3[out]`,
    ].join(';'),
  },
  // Arcs crackling: the bursts of the short electric recording, silence trimmed.
  crackle: {
    inputs: ['crackle'],
    seconds: 0.8,
    graph: `[0:a]${STEREO},atrim=0.15:0.95,asetpts=PTS-STARTPTS,afade=t=in:d=0.01,afade=t=out:st=0.55:d=0.25[out]`,
  },
  // A fast electric swell for whip and zoom entrances.
  whoosh: {
    inputs: ['shock'],
    seconds: 0.6,
    graph: `[0:a]${STEREO},atrim=0.15:1.25,asetpts=PTS-STARTPTS,atempo=1.8,highpass=f=250,atrim=0:0.6,afade=t=in:d=0.05,afade=t=out:st=0.45:d=0.15[out]`,
  },
  // Bit-crushed, stuttering crackle for glitch entrances.
  glitch: {
    inputs: ['crackle'],
    seconds: 0.45,
    graph: `[0:a]${STEREO},atrim=0.16:0.62,asetpts=PTS-STARTPTS,acrusher=bits=6:mode=lin:mix=0.8,tremolo=f=30:d=0.85,atrim=0:0.45,afade=t=out:st=0.33:d=0.12[out]`,
  },
}

function ffmpeg(args) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { stdio: ['ignore', 'inherit', 'inherit'] })
}

/** Loudest 20 ms RMS window of a WAV, in dBFS. */
function rmsPeak(path) {
  const raw = execFileSync('ffmpeg', ['-v', 'error', '-i', path, '-ac', '1', '-ar', String(RATE), '-f', 's16le', '-'], { maxBuffer: 1 << 28 })
  const samples = new Int16Array(raw.buffer, raw.byteOffset, Math.floor(raw.byteLength / 2))
  const window = Math.round(RATE * 0.02)
  let loudest = 0
  for (let start = 0; start + window <= samples.length; start += window) {
    let sum = 0
    for (let i = start; i < start + window; i++) sum += (samples[i] / 32768) ** 2
    loudest = Math.max(loudest, Math.sqrt(sum / window))
  }
  return 20 * Math.log10(Math.max(loudest, 1e-6))
}

mkdirSync(OUT, { recursive: true })
const work = mkdtempSync(join(tmpdir(), 'sfx-'))
try {
  for (const [name, sound] of Object.entries(SOUNDS)) {
    const raw = join(work, `${name}.wav`)
    const inputs = sound.inputs.flatMap(key => ['-i', source(key)])
    // Exact length: pad short results and cut long ones.
    const graph = sound.graph.replace('[out]', '[cut]') + `;[cut]apad=whole_dur=${sound.seconds},atrim=0:${sound.seconds}[out]`
    ffmpeg([...inputs, '-filter_complex', graph, '-map', '[out]', '-c:a', 'pcm_s16le', raw])
    const gain = TARGET_RMS_PEAK - rmsPeak(raw)
    const target = join(OUT, `${name}.wav`)
    ffmpeg(['-i', raw, '-af', `volume=${gain.toFixed(2)}dB,alimiter=limit=${CEILING}:level=disabled`, '-c:a', 'pcm_s16le', '-bitexact', '-map_metadata', '-1', '-fflags', '+bitexact', target])
    const bytes = readFileSync(target).byteLength
    console.log(`public/sfx/${name}.wav  ${sound.seconds}s  gain ${gain.toFixed(1)} dB  ${(bytes / 1024).toFixed(0)} KB`)
  }
} finally {
  rmSync(work, { recursive: true, force: true })
}
