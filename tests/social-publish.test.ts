import sharp from 'sharp'
import { describe, expect, it, vi } from 'vitest'
import {
  canPublishPresetAsFeedImage,
  captionLength,
  checkCaption,
  countHashtags,
  INSTAGRAM_CAPTION_MAX,
  INSTAGRAM_HASHTAG_MAX,
} from '../shared/social'
import {
  createImageContainer,
  getContainerStatus,
  getPermalink,
  InstagramApiError,
  publishContainer,
} from '../server/utils/instagram'
import {
  convertToInstagramJpeg,
  instagramJpegKey,
  isPubliclyReachable,
  publicMediaUrl,
  runImagePublish,
  type PublishSteps,
} from '../server/utils/social-publish-core'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })
}

function steps(overrides: Partial<PublishSteps> = {}): PublishSteps {
  return {
    createContainer: vi.fn().mockResolvedValue('container-1'),
    getStatus: vi.fn().mockResolvedValue({ status: 'FINISHED', detail: null }),
    publish: vi.fn().mockResolvedValue('media-1'),
    getPermalink: vi.fn().mockResolvedValue('https://www.instagram.com/p/abc/'),
    onContainer: vi.fn().mockResolvedValue(undefined),
    sleep: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('caption rules', () => {
  it('counts characters the way Instagram does, so an emoji counts once', () => {
    expect(captionLength('Hi 🎉')).toBe(4)
    expect('Hi 🎉'.length).toBe(5)
  })

  it('accepts a caption of exactly 2.200 characters and rejects one more', () => {
    expect(checkCaption('a'.repeat(INSTAGRAM_CAPTION_MAX)).ok).toBe(true)
    expect(checkCaption('a'.repeat(INSTAGRAM_CAPTION_MAX + 1)).ok).toBe(false)
  })

  it('limits hashtags to 30', () => {
    const tags = (count: number) => Array.from({ length: count }, (_, index) => `#tag${index}`).join(' ')
    expect(countHashtags(tags(INSTAGRAM_HASHTAG_MAX))).toBe(INSTAGRAM_HASHTAG_MAX)
    expect(checkCaption(tags(INSTAGRAM_HASHTAG_MAX)).ok).toBe(true)
    expect(checkCaption(tags(INSTAGRAM_HASHTAG_MAX + 1)).ok).toBe(false)
  })

  it('only counts real hashtags, not a # inside a word or a lone #', () => {
    expect(countHashtags('Zaterdag #feest en #DJ, nummer#1 en # alleen')).toBe(2)
  })

  it('only allows feed ratios, not 9:16', () => {
    expect(canPublishPresetAsFeedImage('square')).toBe(true)
    expect(canPublishPresetAsFeedImage('portrait')).toBe(true)
    expect(canPublishPresetAsFeedImage('story')).toBe(false)
  })
})

describe('JPEG preparation', () => {
  it('converts a transparent PNG to a JPEG of the same size and keeps the key stable', async () => {
    const png = await sharp({ create: { width: 40, height: 50, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } } }).png().toBuffer()
    const jpeg = await convertToInstagramJpeg(png)
    const meta = await sharp(jpeg).metadata()
    expect(meta.format).toBe('jpeg')
    expect(meta.width).toBe(40)
    expect(meta.height).toBe(50)
    expect(instagramJpegKey('abc')).toBe('instagram/abc.jpg')
    expect(instagramJpegKey('abc')).toBe(instagramJpegKey('abc'))
  })

  it('builds a public URL without a double slash', () => {
    expect(publicMediaUrl('https://nightlight.example/', 'id-1')).toBe('https://nightlight.example/api/generated-posts/id-1/instagram.jpg')
  })

  it('refuses addresses Meta cannot reach', () => {
    expect(isPubliclyReachable('https://nightlight.example')).toBe(true)
    expect(isPubliclyReachable('http://localhost:3000')).toBe(false)
    expect(isPubliclyReachable('http://127.0.0.1:3000')).toBe(false)
    expect(isPubliclyReachable('not a url')).toBe(false)
  })
})

describe('Meta publishing calls', () => {
  it('creates a container with image, caption and alt text', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ id: '178' }))
    const id = await createImageContainer({
      instagramId: 'ig-1', accessToken: 'tok', imageUrl: 'https://x.test/a.jpg', caption: 'Hallo #feest', altText: ' Een DJ ',
    }, fetchImpl)

    expect(id).toBe('178')
    const [url, init] = fetchImpl.mock.calls[0]!
    expect(String(url)).toMatch(/graph\.facebook\.com\/v[\d.]+\/ig-1\/media$/)
    expect(init.method).toBe('POST')
    const body = new URLSearchParams(String(init.body))
    expect(body.get('image_url')).toBe('https://x.test/a.jpg')
    expect(body.get('caption')).toBe('Hallo #feest')
    expect(body.get('alt_text')).toBe('Een DJ')
    expect(body.get('access_token')).toBe('tok')
  })

  it('leaves alt text out when it is empty', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(json({ id: '178' }))
    await createImageContainer({ instagramId: 'ig-1', accessToken: 'tok', imageUrl: 'u', caption: '', altText: '  ' }, fetchImpl)
    expect(new URLSearchParams(String(fetchImpl.mock.calls[0]![1].body)).has('alt_text')).toBe(false)
  })

  it('publishes a container and reads the permalink', async () => {
    const publish = vi.fn().mockResolvedValue(json({ id: 'media-9' }))
    expect(await publishContainer({ instagramId: 'ig-1', accessToken: 'tok', containerId: 'c1' }, publish)).toBe('media-9')
    expect(new URLSearchParams(String(publish.mock.calls[0]![1].body)).get('creation_id')).toBe('c1')

    const permalink = vi.fn().mockResolvedValue(json({ permalink: 'https://www.instagram.com/p/xyz/' }))
    expect(await getPermalink({ mediaId: 'media-9', accessToken: 'tok' }, permalink)).toBe('https://www.instagram.com/p/xyz/')
  })

  it('reads the container status and rejects unknown values', async () => {
    expect(await getContainerStatus({ containerId: 'c1', accessToken: 'tok' }, vi.fn().mockResolvedValue(json({ status_code: 'FINISHED' })))).toEqual({ status: 'FINISHED', detail: null })
    await expect(getContainerStatus({ containerId: 'c1', accessToken: 'tok' }, vi.fn().mockResolvedValue(json({ status_code: 'WEIRD' })))).rejects.toBeInstanceOf(InstagramApiError)
  })

  it('surfaces the Meta error text and marks auth errors as permanent', async () => {
    const media = vi.fn().mockResolvedValue(json({ error: { message: 'The image is too small', code: 36003 } }, 400))
    const error = await createImageContainer({ instagramId: 'ig-1', accessToken: 't', imageUrl: 'u', caption: '' }, media).catch(cause => cause as InstagramApiError)
    expect(error).toBeInstanceOf(InstagramApiError)
    expect(error.message).toBe('The image is too small')
    expect(error.permanent).toBe(false)

    const auth = vi.fn().mockResolvedValue(json({ error: { message: 'Session expired', code: 190 } }, 400))
    const authError = await publishContainer({ instagramId: 'ig-1', accessToken: 't', containerId: 'c' }, auth).catch(cause => cause as InstagramApiError)
    expect(authError.permanent).toBe(true)
  })
})

describe('publish flow', () => {
  it('stores the container before publishing, then publishes once', async () => {
    const order: string[] = []
    const flow = steps({
      createContainer: vi.fn(async () => { order.push('create'); return 'c1' }),
      onContainer: vi.fn(async () => { order.push('persist') }),
      publish: vi.fn(async () => { order.push('publish'); return 'm1' }),
    })

    const outcome = await runImagePublish(flow)
    expect(order).toEqual(['create', 'persist', 'publish'])
    expect(outcome).toEqual({ containerId: 'c1', providerPostId: 'm1', permalink: 'https://www.instagram.com/p/abc/' })
  })

  it('waits until Meta has processed the container', async () => {
    const getStatus = vi.fn()
      .mockResolvedValueOnce({ status: 'IN_PROGRESS', detail: null })
      .mockResolvedValueOnce({ status: 'IN_PROGRESS', detail: null })
      .mockResolvedValueOnce({ status: 'FINISHED', detail: null })
    const flow = steps({ getStatus })
    await runImagePublish(flow)
    expect(getStatus).toHaveBeenCalledTimes(3)
    expect(flow.sleep).toHaveBeenCalledTimes(2)
    expect(flow.publish).toHaveBeenCalledTimes(1)
  })

  it('fails with Meta\'s message and does not publish when the container errors', async () => {
    const flow = steps({ getStatus: vi.fn().mockResolvedValue({ status: 'ERROR', detail: 'Bad aspect ratio' }) })
    await expect(runImagePublish(flow)).rejects.toThrow('Bad aspect ratio')
    expect(flow.publish).not.toHaveBeenCalled()
  })

  it('gives up with a clear message when Meta stays busy', async () => {
    const flow = steps({ getStatus: vi.fn().mockResolvedValue({ status: 'IN_PROGRESS', detail: null }) })
    await expect(runImagePublish(flow)).rejects.toThrow(/nog niet verwerkt/)
    expect(flow.publish).not.toHaveBeenCalled()
  })

  it('does not publish again when the container is already published (crash recovery)', async () => {
    const flow = steps({ getStatus: vi.fn().mockResolvedValue({ status: 'PUBLISHED', detail: null }) })
    const outcome = await runImagePublish(flow, 'c-existing')
    expect(flow.createContainer).not.toHaveBeenCalled()
    expect(flow.publish).not.toHaveBeenCalled()
    expect(outcome.containerId).toBe('c-existing')
  })

  it('reuses an existing container instead of creating a second one', async () => {
    const flow = steps()
    await runImagePublish(flow, 'c-existing')
    expect(flow.createContainer).not.toHaveBeenCalled()
    expect(flow.publish).toHaveBeenCalledWith('c-existing')
  })

  it('keeps the post published when the permalink cannot be fetched', async () => {
    const flow = steps({ getPermalink: vi.fn().mockRejectedValue(new Error('boom')) })
    const outcome = await runImagePublish(flow)
    expect(outcome.providerPostId).toBe('media-1')
    expect(outcome.permalink).toBeNull()
  })
})
