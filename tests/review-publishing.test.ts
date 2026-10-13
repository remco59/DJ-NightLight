import { beforeEach, describe, expect, it, vi } from 'vitest'

let review: { comment: string | null, publicConsent: boolean, gigId: string } | undefined
let publicRows: Array<{ rating: number, comment: string | null, authorName: string | null, createdAt: Date }> = []
let updated: Record<string, unknown> | null = null
const audits: Array<Record<string, unknown>> = []

vi.stubGlobal('defineEventHandler', (handler: unknown) => handler)
vi.stubGlobal('readValidatedBody', async (event: { body: unknown }, parse: (value: unknown) => unknown) => parse(event.body))
vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => Object.assign(new Error(input.statusMessage), input))
vi.mock('../server/utils/require-staff', () => ({ requireStaff: async () => ({ id: 'u1', role: 'owner' }) }))
vi.mock('../server/utils/route-params', () => ({ requireUuidParam: () => '22222222-2222-4222-8222-222222222222' }))
vi.mock('../server/utils/audit', () => ({ recordAudit: async (entry: Record<string, unknown>) => { audits.push(entry) } }))
vi.mock('../server/utils/db', () => ({
  db: {
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => (review ? [review] : []),
          orderBy: () => ({ limit: async () => publicRows }),
        }),
      }),
    }),
    update: () => ({ set: (values: Record<string, unknown>) => ({ where: () => ({ returning: async () => { updated = values; return [{ id: 'r1', ...values }] } }) }) }),
  },
}))

const patch = (await import('../server/api/admin/reviews/[id].patch')).default as unknown as (event: { body: unknown }) => Promise<{ review: { published: boolean } }>
const list = (await import('../server/api/public/reviews.get')).default as unknown as () => Promise<{ reviews: Array<Record<string, unknown>> }>

describe('publishing a review as the owner', () => {
  beforeEach(() => {
    review = { comment: 'Top avond!', publicConsent: true, gigId: 'g1' }
    updated = null
    audits.length = 0
  })

  it('shows a review with consent and text', async () => {
    expect((await patch({ body: { published: true } })).review.published).toBe(true)
    expect(updated).toEqual({ published: true })
    expect(audits[0]).toMatchObject({ action: 'review_published', entityId: 'g1' })
  })

  it('refuses without the client\'s consent', async () => {
    review = { comment: 'Top!', publicConsent: false, gigId: 'g1' }
    await expect(patch({ body: { published: true } })).rejects.toMatchObject({ statusCode: 409 })
    expect(updated).toBeNull()
  })

  it('refuses a review without text', async () => {
    review = { comment: '  ', publicConsent: true, gigId: 'g1' }
    await expect(patch({ body: { published: true } })).rejects.toMatchObject({ statusCode: 409 })
  })

  it('can always hide a review again, also after consent was lost', async () => {
    review = { comment: null, publicConsent: false, gigId: 'g1' }
    expect((await patch({ body: { published: false } })).review.published).toBe(false)
    expect(audits[0]).toMatchObject({ action: 'review_unpublished' })
  })

  it('answers 404 for an unknown review', async () => {
    review = undefined
    await expect(patch({ body: { published: true } })).rejects.toMatchObject({ statusCode: 404 })
  })
})

describe('public reviews', () => {
  it('only exposes rating, text, first name and date', async () => {
    publicRows = [{ rating: 5, comment: 'Geweldig!', authorName: 'Sanne de Vries', createdAt: new Date('2026-10-01T10:00:00.000Z') }]
    const { reviews } = await list()
    expect(reviews).toEqual([{ rating: 5, comment: 'Geweldig!', author: 'Sanne', createdAt: new Date('2026-10-01T10:00:00.000Z') }])
  })

  it('names an anonymous review neutrally', async () => {
    publicRows = [{ rating: 4, comment: 'Mooi', authorName: null, createdAt: new Date() }]
    expect((await list()).reviews[0]).toMatchObject({ author: 'Klant' })
  })
})
