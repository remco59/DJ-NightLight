import { loadFont } from '@remotion/fonts'
import { staticFile } from 'remotion'

// Fonts ship with the app (public/fonts, SIL OFL) instead of coming from the
// operating system: the editor preview runs in the user's browser and the
// render worker in a Linux container, and system fonts differ between the two
// (Arial Black exists on Windows but not in the container). loadFont holds the
// render until each face is ready, so no frame is drawn with a fallback font.

export const DISPLAY_FONT_FAMILY = '"Archivo Black", "Arial Black", sans-serif'
export const BODY_FONT_FAMILY = 'Archivo, Arial, sans-serif'

// Archivo is a variable font, so one file per style covers every weight.
// Archivo Black has a single heavy cut; claiming the full weight range stops
// browsers from faking an extra bold on top of it for fontWeight 900.
const FACES = [
  { family: 'Archivo Black', file: 'fonts/ArchivoBlack-Regular.woff2', weight: '100 900', style: 'normal' },
  { family: 'Archivo', file: 'fonts/Archivo-Variable.woff2', weight: '100 900', style: 'normal' },
  { family: 'Archivo', file: 'fonts/Archivo-Italic-Variable.woff2', weight: '100 900', style: 'italic' },
] as const

// Only real browsers (editor preview, render Chromium) can load fonts; unit
// tests import these modules in a DOM shim without FontFace.
if (typeof FontFace !== 'undefined') {
  for (const face of FACES) {
    void loadFont({ family: face.family, url: staticFile(face.file), weight: face.weight, style: face.style })
  }
}
