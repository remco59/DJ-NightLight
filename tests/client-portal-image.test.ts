import { describe, expect, it } from 'vitest'
import { clientPortalImageInputSchema } from '../shared/client-portal'

describe('client portal image input', () => {
  it('accepts media-library and https image URLs', () => {
    expect(clientPortalImageInputSchema.parse({ imageUrl: '/api/media/123e4567-e89b-12d3-a456-426614174000' }).imageUrl)
      .toBe('/api/media/123e4567-e89b-12d3-a456-426614174000')
    expect(clientPortalImageInputSchema.parse({ imageUrl: 'https://example.com/hero.jpg' }).imageUrl)
      .toBe('https://example.com/hero.jpg')
  })

  it('normalizes an empty image to the fallback state', () => {
    expect(clientPortalImageInputSchema.parse({ imageUrl: '' }).imageUrl).toBeNull()
    expect(clientPortalImageInputSchema.parse({ imageUrl: null }).imageUrl).toBeNull()
  })

  it('rejects invalid image URLs', () => {
    expect(clientPortalImageInputSchema.safeParse({ imageUrl: 'not-a-url' }).success).toBe(false)
  })
})
