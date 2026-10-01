/** Widths the media endpoint renders as WebP via `?w=`. Keep this list short: every entry is a cached file per image. */
export const RESPONSIVE_IMAGE_WIDTHS = [640, 1280, 1920] as const

const MEDIA_PATH = /^\/api\/media\/[0-9a-f-]{36}$/i

/**
 * `src`/`srcset` for an image URL. Uploaded media gets resized WebP candidates;
 * anything else (external URLs, static files) is passed through untouched.
 */
export function responsiveImage(url: string | null | undefined, fallbackWidth: (typeof RESPONSIVE_IMAGE_WIDTHS)[number] = 1280) {
  if (!url) return { src: undefined, srcset: undefined }
  const [path, query] = url.split('?')
  if (!path || query || !MEDIA_PATH.test(path)) return { src: url, srcset: undefined }
  return {
    src: `${path}?w=${fallbackWidth}`,
    srcset: RESPONSIVE_IMAGE_WIDTHS.map(width => `${path}?w=${width} ${width}w`).join(', '),
  }
}
