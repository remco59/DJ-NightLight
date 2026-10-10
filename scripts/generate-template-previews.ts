// Renders a real still of every motion template with the Remotion composition
// the editor and the export use, so the template cards show the actual design.
// Output: public/brand/templates/<key>.webp (portrait, committed to the repo).
//
//   npm run templates:previews            # all templates
//   npm run templates:previews -- review  # only the given template keys
import { mkdir, rm } from 'node:fs/promises'
import { resolve } from 'node:path'
import sharp from 'sharp'
import { bundle } from '@remotion/bundler'
import { renderStill, selectComposition } from '@remotion/renderer'
import { createGraphicItem, createVideoProject, projectDurationFrames, type ProjectAssetMap } from '../shared/video-project'
import { boltTransitionMid } from '../shared/template-sounds'
import { MOTION_TEMPLATES, MOTION_TEMPLATE_KEYS, type MotionTemplateKey } from '../shared/video-templates'

const OUTPUT_DIR = resolve(process.cwd(), 'public/brand/templates')
const WIDTH = 360
const browserExecutable = process.env.REMOTION_BROWSER_EXECUTABLE

// Stand-in footage for templates that show the user's own photos or clips:
// blurred club lights, so the card shows the layout instead of "Missing media".
const SAMPLE_PHOTOS = [
  ['#7c3aed', '#ff2d95', '#38bdf8'],
  ['#ff8d58', '#a855f7', '#1e1b4b'],
  ['#38bdf8', '#7c3aed', '#ff2d95'],
  ['#ff2d95', '#6d28d9', '#fbbf24'],
]

async function samplePhotos() {
  const assets: ProjectAssetMap = {}
  for (const [index, [a, b, c]] of SAMPLE_PHOTOS.entries()) {
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1350"><defs><filter id="f"><feGaussianBlur stdDeviation="70"/></filter></defs><rect width="1080" height="1350" fill="#0b0614"/><g filter="url(#f)"><circle cx="220" cy="330" r="260" fill="${a}"/><circle cx="820" cy="560" r="300" fill="${b}"/><circle cx="480" cy="1060" r="320" fill="${c}"/></g></svg>`
    const jpeg = await sharp(Buffer.from(svg)).jpeg({ quality: 80 }).toBuffer()
    assets[`sample-${index}`] = { src: `data:image/jpeg;base64,${jpeg.toString('base64')}`, mimeType: 'image/jpeg', width: 1080, height: 1350, durationMs: null }
  }
  return assets
}

const requested = process.argv.slice(2)
const unknown = requested.filter(key => !(MOTION_TEMPLATE_KEYS as readonly string[]).includes(key))
if (unknown.length) throw new Error(`Unknown template key(s): ${unknown.join(', ')}`)
const keys = (requested.length ? requested : MOTION_TEMPLATE_KEYS) as MotionTemplateKey[]

async function main() {
  await mkdir(OUTPUT_DIR, { recursive: true })
  const serveUrl = await bundle({ entryPoint: resolve(process.cwd(), 'remotion/index.ts') })
  const assets = await samplePhotos()
  const sampleIds = Object.keys(assets)
  const browser = browserExecutable ? { browserExecutable } : {}

  for (const key of keys) {
    const project = createVideoProject('9:16')
    const graphics = project.tracks.find(track => track.kind === 'graphics')!
    const item = createGraphicItem(key, 0, project.fps)
    const media = MOTION_TEMPLATES[key].fields.find(field => field.kind === 'asset' || field.kind === 'assets')
    if (media) item.templateProps[media.key] = media.kind === 'assets' ? sampleIds.slice(0, 4) : sampleIds[0]!
    graphics.items = [item]
    project.background = '#150c24'
    // Settled state: past the entrance, before the exit.
    const settled = Math.min(
      item.duration - item.exitFrames - 1,
      Math.max(item.entranceFrames + 10, Math.round(item.duration * 0.6)),
    )
    // The Bolt Transition flashes white at its midpoint; show the bolt as it strikes instead.
    const frame = key === 'bolt-transition' ? boltTransitionMid(item.duration) + 5 : settled
    const inputProps = { project, assets }
    const composition = await selectComposition({ serveUrl, id: 'NightLightProject', inputProps, ...browser })
    const png = resolve(OUTPUT_DIR, `${key}.png`)
    await renderStill({
      composition,
      serveUrl,
      output: png,
      inputProps,
      frame: Math.min(frame, projectDurationFrames(project) - 1),
      imageFormat: 'png',
      scale: 0.5,
      ...browser,
      delayRenderTimeoutInMilliseconds: 60_000,
    })
    await sharp(png).resize({ width: WIDTH }).webp({ quality: 82 }).toFile(resolve(OUTPUT_DIR, `${key}.webp`))
    await rm(png, { force: true })
    console.log(`Rendered ${key} at frame ${frame}`)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
