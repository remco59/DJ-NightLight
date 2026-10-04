import { describe, expect, it } from 'vitest'
import { gigAnnouncementLayout } from '../shared/gig-announcement-layout'

describe('gig announcement social layout', () => {
  it('keeps the 9:16 detail card above Instagram UI', () => {
    const layout = gigAnnouncementLayout(1080, 1920)
    const panelBottom = layout.panelTop + layout.panelHeight

    expect(layout.tall).toBe(true)
    expect(layout.bottomSafe).toBeGreaterThanOrEqual(350)
    expect(panelBottom).toBeLessThanOrEqual(1920 - 350)
    expect(layout.panelWidth).toBeGreaterThanOrEqual(880)
    expect(layout.panelHeight).toBeGreaterThanOrEqual(560)
    expect(layout.headlineTop).toBeLessThan(layout.panelTop - 250)
  })

  it('keeps the legacy composition path for square and landscape canvases', () => {
    expect(gigAnnouncementLayout(1080, 1080).tall).toBe(false)
    expect(gigAnnouncementLayout(1920, 1080).tall).toBe(false)
  })
})
