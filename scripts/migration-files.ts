import { createHash } from 'node:crypto'

export function migrationChecksum(contents: string) {
  return createHash('sha256').update(contents).digest('hex')
}

export function sortMigrationFiles(files: string[]) {
  return files
    .filter(file => file.endsWith('.sql'))
    .sort((a, b) => a.localeCompare(b, 'en'))
}
