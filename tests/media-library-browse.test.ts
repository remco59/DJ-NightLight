import { mkdtemp, mkdir, realpath, symlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  LIBRARY_LIMITS,
  isHiddenLibraryName,
  isLibraryKey,
  libraryFileTooLarge,
  libraryKey,
  libraryMediaKind,
  libraryParentPath,
  libraryPathFromKey,
  normalizeLibraryPath,
} from '../shared/media-library-browse'
import { isMediaSource } from '../shared/media'
import { LibraryMediaStorage } from '../server/utils/media-storage'
import { PeakCollector, parseProbeOutput } from '../server/utils/media-probe'

describe('library paths', () => {
  it('normalises relative paths', () => {
    expect(normalizeLibraryPath(undefined)).toBe('')
    expect(normalizeLibraryPath('')).toBe('')
    expect(normalizeLibraryPath('/Clips//2026/./')).toBe('Clips/2026')
  })

  it('rejects traversal and unsafe characters', () => {
    expect(normalizeLibraryPath('../etc')).toBeNull()
    expect(normalizeLibraryPath('a/../../b')).toBeNull()
    expect(normalizeLibraryPath('a\\b')).toBeNull()
    expect(normalizeLibraryPath('a\u0000b')).toBeNull()
    expect(normalizeLibraryPath(12)).toBeNull()
  })

  it('round-trips storage keys and finds parents', () => {
    const key = libraryKey('Clips/a.mp4')
    expect(key).toBe('library:Clips/a.mp4')
    expect(isLibraryKey(key)).toBe(true)
    expect(isLibraryKey('originals/2026/01/x.mp4')).toBe(false)
    expect(libraryPathFromKey(key)).toBe('Clips/a.mp4')
    expect(libraryParentPath('Clips/2026')).toBe('Clips')
    expect(libraryParentPath('Clips')).toBe('')
    expect(libraryParentPath('')).toBeNull()
  })

  it('classifies files and hides housekeeping entries', () => {
    expect(libraryMediaKind('Intro.MP4')).toBe('video')
    expect(libraryMediaKind('set.wav')).toBe('audio')
    expect(libraryMediaKind('foto.JPG')).toBe('image')
    expect(libraryMediaKind('notes.txt')).toBeNull()
    expect(libraryMediaKind('mp4')).toBeNull()
    expect(isHiddenLibraryName('.DS_Store')).toBe(true)
    expect(isHiddenLibraryName('@eaDir')).toBe(true)
    expect(isHiddenLibraryName('#recycle')).toBe(true)
    expect(isHiddenLibraryName('Clips')).toBe(false)
  })

  it('allows linked videos up to 800 MB and registers the library source', () => {
    expect(LIBRARY_LIMITS.video).toBe(800 * 1024 * 1024)
    expect(libraryFileTooLarge('video', 800 * 1024 * 1024)).toBe(false)
    expect(libraryFileTooLarge('video', 800 * 1024 * 1024 + 1)).toBe(true)
    expect(libraryFileTooLarge('image', 16 * 1024 * 1024)).toBe(true)
    expect(isMediaSource('library')).toBe(true)
  })
})

describe('LibraryMediaStorage', () => {
  it('stays inside the root, including through symlinks', async () => {
    const root = await mkdtemp(join(tmpdir(), 'nl-library-'))
    const outside = await mkdtemp(join(tmpdir(), 'nl-outside-'))
    await mkdir(join(root, 'Clips'))
    await writeFile(join(root, 'Clips', 'a.mp4'), 'x')
    await writeFile(join(outside, 'secret.mp4'), 'x')
    await symlink(outside, join(root, 'escape'))
    await symlink(join(root, 'Clips', 'a.mp4'), join(root, 'alias.mp4'))

    const storage = new LibraryMediaStorage(root)
    expect(await storage.realPath('Clips/a.mp4')).toBe(join(await realpath(root), 'Clips', 'a.mp4'))
    expect(await storage.realPath('alias.mp4')).toContain('Clips/a.mp4')
    expect(() => storage.path('../outside')).toThrow('Unsafe storage path')
    await expect(storage.realPath('escape/secret.mp4')).rejects.toThrow('Unsafe storage path')
  })
})

describe('media probe parsing', () => {
  it('reads duration, size, fps and audio from ffprobe output', () => {
    expect(parseProbeOutput({
      format: { duration: '12.345' },
      streams: [
        { codec_type: 'video', width: 1920, height: 1080, avg_frame_rate: '30000/1001' },
        { codec_type: 'audio' },
      ],
    })).toEqual({ durationMs: 12345, width: 1920, height: 1080, fps: 29.97, hasAudio: true })
  })

  it('swaps dimensions for rotated phone video', () => {
    const result = parseProbeOutput({
      format: { duration: '3' },
      streams: [{ codec_type: 'video', width: 1920, height: 1080, avg_frame_rate: '30/1', side_data_list: [{ rotation: -90 }] }],
    })
    expect(result).toMatchObject({ width: 1080, height: 1920, hasAudio: false })
  })

  it('rejects files without a duration', () => {
    expect(() => parseProbeOutput({ streams: [] })).toThrow()
  })
})

describe('PeakCollector', () => {
  it('normalises peaks across chunk boundaries', () => {
    const samples = Buffer.alloc(8)
    samples.writeInt16LE(1000, 0)
    samples.writeInt16LE(-2000, 2)
    samples.writeInt16LE(500, 4)
    samples.writeInt16LE(100, 6)
    const collector = new PeakCollector(2)
    collector.push(samples.subarray(0, 3))
    collector.push(samples.subarray(3))
    expect(collector.finish()).toEqual([1, 0.25])
  })

  it('returns no peaks for silence', () => {
    const collector = new PeakCollector(4)
    collector.push(Buffer.alloc(16))
    expect(collector.finish()).toEqual([])
  })
})
