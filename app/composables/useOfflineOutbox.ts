import { apiErrorMessage } from '~/utils/api-error'
import { flushEntries, indexedDbStore, mergeStatusChange } from '~/utils/offline-outbox'
import type { OutboxEntry, OutboxStore } from '~/utils/offline-outbox'
import type { GigStatus } from '~~/shared/gig-rules'

let store: OutboxStore | null = null
function getStore() {
  store ??= indexedDbStore()
  return store
}

// Client-only: the list of changes waiting to be sent, and the actions on it.
export function useOfflineOutbox() {
  const { user } = useUserSession()
  const entries = useState<OutboxEntry[]>('offline-outbox', () => [])
  // Bumped after a sync, so open pages know to reload their data.
  const syncedAt = useState('offline-outbox-synced', () => 0)
  const syncing = useState('offline-outbox-syncing', () => false)
  const supported = import.meta.client && 'indexedDB' in window

  const mine = computed(() => entries.value.filter(entry => entry.userId === user.value?.id))
  const waiting = computed(() => mine.value.filter(entry => entry.state === 'pending'))
  const refused = computed(() => mine.value.filter(entry => entry.state !== 'pending'))
  const forGig = (gigId: string) => computed(() => mine.value.filter(entry => entry.gigId === gigId))

  async function load() {
    if (!supported) return
    try { entries.value = await getStore().all() } catch { entries.value = [] }
  }

  async function add(entry: Omit<OutboxEntry, 'id' | 'userId' | 'createdAt' | 'state'>) {
    if (!supported || !user.value) throw new Error('Opslaan op dit apparaat is niet mogelijk.')
    const full: OutboxEntry = { ...entry, id: crypto.randomUUID(), userId: user.value.id, createdAt: new Date().toISOString(), state: 'pending' }
    const existing = full.kind === 'status' ? waiting.value.find(item => item.gigId === full.gigId && item.kind === 'status') : undefined
    if (full.kind === 'status') {
      const merged = mergeStatusChange(existing, full)
      if (existing) await getStore().remove(existing.id)
      if (merged) await getStore().put(merged)
    } else {
      await getStore().put(full)
    }
    await load()
  }

  const addNote = (gig: { id: string, title: string }, text: string) =>
    add({ gigId: gig.id, gigTitle: gig.title, kind: 'note', text: text.trim() })
  const changeStatus = (gig: { id: string, title: string }, status: GigStatus, expectedStatus: GigStatus) =>
    add({ gigId: gig.id, gigTitle: gig.title, kind: 'status', status, expectedStatus })

  async function discard(id: string) {
    if (!supported) return
    await getStore().remove(id)
    await load()
  }

  async function flush() {
    const userId = user.value?.id
    if (!supported || !userId || syncing.value || !navigator.onLine) return 0
    syncing.value = true
    try {
      await load()
      const result = await flushEntries(getStore(), userId, (entry) => {
        const body = entry.kind === 'note'
          ? { kind: 'note', text: entry.text }
          : { kind: 'status', status: entry.status, expectedStatus: entry.expectedStatus }
        return $fetch(`/api/admin/gigs/${entry.gigId}/offline-changes`, {
          method: 'POST', retry: 0, body: { ...body, changeId: entry.id, createdAt: entry.createdAt },
        }).then(() => undefined)
      }, error => apiErrorMessage(error, 'Synchroniseren is niet gelukt.'))
      await load()
      if (result.synced) syncedAt.value = Date.now()
      return result.synced
    } finally {
      syncing.value = false
    }
  }

  return { entries, mine, waiting, refused, forGig, syncing, syncedAt, load, addNote, changeStatus, discard, flush }
}
