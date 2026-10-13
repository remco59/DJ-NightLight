import { describe, expect, it } from 'vitest'
import { formatOfflineNote, appendNote } from '../shared/offline-note'
import { offlineChangeSchema } from '../shared/schemas/offline-change'
import { monthGridRange } from '../app/utils/calendar-range'
import { classifyFailure, flushEntries, memoryStore, mergeStatusChange, type OutboxEntry } from '../app/utils/offline-outbox'

const gigId = '123e4567-e89b-12d3-a456-426614174000'
function entry(partial: Partial<OutboxEntry>): OutboxEntry {
  return { id: crypto.randomUUID(), userId: 'u1', gigId, gigTitle: 'Bruiloft', kind: 'note', text: 'x', createdAt: '2026-10-13T10:00:00.000Z', state: 'pending', ...partial }
}

describe('offline change schema', () => {
  const base = { changeId: crypto.randomUUID(), createdAt: '2026-10-13T10:00:00.000Z' }
  it('accepts notes and status changes', () => {
    expect(offlineChangeSchema.safeParse({ ...base, kind: 'note', text: ' Zaal heeft geen stroom links ' }).success).toBe(true)
    expect(offlineChangeSchema.safeParse({ ...base, kind: 'status', status: 'booked', expectedStatus: 'lead' }).success).toBe(true)
  })
  it('rejects empty notes, unknown statuses and unknown kinds', () => {
    expect(offlineChangeSchema.safeParse({ ...base, kind: 'note', text: '   ' }).success).toBe(false)
    expect(offlineChangeSchema.safeParse({ ...base, kind: 'status', status: 'done', expectedStatus: 'lead' }).success).toBe(false)
    expect(offlineChangeSchema.safeParse({ ...base, kind: 'delete' }).success).toBe(false)
    expect(offlineChangeSchema.safeParse({ kind: 'note', text: 'a' }).success).toBe(false)
  })
})

describe('offline notes', () => {
  it('adds a header with the time and author, in Amsterdam time', () => {
    expect(formatOfflineNote(' Laden via de achterdeur ', 'Remco', new Date('2026-10-13T19:04:00Z'))).toBe('[13 okt 2026 21:04 · Remco] Laden via de achterdeur')
  })
  it('appends instead of replacing', () => {
    expect(appendNote(null, 'nieuw')).toBe('nieuw')
    expect(appendNote('', 'nieuw')).toBe('nieuw')
    expect(appendNote('oud\n', 'nieuw')).toBe('oud\n\nnieuw')
  })
})

describe('agenda month range', () => {
  it('starts on the Monday on or before the 1st and spans six weeks', () => {
    const { start, end } = monthGridRange(new Date(2026, 9, 13))
    expect([start.getFullYear(), start.getMonth(), start.getDate()]).toEqual([2026, 8, 28])
    expect(start.getDay()).toBe(1)
    expect([end.getFullYear(), end.getMonth(), end.getDate()]).toEqual([2026, 10, 9])
    // The 1st being a Monday starts that very day.
    expect(monthGridRange(new Date(2026, 5, 20)).start.getDate()).toBe(1)
    // The 1st being a Sunday starts six days earlier.
    expect(monthGridRange(new Date(2026, 1, 3)).start.getDate()).toBe(26)
  })
})

describe('outbox failures', () => {
  it('tells connection loss, session expiry, conflicts and other refusals apart', () => {
    expect(classifyFailure(new TypeError('Failed to fetch'))).toBe('offline')
    expect(classifyFailure({ statusCode: 401 })).toBe('auth')
    expect(classifyFailure({ response: { status: 409 } })).toBe('conflict')
    expect(classifyFailure({ statusCode: 404 })).toBe('error')
  })
})

describe('status changes in the queue', () => {
  it('ignores a change to the status the gig already has', () => {
    expect(mergeStatusChange(undefined, entry({ kind: 'status', status: 'lead', expectedStatus: 'lead' }))).toBeNull()
  })
  it('keeps the first status the device saw when changed twice, and cancels when changed back', () => {
    const first = entry({ kind: 'status', status: 'booked', expectedStatus: 'lead' })
    const second = entry({ kind: 'status', status: 'declined', expectedStatus: 'lead', createdAt: '2026-10-13T11:00:00.000Z' })
    expect(mergeStatusChange(first, second)).toMatchObject({ id: first.id, status: 'declined', expectedStatus: 'lead', createdAt: second.createdAt })
    expect(mergeStatusChange(first, entry({ kind: 'status', status: 'lead', expectedStatus: 'lead' }))).toBeNull()
  })
})

describe('flushing the outbox', () => {
  const messageFor = () => 'refused'

  it('sends oldest first, only for this user, and removes what was sent', async () => {
    const store = memoryStore()
    await store.put(entry({ id: 'b', createdAt: '2026-10-13T12:00:00.000Z' }))
    await store.put(entry({ id: 'a', createdAt: '2026-10-13T10:00:00.000Z' }))
    await store.put(entry({ id: 'other', userId: 'u2' }))
    const sent: string[] = []
    const result = await flushEntries(store, 'u1', async (item) => { sent.push(item.id) }, messageFor)
    expect(sent).toEqual(['a', 'b'])
    expect(result).toEqual({ synced: 2, stoppedBy: null })
    expect((await store.all()).map(item => item.id)).toEqual(['other'])
  })

  it('stops and keeps everything when the connection drops', async () => {
    const store = memoryStore()
    await store.put(entry({ id: 'a', createdAt: '2026-10-13T10:00:00.000Z' }))
    await store.put(entry({ id: 'b', createdAt: '2026-10-13T11:00:00.000Z' }))
    const result = await flushEntries(store, 'u1', async (item) => { if (item.id === 'b') throw new TypeError('Failed to fetch') }, messageFor)
    expect(result).toEqual({ synced: 1, stoppedBy: 'offline' })
    expect((await store.all()).map(item => item.id)).toEqual(['b'])
  })

  it('keeps a session expiry for later instead of discarding the change', async () => {
    const store = memoryStore()
    await store.put(entry({ id: 'a' }))
    const result = await flushEntries(store, 'u1', async () => { throw { statusCode: 401 } }, messageFor)
    expect(result.stoppedBy).toBe('auth')
    expect((await store.all())[0]).toMatchObject({ id: 'a', state: 'pending' })
  })

  it('marks a refused change and carries on with the next one', async () => {
    const store = memoryStore()
    await store.put(entry({ id: 'a', kind: 'status', status: 'booked', expectedStatus: 'lead', createdAt: '2026-10-13T10:00:00.000Z' }))
    await store.put(entry({ id: 'b', createdAt: '2026-10-13T11:00:00.000Z' }))
    const result = await flushEntries(store, 'u1', async (item) => { if (item.id === 'a') throw { statusCode: 409 } }, messageFor)
    expect(result.synced).toBe(1)
    const left = await store.all()
    expect(left).toHaveLength(1)
    expect(left[0]).toMatchObject({ id: 'a', state: 'conflict', error: 'refused' })
    // A refused change is not sent again by the next sync.
    const again = await flushEntries(store, 'u1', async () => { throw new Error('should not be called') }, messageFor)
    expect(again.synced).toBe(0)
  })
})
