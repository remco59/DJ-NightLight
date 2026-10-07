import { describe, expect, it, vi } from 'vitest'
import {
  canPublishPresetAsStory,
  checkCarouselPresets,
  checkVideoForKind,
  formatDuration,
} from '../shared/social'
import {
  createCarouselContainer,
  createCarouselItemContainer,
  createStoryImageContainer,
  createVideoContainer,
} from '../server/utils/instagram'
import {
  ContainerNotReadyError,
  createCarouselContainerFlow,
  mediaProblem,
  publicVideoUrl,
  runContainerPublish,
  type PublishSteps,
} from '../server/utils/social-publish-core'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function sentBody(fetchImpl: ReturnType<typeof vi.fn>) {
  return new URLSearchParams(String((fetchImpl.mock.calls[0]![1] as RequestInit).body))
}

const video = { status: 'completed', outputKey: 'v.mp4', width: 1080, height: 1920, durationSeconds: 18 }

describe('story, reel and carousel limits', () => {
  it('accepts only the 9:16 preset as a story image', () => {
    expect(canPublishPresetAsStory('story')).toBe(true)
    expect(canPublishPresetAsStory('square')).toBe(false)
  })

  it('needs 2 to 10 slides, all feed ratios and all the same', () => {
    expect(checkCarouselPresets(['square']).ok).toBe(false)
    expect(checkCarouselPresets(['square', 'square']).ok).toBe(true)
    expect(checkCarouselPresets(Array(10).fill('portrait')).ok).toBe(true)
    expect(checkCarouselPresets(Array(11).fill('portrait')).ok).toBe(false)
    expect(checkCarouselPresets(['square', 'portrait']).ok).toBe(false)
    expect(checkCarouselPresets(['story', 'story']).ok).toBe(false)
  })

  it('checks ratio and duration of a video', () => {
    expect(checkVideoForKind('reel', video).ok).toBe(true)
    expect(checkVideoForKind('reel', { ...video, width: 1920, height: 1080 }).ok).toBe(false)
    expect(checkVideoForKind('reel', { ...video, durationSeconds: 2 }).ok).toBe(false)
    expect(checkVideoForKind('reel', { ...video, durationSeconds: 900 }).ok).toBe(true)
    expect(checkVideoForKind('reel', { ...video, durationSeconds: 901 }).ok).toBe(false)
    expect(checkVideoForKind('story', { ...video, durationSeconds: 60 }).ok).toBe(true)
    expect(checkVideoForKind('story', { ...video, durationSeconds: 61 }).ok).toBe(false)
  })

  it('formats a duration like the mockups', () => {
    expect(formatDuration(18)).toBe('0:18')
    expect(formatDuration(125)).toBe('2:05')
  })
})

describe('mediaProblem', () => {
  it('accepts a valid post of every kind', () => {
    expect(mediaProblem({ kind: 'image', images: [{ preset: 'square' }], video: null })).toBeNull()
    expect(mediaProblem({ kind: 'carousel', images: [{ preset: 'portrait' }, { preset: 'portrait' }], video: null })).toBeNull()
    expect(mediaProblem({ kind: 'reel', images: [], video })).toBeNull()
    expect(mediaProblem({ kind: 'story', images: [], video })).toBeNull()
    expect(mediaProblem({ kind: 'story', images: [{ preset: 'story' }], video: null })).toBeNull()
  })

  it('refuses mismatched media', () => {
    expect(mediaProblem({ kind: 'reel', images: [{ preset: 'story' }], video: null })).toMatch(/video/)
    expect(mediaProblem({ kind: 'carousel', images: [{ preset: 'square' }, { preset: 'square' }], video })).toMatch(/video/)
    expect(mediaProblem({ kind: 'story', images: [{ preset: 'square' }], video: null })).toMatch(/9:16/)
    expect(mediaProblem({ kind: 'story', images: [{ preset: 'story' }], video })).toMatch(/story/)
    expect(mediaProblem({ kind: 'image', images: [], video })).toMatch(/afbeelding/)
  })

  it('refuses a render that is not finished', () => {
    expect(mediaProblem({ kind: 'reel', images: [], video: { ...video, status: 'rendering' } })).toMatch(/niet klaar/)
    expect(mediaProblem({ kind: 'reel', images: [], video: { ...video, outputKey: null } })).toMatch(/niet klaar/)
  })
})

describe('Meta calls for the new kinds', () => {
  it('creates a reel container that is also shown in the feed', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ id: 'c-reel' }))
    const id = await createVideoContainer({ instagramId: 'ig1', accessToken: 'tok', videoUrl: 'https://x.nl/v', mediaType: 'REELS', caption: 'Hallo' }, fetchImpl)
    expect(id).toBe('c-reel')
    expect(String(fetchImpl.mock.calls[0]![0])).toContain('/ig1/media')
    const body = sentBody(fetchImpl)
    expect(body.get('media_type')).toBe('REELS')
    expect(body.get('video_url')).toBe('https://x.nl/v')
    expect(body.get('share_to_feed')).toBe('true')
    expect(body.get('caption')).toBe('Hallo')
  })

  it('sends no caption or feed flag for a video story', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ id: 'c-story' }))
    await createVideoContainer({ instagramId: 'ig1', accessToken: 'tok', videoUrl: 'https://x.nl/v', mediaType: 'STORIES', caption: 'negeer' }, fetchImpl)
    const body = sentBody(fetchImpl)
    expect(body.get('media_type')).toBe('STORIES')
    expect(body.has('caption')).toBe(false)
    expect(body.has('share_to_feed')).toBe(false)
  })

  it('creates an image story container', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ id: 'c-s' }))
    await createStoryImageContainer({ instagramId: 'ig1', accessToken: 'tok', imageUrl: 'https://x.nl/i.jpg' }, fetchImpl)
    const body = sentBody(fetchImpl)
    expect(body.get('media_type')).toBe('STORIES')
    expect(body.get('image_url')).toBe('https://x.nl/i.jpg')
  })

  it('creates carousel slides and the carousel that references them', async () => {
    const item = vi.fn().mockResolvedValue(json({ id: 'child' }))
    await createCarouselItemContainer({ instagramId: 'ig1', accessToken: 'tok', imageUrl: 'https://x.nl/a.jpg' }, item)
    expect(sentBody(item).get('is_carousel_item')).toBe('true')
    expect(sentBody(item).has('caption')).toBe(false)

    const parent = vi.fn().mockResolvedValue(json({ id: 'carousel' }))
    await createCarouselContainer({ instagramId: 'ig1', accessToken: 'tok', children: ['a', 'b', 'c'], caption: 'Tekst' }, parent)
    const body = sentBody(parent)
    expect(body.get('media_type')).toBe('CAROUSEL')
    expect(body.get('children')).toBe('a,b,c')
    expect(body.get('caption')).toBe('Tekst')
  })

  it('builds the public video URL without a double slash', () => {
    expect(publicVideoUrl('https://nightlight.nl/', 'abc')).toBe('https://nightlight.nl/api/generated-videos/abc')
  })
})

describe('carousel container flow', () => {
  it('waits for every slide in order, then creates the carousel from the slide ids', async () => {
    let created = 0
    const createCarouselMock = vi.fn().mockResolvedValue('parent')
    const getStatus = vi.fn()
      .mockResolvedValueOnce({ status: 'IN_PROGRESS', detail: null })
      .mockResolvedValue({ status: 'FINISHED', detail: null })
    const result = await createCarouselContainerFlow({
      createItem: async () => `child-${++created}`,
      getStatus,
      createCarousel: createCarouselMock,
      sleep: vi.fn().mockResolvedValue(undefined),
    }, 3)
    expect(result).toBe('parent')
    expect(createCarouselMock).toHaveBeenCalledWith(['child-1', 'child-2', 'child-3'])
  })

  it('stops with Meta\'s message when a slide cannot be processed', async () => {
    const createCarouselMock = vi.fn()
    await expect(createCarouselContainerFlow({
      createItem: async () => 'child',
      getStatus: vi.fn().mockResolvedValue({ status: 'ERROR', detail: 'Slechte afbeelding' }),
      createCarousel: createCarouselMock,
      sleep: vi.fn(),
    }, 2)).rejects.toThrow('Slechte afbeelding')
    expect(createCarouselMock).not.toHaveBeenCalled()
  })
})

describe('video publishing', () => {
  function steps(overrides: Partial<PublishSteps> = {}): PublishSteps {
    return {
      createContainer: vi.fn().mockResolvedValue('c-new'),
      getStatus: vi.fn().mockResolvedValue({ status: 'FINISHED', detail: null }),
      publish: vi.fn().mockResolvedValue('media-1'),
      getPermalink: vi.fn().mockResolvedValue('https://www.instagram.com/reel/abc/'),
      onContainer: vi.fn().mockResolvedValue(undefined),
      sleep: vi.fn().mockResolvedValue(undefined),
      ...overrides,
    }
  }

  it('publishes a container that was prepared ahead of time, without creating another one', async () => {
    const s = steps()
    const outcome = await runContainerPublish(s, 'c-ahead', { attempts: 10, intervalMs: 6000 })
    expect(s.createContainer).not.toHaveBeenCalled()
    expect(s.publish).toHaveBeenCalledWith('c-ahead')
    expect(outcome.providerPostId).toBe('media-1')
  })

  it('polls with the video interval and gives up as "not ready" so the worker retries', async () => {
    const s = steps({ getStatus: vi.fn().mockResolvedValue({ status: 'IN_PROGRESS', detail: null }) })
    const error = await runContainerPublish(s, 'c-ahead', { attempts: 3, intervalMs: 6000 }).catch(cause => cause)
    expect(error).toBeInstanceOf(ContainerNotReadyError)
    expect(s.sleep).toHaveBeenCalledTimes(2)
    expect(s.sleep).toHaveBeenCalledWith(6000)
    expect(s.publish).not.toHaveBeenCalled()
  })

  it('never publishes a prepared container that Meta already published', async () => {
    const s = steps({ getStatus: vi.fn().mockResolvedValue({ status: 'PUBLISHED', detail: null }) })
    await runContainerPublish(s, 'c-ahead')
    expect(s.publish).not.toHaveBeenCalled()
  })
})
