// Shared rules for the server media folder (NUXT_STORAGE_LIBRARY): its files
// are linked into the media library in place, never copied, through a
// `library:<relative path>` storage key.

export const LIBRARY_KEY_PREFIX = 'library:'

/** Extensions the library accepts; the file signature is still checked on link. */
export const LIBRARY_EXTENSIONS = {
  jpg: 'image', jpeg: 'image', png: 'image', webp: 'image',
  mp4: 'video', mov: 'video', webm: 'video',
  mp3: 'audio', m4a: 'audio', wav: 'audio', ogg: 'audio',
} as const

export type LibraryMediaKind = typeof LIBRARY_EXTENSIONS[keyof typeof LIBRARY_EXTENSIONS]

/**
 * Limits for linked files. Videos may be larger than browser uploads (250 MB)
 * because nothing is uploaded or held in memory: the file is streamed from disk.
 */
export const LIBRARY_LIMITS = {
  image: 15 * 1024 * 1024,
  audio: 50 * 1024 * 1024,
  video: 800 * 1024 * 1024,
} as const

export function libraryLimitMessage(kind: LibraryMediaKind) {
  const mb = LIBRARY_LIMITS[kind] / 1024 / 1024
  return { image: `Een afbeelding mag maximaal ${mb} MB zijn`, video: `Een video mag maximaal ${mb} MB zijn`, audio: `Audio mag maximaal ${mb} MB zijn` }[kind]
}

export const LIBRARY_MAX_LINK_BATCH = 50
export const LIBRARY_MAX_ENTRIES = 1500

export type LibraryEntry = {
  name: string
  /** Path relative to the library root, `/`-separated. */
  path: string
  kind: 'directory' | 'file'
  mediaKind?: LibraryMediaKind
  size?: number
  modifiedAt?: string
  /** Larger than the limit for its type; it cannot be linked. */
  tooLarge?: boolean
  /** Id of the asset that already links this file. */
  assetId?: string
}

export type LibraryListing =
  | { enabled: false }
  | { enabled: true, path: string, parent: string | null, entries: LibraryEntry[], truncated: boolean }

export function isLibraryKey(key: string) {
  return key.startsWith(LIBRARY_KEY_PREFIX)
}

export function libraryKey(relativePath: string) {
  return `${LIBRARY_KEY_PREFIX}${relativePath}`
}

export function libraryPathFromKey(key: string) {
  return key.slice(LIBRARY_KEY_PREFIX.length)
}

/**
 * Normalises a user-supplied relative path: `/`-separated, no leading or
 * trailing slash, `''` for the root. Returns null for anything that could
 * leave the root (`..`, absolute paths, backslashes, control characters).
 */
export function normalizeLibraryPath(input: unknown): string | null {
  if (input === undefined || input === null) return ''
  if (typeof input !== 'string' || input.length > 1000) return null
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\\]/.test(input)) return null
  const segments = input.split('/').filter(segment => segment !== '' && segment !== '.')
  if (segments.some(segment => segment === '..')) return null
  return segments.join('/')
}

export function libraryParentPath(path: string) {
  if (!path) return null
  const index = path.lastIndexOf('/')
  return index === -1 ? '' : path.slice(0, index)
}

export function libraryMediaKind(filename: string): LibraryMediaKind | null {
  const extension = filename.split('.').pop()?.toLowerCase() || ''
  if (!filename.includes('.')) return null
  return (LIBRARY_EXTENSIONS as Record<string, LibraryMediaKind>)[extension] || null
}

/** Hidden files and NAS housekeeping folders (`@eaDir`, `#recycle`, `.DS_Store`) are not media. */
export function isHiddenLibraryName(name: string) {
  return name.startsWith('.') || name.startsWith('@') || name.startsWith('#') || name === 'Thumbs.db'
}

export function libraryFileTooLarge(kind: LibraryMediaKind, size: number) {
  return size > LIBRARY_LIMITS[kind]
}
