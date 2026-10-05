import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultSiteContent } from '../server/utils/site-content-defaults'

const requireStaff = vi.fn()
const returning = vi.fn()
const onConflictDoUpdate = vi.fn(() => ({ returning }))
const values = vi.fn(() => ({ onConflictDoUpdate }))
const insert = vi.fn(() => ({ values }))

vi.mock('../server/utils/require-staff', () => ({ requireStaff }))
vi.mock('../server/utils/db', () => ({ db: { insert } }))
vi.mock('../db/schema', () => ({ siteContent: { key: 'key' } }))

let body: unknown
vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('readBody', async () => body)
vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => Object.assign(new Error(input.statusMessage), input))

const { default: putContent } = await import('../server/api/admin/content.put')
const event = {} as never

const mediaUrl = '/api/media/123e4567-e89b-42d3-a456-426614174000'

describe('PUT /api/admin/content', () => {
  beforeEach(() => {
    requireStaff.mockReset().mockResolvedValue({ id: 'u1', role: 'content_editor' })
    returning.mockReset().mockImplementation(async () => [{ id: 'row' }])
    values.mockClear()
    onConflictDoUpdate.mockClear()
    insert.mockClear()
    body = structuredClone(defaultSiteContent)
  })

  it('only allows owners, managers and content editors', async () => {
    await putContent(event)
    expect(requireStaff).toHaveBeenCalledWith(event, ['owner', 'manager', 'content_editor'])
  })

  it('saves with optional fields empty or null (website editor ValidationError regression)', async () => {
    body = {
      ...(body as object),
      heroImageUrl: '',
      showreelUrl: null,
      contactEmail: '',
      contactPhone: null,
      instagramUrl: '',
      spotifyUrl: null,
      seoImageUrl: '',
    }

    await expect(putContent(event)).resolves.toEqual({ content: { id: 'row' } })

    const saved = (values.mock.calls[0] as unknown as [Record<string, unknown>])[0]
    expect(saved).toMatchObject({
      key: 'default',
      heroImageUrl: null,
      showreelUrl: null,
      contactEmail: null,
      contactPhone: null,
      instagramUrl: null,
      spotifyUrl: null,
      seoImageUrl: null,
    })
  })

  it('saves uploaded media in the hero, services and gallery (editor saving with uploaded media)', async () => {
    body = {
      ...(body as object),
      heroImageUrl: mediaUrl,
      services: [{ title: 'Bruiloft', body: 'Tekst', imageUrl: mediaUrl, imageAlt: 'Dansvloer' }],
      gallery: [{ url: mediaUrl, alt: 'Foto' }, { url: mediaUrl, alt: '' }],
    }

    await putContent(event)

    const saved = (values.mock.calls[0] as unknown as [Record<string, unknown>])[0]
    expect(saved.heroImageUrl).toBe(mediaUrl)
    expect(saved.services).toEqual([{ title: 'Bruiloft', body: 'Tekst', imageUrl: mediaUrl, imageAlt: 'Dansvloer' }])
    expect(saved.gallery).toHaveLength(2)
  })

  it('ignores extra database columns that come back from GET (id, timestamps)', async () => {
    body = { ...(body as object), id: 'row', createdAt: '2026-01-01', updatedAt: '2026-01-02', key: 'other' }

    await putContent(event)

    const saved = (values.mock.calls[0] as unknown as [Record<string, unknown>])[0]
    expect(saved.key).toBe('default')
    expect(saved).not.toHaveProperty('id')
    expect(saved).not.toHaveProperty('createdAt')
  })

  it('answers invalid content with 422 and the offending field, without touching the database', async () => {
    body = { ...(body as object), gallery: [{ url: 'javascript:alert(1)', alt: 'x' }] }

    await expect(putContent(event)).rejects.toMatchObject({ statusCode: 422, statusMessage: expect.stringContaining('gallery.0.url') })
    expect(insert).not.toHaveBeenCalled()
  })

  it('answers a missing body with 422', async () => {
    body = undefined
    await expect(putContent(event)).rejects.toMatchObject({ statusCode: 422 })
    expect(insert).not.toHaveBeenCalled()
  })

  it('does not save when the user may not edit content', async () => {
    requireStaff.mockRejectedValue(Object.assign(new Error('Geen toegang'), { statusCode: 403 }))
    await expect(putContent(event)).rejects.toMatchObject({ statusCode: 403 })
    expect(insert).not.toHaveBeenCalled()
  })

  it('reports a failed save as 500', async () => {
    returning.mockResolvedValue([])
    await expect(putContent(event)).rejects.toMatchObject({ statusCode: 500 })
  })
})
