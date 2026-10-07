import { describe, expect, it, vi } from 'vitest'
import {
  amsterdamLocalToIso,
  checkScheduleMoment,
  isoToAmsterdamLocal,
  SCHEDULE_MIN_LEAD_MS,
  SOCIAL_MAX_ATTEMPTS,
  socialPostActions,
  socialRetryDelayMs,
  socialTabStatuses,
  socialPostStatuses,
  startOfAmsterdamWeek,
  tabForStatus,
} from '../shared/social'
import { InstagramApiError } from '../server/utils/instagram'
import {
  ContainerNotReadyError,
  isRetryablePublishError,
  runImagePublish,
  type PublishSteps,
} from '../server/utils/social-publish-core'

function steps(overrides: Partial<PublishSteps> = {}): PublishSteps {
  return {
    createContainer: vi.fn().mockResolvedValue('container-new'),
    getStatus: vi.fn().mockResolvedValue({ status: 'FINISHED', detail: null }),
    publish: vi.fn().mockResolvedValue('media-1'),
    getPermalink: vi.fn().mockResolvedValue('https://www.instagram.com/p/abc/'),
    onContainer: vi.fn().mockResolvedValue(undefined),
    sleep: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe('retry backoff', () => {
  it('doubles from two minutes and stays bounded', () => {
    expect([1, 2, 3, 4].map(socialRetryDelayMs)).toEqual([2, 4, 8, 16].map(minutes => minutes * 60_000))
    expect(socialRetryDelayMs(50)).toBe(2 * 60 * 60 * 1000)
    expect(socialRetryDelayMs(0)).toBe(2 * 60_000)
  })

  it('gives up after a bounded number of attempts', () => {
    expect(SOCIAL_MAX_ATTEMPTS).toBeGreaterThan(1)
    expect(SOCIAL_MAX_ATTEMPTS).toBeLessThanOrEqual(10)
  })
})

describe('retryable errors', () => {
  it('retries temporary Meta trouble and network errors', () => {
    expect(isRetryablePublishError(new InstagramApiError('down', 503, null, false))).toBe(true)
    expect(isRetryablePublishError(new InstagramApiError('slow down', 400, 4, false))).toBe(true)
    expect(isRetryablePublishError(new InstagramApiError('rate', 429, null, false))).toBe(true)
    expect(isRetryablePublishError(new ContainerNotReadyError())).toBe(true)
    expect(isRetryablePublishError(new TypeError('fetch failed'))).toBe(true)
  })

  it('never retries revoked access, rejected media or our own validation errors', () => {
    expect(isRetryablePublishError(new InstagramApiError('token', 401, 190, true))).toBe(false)
    expect(isRetryablePublishError(new InstagramApiError('Media not supported', 400, 9004, false))).toBe(false)
    expect(isRetryablePublishError(new Error('boom'))).toBe(false)
    expect(isRetryablePublishError('boom')).toBe(false)
  })
})

describe('schedule moment', () => {
  const now = new Date('2026-10-12T10:00:00Z')

  it('accepts a moment in the future', () => {
    const result = checkScheduleMoment('2026-10-13T10:00:00Z', now)
    expect(result.ok).toBe(true)
  })

  it('rejects the past, "right now" and nonsense', () => {
    expect(checkScheduleMoment('2026-10-12T09:00:00Z', now).ok).toBe(false)
    expect(checkScheduleMoment(new Date(now.getTime() + SCHEDULE_MIN_LEAD_MS - 1000), now).ok).toBe(false)
    expect(checkScheduleMoment('not a date', now).ok).toBe(false)
    expect(checkScheduleMoment(null, now).ok).toBe(false)
  })

  it('rejects more than a year ahead', () => {
    expect(checkScheduleMoment('2028-01-01T00:00:00Z', now).ok).toBe(false)
  })

  it('rejects a moment after the Meta access ends', () => {
    const limit = new Date('2026-10-20T00:00:00Z')
    expect(checkScheduleMoment('2026-10-19T12:00:00Z', now, limit).ok).toBe(true)
    expect(checkScheduleMoment('2026-10-20T12:00:00Z', now, limit).ok).toBe(false)
  })
})

describe('Europe/Amsterdam time', () => {
  it('converts local input to UTC in summer and winter time', () => {
    expect(amsterdamLocalToIso('2026-07-01T18:30')).toBe('2026-07-01T16:30:00.000Z')
    expect(amsterdamLocalToIso('2026-12-01T18:30')).toBe('2026-12-01T17:30:00.000Z')
  })

  it('round-trips through the datetime-local format', () => {
    for (const local of ['2026-07-01T18:30', '2026-12-01T00:05', '2026-10-25T01:30']) {
      expect(isoToAmsterdamLocal(amsterdamLocalToIso(local)!)).toBe(local)
    }
  })

  it('rejects input that is not a datetime-local value', () => {
    expect(amsterdamLocalToIso('')).toBeNull()
    expect(amsterdamLocalToIso('2026-07-01')).toBeNull()
  })

  it('finds Monday 00:00 in Amsterdam for the stat card', () => {
    // Wednesday 14 Oct 2026 15:00 Amsterdam (CEST) → Monday 12 Oct 00:00 CEST = Sunday 22:00 UTC.
    expect(startOfAmsterdamWeek(new Date('2026-10-14T13:00:00Z')).toISOString()).toBe('2026-10-11T22:00:00.000Z')
    // Sunday 18 Oct 23:30 Amsterdam is still the same week.
    expect(startOfAmsterdamWeek(new Date('2026-10-18T21:30:00Z')).toISOString()).toBe('2026-10-11T22:00:00.000Z')
  })
})

describe('tabs and actions', () => {
  it('puts every status on exactly one tab', () => {
    const tabbed = Object.values(socialTabStatuses).flat()
    expect([...tabbed].sort()).toEqual([...socialPostStatuses].sort())
    expect(tabForStatus('failed')).toBe('failed')
    expect(tabForStatus('published')).toBe('history')
    expect(tabForStatus('draft')).toBe('queue')
  })

  it('only offers actions that make sense', () => {
    expect(socialPostActions('scheduled')).toEqual({ edit: true, cancel: true, retry: false })
    expect(socialPostActions('failed')).toEqual({ edit: false, cancel: true, retry: true })
    expect(socialPostActions('publishing')).toEqual({ edit: false, cancel: false, retry: false })
    expect(socialPostActions('published')).toEqual({ edit: false, cancel: false, retry: false })
  })
})

describe('recovery of an earlier attempt', () => {
  it('does not publish again when Meta already published the container', async () => {
    const s = steps({ getStatus: vi.fn().mockResolvedValue({ status: 'PUBLISHED', detail: null }) })
    const outcome = await runImagePublish(s, 'container-old')
    expect(s.publish).not.toHaveBeenCalled()
    expect(s.createContainer).not.toHaveBeenCalled()
    expect(outcome.containerId).toBe('container-old')
  })

  it('publishes an existing finished container without creating a new one', async () => {
    const s = steps()
    await runImagePublish(s, 'container-old')
    expect(s.createContainer).not.toHaveBeenCalled()
    expect(s.publish).toHaveBeenCalledWith('container-old')
  })

  it('replaces an expired container from an earlier attempt once', async () => {
    const getStatus = vi.fn()
      .mockResolvedValueOnce({ status: 'EXPIRED', detail: null })
      .mockResolvedValue({ status: 'FINISHED', detail: null })
    const s = steps({ getStatus })
    const outcome = await runImagePublish(s, 'container-old')
    expect(s.createContainer).toHaveBeenCalledTimes(1)
    expect(s.onContainer).toHaveBeenCalledWith('container-new')
    expect(s.publish).toHaveBeenCalledWith('container-new')
    expect(outcome.containerId).toBe('container-new')
  })

  it('does not loop when a fresh container fails too', async () => {
    const s = steps({ getStatus: vi.fn().mockResolvedValue({ status: 'ERROR', detail: 'Media niet ondersteund' }) })
    await expect(runImagePublish(s, 'container-old')).rejects.toThrow('Media niet ondersteund')
    expect(s.createContainer).toHaveBeenCalledTimes(1)
    expect(s.publish).not.toHaveBeenCalled()
  })

  it('reports a container that is still processing as retryable', async () => {
    const s = steps({ getStatus: vi.fn().mockResolvedValue({ status: 'IN_PROGRESS', detail: null }) })
    const error = await runImagePublish(s).catch(cause => cause)
    expect(error).toBeInstanceOf(ContainerNotReadyError)
    expect(isRetryablePublishError(error)).toBe(true)
  })
})
