import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { humanizeFilename, isMediaSource } from '../shared/media'
import {
  activeAdvancedFilterCount,
  collectMediaTags,
  defaultMediaFilters,
  filterMediaItems,
  formatMediaDate,
  formatMediaDuration,
  matchesMediaTab,
  mediaDisplayTitle,
  mediaFamily,
  mediaOrientation,
  relatedMediaItems,
  sortMediaItems,
  type MediaLibraryItem,
} from '../shared/media-library'
import { uniqueZipNames, writeStoredZip } from '../server/utils/zip'

function item(overrides: Partial<MediaLibraryItem> & { id: string }): MediaLibraryItem {
  return {
    originalFilename: `${overrides.id}.jpg`,
    mimeType: 'image/jpeg',
    byteSize: 1000,
    width: 3000,
    height: 2000,
    durationMs: null,
    title: '',
    altText: '',
    tags: [],
    gigId: null,
    gigTitle: null,
    gigStartsAt: null,
    venueId: null,
    venueName: null,
    source: 'upload',
    parentAssetId: null,
    variantLabel: '',
    variantCount: 0,
    collectionIds: [],
    usage: [],
    createdAt: '2026-09-01T10:00:00.000Z',
    updatedAt: '2026-09-01T10:00:00.000Z',
    url: `/api/media/${overrides.id}`,
    thumbnailUrl: `/api/media/${overrides.id}?variant=thumb`,
    ...overrides,
  }
}

const library = [
  item({ id: 'a', title: 'Crowd vibes', tags: ['crowd', 'club'], venueId: 'v1', venueName: 'Club Nova', gigId: 'g1', gigTitle: 'NYE', createdAt: '2026-09-20T10:00:00.000Z', collectionIds: ['promo'] }),
  item({ id: 'b', originalFilename: 'JDS_0119.jpg', width: 2000, height: 3000, tags: ['dj'], usage: [{ kind: 'website', label: 'Website', to: '/admin/content', blocking: true }] }),
  item({ id: 'c', mimeType: 'video/mp4', durationMs: 24_000, title: 'Behind the decks', byteSize: 9000, gigId: 'g1', createdAt: '2026-01-01T10:00:00.000Z' }),
  item({ id: 'd', source: 'generated', parentAssetId: 'a', variantLabel: 'Post 4:5', title: 'NYE post', mimeType: 'image/png', width: 1080, height: 1080 }),
  item({ id: 'e', source: 'derived', parentAssetId: 'a', variantLabel: 'Enhanced NR', gigId: 'g1' }),
]

describe('media library model', () => {
  it('gives files a readable title and recognises sources', () => {
    expect(humanizeFilename('JDS_0119.jpg')).toBe('JDS 0119')
    expect(humanizeFilename('main-room__moments.webp')).toBe('main room moments')
    expect(mediaDisplayTitle(library[1]!)).toBe('JDS 0119')
    expect(isMediaSource('generated')).toBe(true)
    expect(isMediaSource('ftp')).toBe(false)
  })

  it('splits the type tabs so generated posts are not listed as photos', () => {
    expect(library.filter(entry => matchesMediaTab(entry, 'photo')).map(entry => entry.id)).toEqual(['a', 'b', 'e'])
    expect(library.filter(entry => matchesMediaTab(entry, 'video')).map(entry => entry.id)).toEqual(['c'])
    expect(library.filter(entry => matchesMediaTab(entry, 'generated')).map(entry => entry.id)).toEqual(['d'])
  })

  it('searches title, filename, tags, gig and venue with every term required', () => {
    const run = (query: string) => filterMediaItems(library, { ...defaultMediaFilters(), query }).map(entry => entry.id)
    expect(run('nova crowd')).toEqual(['a'])
    expect(run('jds')).toEqual(['b'])
    expect(run('nye')).toEqual(['a', 'd'])
  })

  it('applies advanced filters and counts them', () => {
    const now = new Date('2026-09-24T10:00:00.000Z')
    const base = defaultMediaFilters()
    const ids = (filters: Partial<typeof base>) => filterMediaItems(library, { ...base, ...filters }, now).map(entry => entry.id)
    expect(ids({ usage: 'used' })).toEqual(['b'])
    expect(ids({ usage: 'unused' })).not.toContain('b')
    expect(ids({ orientation: 'portrait' })).toEqual(['b'])
    expect(ids({ orientation: 'square' })).toEqual(['d'])
    expect(ids({ added: '7d' })).toEqual(['a'])
    expect(ids({ gigId: 'g1' })).toEqual(['a', 'c', 'e'])
    expect(ids({ gigId: 'none' })).toEqual(['b', 'd'])
    expect(ids({ tags: ['crowd', 'club'] })).toEqual(['a'])
    expect(ids({ collectionId: 'promo' })).toEqual(['a'])
    expect(ids({ variants: 'originals' })).toEqual(['a', 'b', 'c'])
    expect(ids({ source: 'derived' })).toEqual(['e'])
    expect(activeAdvancedFilterCount({ ...base, tags: ['x'], usage: 'used', query: 'ignored' })).toBe(2)
  })

  it('sorts newest, by title and by size', () => {
    expect(sortMediaItems(library, 'newest')[0]!.id).toBe('a')
    expect(sortMediaItems(library, 'oldest')[0]!.id).toBe('c')
    expect(sortMediaItems(library, 'largest')[0]!.id).toBe('c')
    expect(sortMediaItems(library, 'title').map(entry => entry.id).slice(0, 2)).toEqual(['c', 'a'])
  })

  it('groups an original with its variants and finds related assets outside the family', () => {
    const family = mediaFamily(library, library[3]!)
    expect(family.original.id).toBe('a')
    expect(family.variants.map(entry => entry.id)).toEqual(['d', 'e'])
    expect(relatedMediaItems(library, library[0]!).map(entry => entry.id)).toEqual(['c'])
  })

  it('reads orientation, tags and display formats', () => {
    expect(mediaOrientation({ width: 0, height: 0 })).toBeNull()
    expect(collectMediaTags(library)).toEqual(['club', 'crowd', 'dj'])
    expect(formatMediaDuration(24_000)).toBe('0:24')
    expect(formatMediaDuration(3_725_000)).toBe('1:02:05')
    expect(formatMediaDate('2024-01-12T12:00:00.000Z')).toBe('12 jan 2024')
  })
})

describe('media ZIP downloads', () => {
  it('keeps archive names unique and safe', () => {
    expect(uniqueZipNames(['a.jpg', 'A.jpg', 'b/c.jpg', 'a.jpg'])).toEqual(['a.jpg', 'A (2).jpg', 'b_c.jpg', 'a (3).jpg'])
  })

  it('writes an archive that unzip can verify', async () => {
    const chunks: Uint8Array[] = []
    async function* entries() {
      yield { name: 'one.txt', data: new TextEncoder().encode('hello'), modifiedAt: new Date('2026-09-24T10:00:00') }
      yield { name: 'twee.txt', data: new TextEncoder().encode('nightlight'), modifiedAt: new Date('2026-09-24T10:00:00') }
    }
    await writeStoredZip(entries(), (chunk) => { chunks.push(chunk) })
    const dir = mkdtempSync(join(tmpdir(), 'nl-zip-'))
    const file = join(dir, 'test.zip')
    writeFileSync(file, Buffer.concat(chunks))
    let output: string
    try {
      output = execFileSync('unzip', ['-t', file], { encoding: 'utf8' })
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return
      throw error
    }
    expect(output).toContain('No errors detected')
    expect(execFileSync('unzip', ['-p', file, 'twee.txt'], { encoding: 'utf8' })).toBe('nightlight')
  })
})
