import { mkdir, readFile, realpath, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'
import { isLibraryKey, libraryPathFromKey } from '../../shared/media-library-browse'

export interface MediaStorage {
  put(buffer: Uint8Array, extension: string, prefix?: string): Promise<string>
  read(key: string): Promise<Buffer>
  delete(key: string | null | undefined): Promise<void>
}

function safePath(root: string, key: string) {
  const base = resolve(root)
  const target = resolve(root, normalize(key))
  if (target !== base && !target.startsWith(base + '/')) throw new Error('Unsafe storage path')
  return target
}

export class LocalMediaStorage implements MediaStorage {
  constructor(private root: string) {}

  async put(buffer: Uint8Array, extension: string, prefix = 'originals') {
    const date = new Date()
    const key = join(
      prefix,
      String(date.getUTCFullYear()),
      String(date.getUTCMonth() + 1).padStart(2, '0'),
      `${randomUUID()}.${extension.replace(/[^a-z0-9]/gi, '').toLowerCase()}`,
    ).replaceAll('\\', '/')
    await this.putAt(key, buffer)
    return key
  }

  /** Writes to a caller-chosen key (atomically), for derived files such as image variants. */
  async putAt(key: string, buffer: Uint8Array) {
    const target = safePath(this.root, key)
    await mkdir(dirname(target), { recursive: true })
    const temp = `${target}.${randomUUID()}.tmp`
    await writeFile(temp, buffer, { flag: 'wx' })
    await rename(temp, target)
  }

  read(key: string) {
    return readFile(safePath(this.root, key))
  }

  /** Absolute path for streaming large files (video/audio) with range support. */
  path(key: string) {
    return safePath(this.root, key)
  }

  async delete(key: string | null | undefined) {
    if (!key) return
    await rm(safePath(this.root, key), { force: true })
  }

  async deleteDirectory(prefix: string) {
    await rm(safePath(this.root, prefix), { recursive: true, force: true })
  }
}

export function getMediaStorage() {
  const config = useRuntimeConfig()
  return new LocalMediaStorage(String(config.storageUploads))
}


export function getGeneratedStorage() {
  const config = useRuntimeConfig()
  return new LocalMediaStorage(String(config.storageGenerated))
}

/**
 * Read-only storage for the server media folder. Files are linked into the
 * library in place, so this class can read them but never writes or deletes.
 */
export class LibraryMediaStorage {
  constructor(private root: string) {}

  /** Lexical path inside the root (rejects `..`); symlinks are not resolved. */
  path(relativePath: string) {
    return safePath(this.root, relativePath)
  }

  /** Resolves symlinks and refuses anything that ends up outside the root. */
  async realPath(relativePath: string) {
    const [root, target] = await Promise.all([realpath(this.root), realpath(this.path(relativePath))])
    if (target !== root && !target.startsWith(root + '/')) throw new Error('Unsafe storage path')
    return target
  }
}

export function getLibraryStorage() {
  const config = useRuntimeConfig()
  const root = String(config.storageLibrary || '').trim()
  return root ? new LibraryMediaStorage(root) : null
}

/** Absolute path of an asset's original, whether it lives in uploads or the server media folder. */
export async function assetFilePath(storageKey: string) {
  if (isLibraryKey(storageKey)) {
    const library = getLibraryStorage()
    if (!library) throw new Error('The server media folder is not configured')
    return library.realPath(libraryPathFromKey(storageKey))
  }
  return getMediaStorage().path(storageKey)
}

export async function readAssetFile(storageKey: string) {
  return readFile(await assetFilePath(storageKey))
}

/** Deletes an asset's own file; files linked from the server media folder are never touched. */
export async function deleteAssetFile(storageKey: string | null | undefined) {
  if (!storageKey || isLibraryKey(storageKey)) return
  await getMediaStorage().delete(storageKey)
}
