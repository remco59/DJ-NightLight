import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises'
import { dirname, join, normalize, resolve } from 'node:path'
import { randomUUID } from 'node:crypto'

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
    const target = safePath(this.root, key)
    await mkdir(dirname(target), { recursive: true })
    const temp = `${target}.${randomUUID()}.tmp`
    await writeFile(temp, buffer, { flag: 'wx' })
    await rename(temp, target)
    return key
  }

  read(key: string) {
    return readFile(safePath(this.root, key))
  }

  async delete(key: string | null | undefined) {
    if (!key) return
    await rm(safePath(this.root, key), { force: true })
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
