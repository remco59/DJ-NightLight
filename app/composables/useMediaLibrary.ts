import type { MediaLibraryItem, MediaLibraryResponse } from '~~/shared/media-library'

/**
 * The media library model shared by the Media page and every picker, so all
 * of them see the same assets, collections, usage and variants.
 */
export async function useMediaLibrary(options: { key?: string } = {}) {
  const request = await useFetch<MediaLibraryResponse>('/api/admin/media', {
    query: { kind: 'all' },
    key: options.key || 'media-library',
  })
  const assets = computed(() => request.data.value?.assets || [])
  const collections = computed(() => request.data.value?.collections || [])
  const gigs = computed(() => request.data.value?.options.gigs || [])
  const venues = computed(() => request.data.value?.options.venues || [])
  const byId = computed(() => new Map(assets.value.map(asset => [asset.id, asset])))
  return { ...request, assets, collections, gigs, venues, byId }
}

export type MediaBulkAction =
  | { action: 'addTags' | 'removeTags', tags: string }
  | { action: 'setGig', gigId: string | null }
  | { action: 'setVenue', venueId: string | null }
  | { action: 'addToCollection' | 'removeFromCollection', collectionId: string }
  | { action: 'moveToCollection', fromCollectionId: string, collectionId: string }
  | { action: 'delete' }

export type MediaDeleteResult = { deleted: string[], blocked: Array<{ id: string, references: string[] }>, missing: string[] }

export const mediaApi = {
  update(id: string, body: Partial<Pick<MediaLibraryItem, 'title' | 'altText' | 'gigId' | 'venueId' | 'parentAssetId' | 'variantLabel' | 'collectionIds'>> & { tags?: string | string[] }) {
    return $fetch(`/api/admin/media/${id}` as `/api/admin/media/${string}`, { method: 'PUT', body })
  },
  bulk<T = { updated: number }>(ids: string[], action: MediaBulkAction) {
    return $fetch<T>('/api/admin/media/bulk', { method: 'POST', body: { ids, ...action } })
  },
  createCollection(name: string, assetIds: string[] = []) {
    return $fetch<{ collection: { id: string, name: string } }>('/api/admin/media/collections', { method: 'POST', body: { name, assetIds } })
  },
  updateCollection(id: string, body: { name?: string, description?: string, sortOrder?: number }) {
    return $fetch(`/api/admin/media/collections/${id}` as `/api/admin/media/collections/${string}`, { method: 'PUT', body })
  },
  deleteCollection(id: string) {
    return $fetch(`/api/admin/media/collections/${id}` as `/api/admin/media/collections/${string}`, { method: 'DELETE' })
  },
}

export function mediaDownloadUrl(item: Pick<MediaLibraryItem, 'id'>) {
  return `/api/media/${item.id}?download=1`
}

export function mediaArchiveUrl(ids: string[]) {
  return `/api/admin/media/download?ids=${ids.join(',')}`
}

/** Absolute link to the original, for pasting into socials or chats. */
export function mediaPublicUrl(item: Pick<MediaLibraryItem, 'url'>) {
  return import.meta.client ? new URL(item.url, window.location.origin).toString() : item.url
}

export function startDownload(href: string) {
  const link = document.createElement('a')
  link.href = href
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
}
