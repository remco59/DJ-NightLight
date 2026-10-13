import type { GigStatus } from '~~/shared/gig-rules'

// Changes made while offline (a note or a status change on a gig) wait here, in
// IndexedDB on this device, until the connection is back. They survive closing
// the app. Only gig notes and status changes are queued: they cannot overwrite
// anyone else's work (notes are appended, a status change is checked against the
// status the device saw).
export type OutboxEntry = {
  id: string
  userId: string
  gigId: string
  gigTitle: string
  kind: 'note' | 'status'
  text?: string
  status?: GigStatus
  expectedStatus?: GigStatus
  createdAt: string
  // pending: waiting to be sent. conflict/error: the server refused it, the user decides.
  state: 'pending' | 'conflict' | 'error'
  error?: string
}

export interface OutboxStore {
  all(): Promise<OutboxEntry[]>
  put(entry: OutboxEntry): Promise<void>
  remove(id: string): Promise<void>
}

const DB_NAME = 'nightlight-offline'
const STORE = 'outbox'

function request<T>(req: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export function indexedDbStore(): OutboxStore {
  const opened = new Promise<IDBDatabase>((resolve, reject) => {
    const open = indexedDB.open(DB_NAME, 1)
    open.onupgradeneeded = () => open.result.createObjectStore(STORE, { keyPath: 'id' })
    open.onsuccess = () => resolve(open.result)
    open.onerror = () => reject(open.error)
  })
  const store = async (mode: IDBTransactionMode) => (await opened).transaction(STORE, mode).objectStore(STORE)
  return {
    async all() { return request<OutboxEntry[]>((await store('readonly')).getAll()) },
    async put(entry) { await request((await store('readwrite')).put(entry)) },
    async remove(id) { await request((await store('readwrite')).delete(id)) },
  }
}

export function memoryStore(): OutboxStore {
  const map = new Map<string, OutboxEntry>()
  return {
    async all() { return [...map.values()] },
    async put(entry) { map.set(entry.id, { ...entry }) },
    async remove(id) { map.delete(id) },
  }
}

export type SendFailure = 'offline' | 'auth' | 'conflict' | 'error'

export function classifyFailure(error: unknown): SendFailure {
  const status = (error as { statusCode?: number, status?: number, response?: { status?: number } })
  const code = status.statusCode ?? status.response?.status ?? status.status
  if (!code) return 'offline'
  if (code === 401) return 'auth'
  if (code === 409) return 'conflict'
  return 'error'
}

export function sortedPending(entries: OutboxEntry[], userId: string) {
  return entries
    .filter(entry => entry.userId === userId && entry.state === 'pending')
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

// Sends the waiting entries one by one, oldest first. Stops at the first sign that
// the connection or the session is gone and keeps everything not yet sent.
export async function flushEntries(
  store: OutboxStore,
  userId: string,
  send: (entry: OutboxEntry) => Promise<void>,
  messageFor: (error: unknown) => string,
) {
  let synced = 0
  for (const entry of sortedPending(await store.all(), userId)) {
    try {
      await send(entry)
      await store.remove(entry.id)
      synced++
    } catch (error) {
      const failure = classifyFailure(error)
      if (failure === 'offline' || failure === 'auth') return { synced, stoppedBy: failure }
      await store.put({ ...entry, state: failure, error: messageFor(error) })
    }
  }
  return { synced, stoppedBy: null }
}

// One waiting status change per gig. A second change replaces the first but keeps
// the status the device originally saw; changing back to that status cancels it.
export function mergeStatusChange(existing: OutboxEntry | undefined, next: OutboxEntry): OutboxEntry | null {
  if (!existing) return next.status === next.expectedStatus ? null : next
  if (next.status === existing.expectedStatus) return null
  return { ...existing, status: next.status, createdAt: next.createdAt }
}
