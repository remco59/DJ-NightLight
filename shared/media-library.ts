import { humanizeFilename, mediaKindFromMime, type MediaSource } from './media'

/** Where an asset is referenced. `blocking` usages prevent deletion. */
export type MediaUsageKind = 'website' | 'landing_page' | 'video_project' | 'video_render' | 'post_generator'
export type MediaUsage = {
  kind: MediaUsageKind
  label: string
  to: string | null
  blocking: boolean
}

export const MEDIA_USAGE_LABELS: Record<MediaUsageKind, string> = {
  website: 'Website',
  landing_page: 'Landing page',
  video_project: 'Video generator',
  video_render: 'Video render',
  post_generator: 'Post generator',
}

/** One asset as the library, the picker and the inspector see it. */
export type MediaLibraryItem = {
  id: string
  originalFilename: string
  mimeType: string
  byteSize: number
  width: number
  height: number
  durationMs: number | null
  title: string
  altText: string
  tags: string[]
  gigId: string | null
  gigTitle: string | null
  gigStartsAt: string | null
  venueId: string | null
  venueName: string | null
  source: MediaSource
  parentAssetId: string | null
  variantLabel: string
  variantCount: number
  collectionIds: string[]
  usage: MediaUsage[]
  createdAt: string
  updatedAt: string
  url: string
  thumbnailUrl: string | null
}

export type MediaCollectionSummary = {
  id: string
  name: string
  description: string
  sortOrder: number
  itemCount: number
  coverUrls: string[]
}

export type MediaLibraryResponse = {
  assets: MediaLibraryItem[]
  collections: MediaCollectionSummary[]
  options: {
    gigs: Array<{ id: string, title: string, startsAt: string | null }>
    venues: Array<{ id: string, name: string }>
  }
}

export type MediaTypeTab = 'all' | 'photo' | 'video' | 'generated'
export type MediaOrientation = 'landscape' | 'portrait' | 'square'
export type MediaSort = 'newest' | 'oldest' | 'title' | 'largest' | 'updated' | 'gig_date'

export type MediaLibraryFilters = {
  query: string
  type: MediaTypeTab
  kind: '' | 'image' | 'video' | 'audio'
  gigId: string
  venueId: string
  tags: string[]
  source: '' | MediaSource
  orientation: '' | MediaOrientation
  added: '' | '7d' | '30d' | '90d' | '365d'
  usage: '' | 'used' | 'unused'
  collectionId: string
  variants: '' | 'originals' | 'variants'
}

/** Filter keys set from the Filters menu (the tabs, search and collections row live elsewhere). */
export const ADVANCED_FILTER_KEYS = ['kind', 'gigId', 'venueId', 'tags', 'source', 'orientation', 'added', 'usage', 'variants'] as const

export const MEDIA_SORT_OPTIONS: Array<{ value: MediaSort, label: string }> = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'updated', label: 'Recently edited' },
  { value: 'gig_date', label: 'Gig date' },
  { value: 'title', label: 'Title A–Z' },
  { value: 'largest', label: 'Largest file' },
]

export function defaultMediaFilters(): MediaLibraryFilters {
  return {
    query: '',
    type: 'all',
    kind: '',
    gigId: '',
    venueId: '',
    tags: [],
    source: '',
    orientation: '',
    added: '',
    usage: '',
    collectionId: '',
    variants: '',
  }
}

export function activeAdvancedFilterCount(filters: MediaLibraryFilters) {
  return ADVANCED_FILTER_KEYS.filter((key) => {
    const value = filters[key]
    return Array.isArray(value) ? value.length > 0 : Boolean(value)
  }).length
}

export function mediaDisplayTitle(item: Pick<MediaLibraryItem, 'title' | 'originalFilename'>) {
  return item.title.trim() || humanizeFilename(item.originalFilename) || item.originalFilename
}

export function mediaOrientation(item: Pick<MediaLibraryItem, 'width' | 'height'>): MediaOrientation | null {
  if (!item.width || !item.height) return null
  const ratio = item.width / item.height
  if (ratio > 1.05) return 'landscape'
  if (ratio < 0.95) return 'portrait'
  return 'square'
}

export function matchesMediaTab(item: Pick<MediaLibraryItem, 'mimeType' | 'source'>, tab: MediaTypeTab) {
  const kind = mediaKindFromMime(item.mimeType)
  if (tab === 'photo') return kind === 'image' && item.source !== 'generated'
  if (tab === 'video') return kind === 'video'
  if (tab === 'generated') return item.source === 'generated'
  return true
}

const ADDED_WINDOWS_DAYS = { '7d': 7, '30d': 30, '90d': 90, '365d': 365 } as const

export function mediaSearchText(item: MediaLibraryItem) {
  return [
    item.title,
    item.altText,
    item.originalFilename,
    item.variantLabel,
    item.gigTitle || '',
    item.venueName || '',
    item.tags.join(' '),
  ].join(' ').toLowerCase()
}

export function filterMediaItems(items: MediaLibraryItem[], filters: MediaLibraryFilters, now = new Date()) {
  const terms = filters.query.trim().toLowerCase().split(/\s+/).filter(Boolean)
  const addedAfter = filters.added ? now.getTime() - ADDED_WINDOWS_DAYS[filters.added] * 86_400_000 : 0

  return items.filter((item) => {
    if (!matchesMediaTab(item, filters.type)) return false
    if (filters.kind && mediaKindFromMime(item.mimeType) !== filters.kind) return false
    if (filters.gigId === 'none' ? item.gigId : filters.gigId && item.gigId !== filters.gigId) return false
    if (filters.venueId === 'none' ? item.venueId : filters.venueId && item.venueId !== filters.venueId) return false
    if (filters.tags.length && !filters.tags.every(tag => item.tags.includes(tag))) return false
    if (filters.source && item.source !== filters.source) return false
    if (filters.orientation && mediaOrientation(item) !== filters.orientation) return false
    if (addedAfter && new Date(item.createdAt).getTime() < addedAfter) return false
    if (filters.usage === 'used' && !item.usage.length) return false
    if (filters.usage === 'unused' && item.usage.length) return false
    if (filters.collectionId && !item.collectionIds.includes(filters.collectionId)) return false
    if (filters.variants === 'originals' && item.parentAssetId) return false
    if (filters.variants === 'variants' && !item.parentAssetId) return false
    if (!terms.length) return true
    const haystack = mediaSearchText(item)
    return terms.every(term => haystack.includes(term))
  })
}

function time(value: string | null) {
  return value ? new Date(value).getTime() : 0
}

export function sortMediaItems(items: MediaLibraryItem[], sort: MediaSort) {
  const sorted = [...items]
  const byNewest = (a: MediaLibraryItem, b: MediaLibraryItem) => time(b.createdAt) - time(a.createdAt)
  switch (sort) {
    case 'oldest': return sorted.sort((a, b) => time(a.createdAt) - time(b.createdAt))
    case 'updated': return sorted.sort((a, b) => time(b.updatedAt) - time(a.updatedAt))
    case 'gig_date': return sorted.sort((a, b) => time(b.gigStartsAt) - time(a.gigStartsAt) || byNewest(a, b))
    case 'title': return sorted.sort((a, b) => mediaDisplayTitle(a).localeCompare(mediaDisplayTitle(b), 'nl', { numeric: true }))
    case 'largest': return sorted.sort((a, b) => b.byteSize - a.byteSize)
    default: return sorted.sort(byNewest)
  }
}

/** Every tag in use, most used first, for tag filters and suggestions. */
export function collectMediaTags(items: Array<Pick<MediaLibraryItem, 'tags'>>) {
  const counts = new Map<string, number>()
  for (const item of items) {
    for (const tag of item.tags) counts.set(tag, (counts.get(tag) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([tag]) => tag)
}

/**
 * An asset's family: its original (when it is a variant) plus every variant
 * of that original, so a crop and its source always show up together.
 */
export function mediaFamily(items: MediaLibraryItem[], item: MediaLibraryItem) {
  const rootId = item.parentAssetId && items.some(candidate => candidate.id === item.parentAssetId)
    ? item.parentAssetId
    : item.id
  const root = items.find(candidate => candidate.id === rootId) || item
  const variants = items.filter(candidate => candidate.parentAssetId === root.id)
  return { original: root, variants }
}

/** Assets from the same gig, else the same venue, excluding the item's own family. */
export function relatedMediaItems(items: MediaLibraryItem[], item: MediaLibraryItem, limit = 8) {
  const family = mediaFamily(items, item)
  const familyIds = new Set([family.original.id, ...family.variants.map(variant => variant.id)])
  const pool = items.filter(candidate => !familyIds.has(candidate.id))
  const sameGig = item.gigId ? pool.filter(candidate => candidate.gigId === item.gigId) : []
  const sameVenue = item.venueId ? pool.filter(candidate => candidate.venueId === item.venueId && !sameGig.includes(candidate)) : []
  return [...sameGig, ...sameVenue].slice(0, limit)
}

export function formatMediaBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`
}

export function formatMediaDuration(ms: number | null | undefined) {
  if (!ms || ms < 0) return ''
  const total = Math.round(ms / 1000)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = String(total % 60).padStart(2, '0')
  return hours ? `${hours}:${String(minutes).padStart(2, '0')}:${seconds}` : `${minutes}:${seconds}`
}

export function formatMediaDate(value: string | null, withTime = false) {
  if (!value) return ''
  return new Intl.DateTimeFormat('nl-NL', withTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' },
  ).format(new Date(value)).replace('.', '')
}

/** Card subline: venue (or gig) and the gig date, falling back to the upload date. */
export function mediaSubline(item: MediaLibraryItem) {
  const place = item.venueName || item.gigTitle || ''
  const date = formatMediaDate(item.gigStartsAt || item.createdAt)
  return [place, date].filter(Boolean).join(' • ')
}

export function mediaTypeLabel(item: Pick<MediaLibraryItem, 'mimeType' | 'source'>) {
  const kind = mediaKindFromMime(item.mimeType)
  const format = item.mimeType.split('/')[1]?.replace('jpeg', 'jpg').replace('quicktime', 'mov').replace('mpeg', 'mp3').toUpperCase() || ''
  const noun = kind === 'image' ? 'image' : kind
  return `${format} ${item.source === 'generated' ? `generated ${noun}` : noun}`.trim()
}
