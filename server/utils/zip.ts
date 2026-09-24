import { crc32 } from 'node:zlib'

export type ZipEntry = { name: string, data: Uint8Array, modifiedAt?: Date }

function dosDateTime(date: Date) {
  const time = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  const day = ((Math.max(1980, date.getFullYear()) - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  return { time, day }
}

/**
 * Writes an uncompressed (stored) ZIP archive. Media is already compressed,
 * so storing keeps downloads fast without a compression dependency. Entries
 * arrive one at a time so only one file is held in memory; archives must stay
 * under 4 GB (no ZIP64).
 */
export async function writeStoredZip(entries: AsyncIterable<ZipEntry>, write: (chunk: Uint8Array) => Promise<void> | void) {
  const central: Buffer[] = []
  let offset = 0
  let count = 0

  for await (const entry of entries) {
    const name = Buffer.from(entry.name, 'utf8')
    const { time, day } = dosDateTime(entry.modifiedAt || new Date())
    const checksum = crc32(entry.data)
    const size = entry.data.length

    const local = Buffer.alloc(30)
    local.writeUInt32LE(0x04034b50, 0)
    local.writeUInt16LE(20, 4)
    local.writeUInt16LE(0x0800, 6)
    local.writeUInt16LE(0, 8)
    local.writeUInt16LE(time, 10)
    local.writeUInt16LE(day, 12)
    local.writeUInt32LE(checksum, 14)
    local.writeUInt32LE(size, 18)
    local.writeUInt32LE(size, 22)
    local.writeUInt16LE(name.length, 26)
    local.writeUInt16LE(0, 28)

    const header = Buffer.alloc(46)
    header.writeUInt32LE(0x02014b50, 0)
    header.writeUInt16LE(20, 4)
    header.writeUInt16LE(20, 6)
    header.writeUInt16LE(0x0800, 8)
    header.writeUInt16LE(0, 10)
    header.writeUInt16LE(time, 12)
    header.writeUInt16LE(day, 14)
    header.writeUInt32LE(checksum, 16)
    header.writeUInt32LE(size, 20)
    header.writeUInt32LE(size, 24)
    header.writeUInt16LE(name.length, 28)
    header.writeUInt32LE(offset, 42)
    central.push(header, name)

    await write(local)
    await write(name)
    await write(entry.data)
    offset += local.length + name.length + size
    count += 1
  }

  const directory = Buffer.concat(central)
  const end = Buffer.alloc(22)
  end.writeUInt32LE(0x06054b50, 0)
  end.writeUInt16LE(count, 8)
  end.writeUInt16LE(count, 10)
  end.writeUInt32LE(directory.length, 12)
  end.writeUInt32LE(offset, 16)
  await write(directory)
  await write(end)
}

/** Makes archive entry names unique: `photo.jpg`, `photo (2).jpg`, … */
export function uniqueZipNames(names: string[]) {
  const seen = new Map<string, number>()
  return names.map((raw) => {
    const name = [...raw].map(char => char.charCodeAt(0) < 32 || '\\/:*?"<>|'.includes(char) ? '_' : char).join('').trim() || 'file'
    const key = name.toLowerCase()
    const count = (seen.get(key) || 0) + 1
    seen.set(key, count)
    if (count === 1) return name
    const dot = name.lastIndexOf('.')
    return dot > 0 ? `${name.slice(0, dot)} (${count})${name.slice(dot)}` : `${name} (${count})`
  })
}
