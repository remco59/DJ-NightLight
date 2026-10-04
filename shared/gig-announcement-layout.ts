export type GigAnnouncementLayout = {
  tall: boolean
  bottomSafe: number
  logoTop: number
  logoWidth: number
  kickerTop: number
  headlineTop: number
  headlineWidth: number
  panelTop: number
  panelWidth: number
  panelHeight: number
  panelLeft: number
  ctaHeight: number
}

/**
 * Geometry for the vertical Gig Announcement composition.
 *
 * Reels/Stories reserve the lower ~19% of a 9:16 frame for Instagram UI.
 * The event card is deliberately kept above that area so venue/date/CTA remain
 * readable when the reel controls, account name, audio and caption are visible.
 */
export function gigAnnouncementLayout(width: number, height: number): GigAnnouncementLayout {
  const tall = height / width > 1.5

  if (!tall) {
    const panelWidth = Math.min(width - 120, 760)
    const panelHeight = Math.min(470, height * 0.48)
    return {
      tall: false,
      bottomSafe: 70,
      logoTop: 28,
      logoWidth: Math.min(width * 0.46, 520),
      kickerTop: 170,
      headlineTop: Math.max(190, height * 0.24),
      headlineWidth: Math.min(width - 120, 900),
      panelTop: height - panelHeight - 70,
      panelWidth,
      panelHeight,
      panelLeft: (width - panelWidth) / 2,
      ctaHeight: 86,
    }
  }

  const bottomSafe = Math.max(350, height * 0.19)
  const panelWidth = Math.min(width - 150, 900)
  const panelHeight = Math.min(580, height * 0.30)
  const panelTop = height - bottomSafe - panelHeight

  return {
    tall: true,
    bottomSafe,
    logoTop: Math.max(8, height * 0.008),
    logoWidth: Math.min(width * 0.575, 620),
    kickerTop: Math.max(205, height * 0.112),
    headlineTop: Math.min(panelTop - 320, height * 0.285),
    headlineWidth: Math.min(width - 130, 950),
    panelTop,
    panelWidth,
    panelHeight,
    panelLeft: (width - panelWidth) / 2,
    ctaHeight: Math.min(104, panelHeight * 0.19),
  }
}
