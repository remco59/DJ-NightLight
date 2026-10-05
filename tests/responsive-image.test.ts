import { describe, expect, it } from 'vitest'
import { responsiveImage } from '../shared/responsive-image'

const id = 'cb6697e2-1f72-48ca-9fe9-08103031ae68'

describe('responsiveImage', () => {
  it('offers resized WebP candidates for uploaded media', () => {
    expect(responsiveImage(`/api/media/${id}`, 640)).toEqual({
      src: `/api/media/${id}?w=640`,
      srcset: `/api/media/${id}?w=640 640w, /api/media/${id}?w=1280 1280w, /api/media/${id}?w=1920 1920w`,
    })
  })

  it('passes other URLs through untouched', () => {
    expect(responsiveImage('https://images.example.test/photo.jpg')).toEqual({ src: 'https://images.example.test/photo.jpg', srcset: undefined })
    expect(responsiveImage(`/api/media/${id}?variant=thumb`)).toEqual({ src: `/api/media/${id}?variant=thumb`, srcset: undefined })
    expect(responsiveImage(null)).toEqual({ src: undefined, srcset: undefined })
  })
})
