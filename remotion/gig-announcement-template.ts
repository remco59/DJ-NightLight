import type React from 'react'
import { createElement as h } from 'react'
import { AbsoluteFill, Img, interpolate, staticFile } from 'remotion'
import type { GraphicItem, ProjectAssetMap } from '../shared/video-project'
import { iconProp, MOTION_ACCENTS, textProp } from '../shared/video-templates'
import { gigAnnouncementLayout } from '../shared/gig-announcement-layout'
import { BRAND_LOGOS } from './brand-logo'
import { BODY_FONT_FAMILY, DISPLAY_FONT_FAMILY } from './fonts'
import { LucideIcon } from './lucide-icon'

type Props = {
  item: GraphicItem
  frame: number
  fps: number
  width: number
  height: number
  assets: ProjectAssetMap
}

type Colors = (typeof MOTION_ACCENTS)[keyof typeof MOTION_ACCENTS]

const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const

function reveal(frame: number, start: number, length = 10) {
  return interpolate(frame, [start, start + length], [0, 1], clamp)
}

function LayeredWordmark({ width, opacity, scale }: { width: number, opacity: number, scale: number }) {
  const spec = BRAND_LOGOS.wordmark
  const ratio = width / spec.width
  return h(
    'div',
    {
      style: {
        position: 'relative',
        width,
        height: spec.height * ratio,
        opacity,
        transform: `scale(${scale})`,
        transformOrigin: 'center',
        filter: 'drop-shadow(0 0 18px rgba(124,58,237,.65)) drop-shadow(0 10px 28px rgba(0,0,0,.55))',
      },
    },
    Object.entries(spec.layers).map(([name, rect]) => {
      const [x, y, w, height] = rect
      return h(Img, {
        key: name,
        src: staticFile(`brand/logo/wordmark-${name}.webp`),
        style: {
          position: 'absolute',
          left: x * ratio,
          top: y * ratio,
          width: w * ratio,
          height: height * ratio,
          maxWidth: 'none',
        },
      })
    }),
  )
}

function gradientText(colors: Colors): React.CSSProperties {
  return {
    fontFamily: DISPLAY_FONT_FAMILY,
    fontWeight: 900,
    fontStyle: 'italic',
    textTransform: 'uppercase',
    color: 'transparent',
    backgroundImage: `linear-gradient(180deg, #fff 0%, #fff 22%, ${colors.soft} 57%, ${colors.accent} 100%)`,
    WebkitBackgroundClip: 'text',
    backgroundClip: 'text',
    filter: `drop-shadow(0 0 22px ${colors.glow}) drop-shadow(0 14px 28px rgba(0,0,0,.72))`,
  }
}

function ctaContents(text: string, icon: ReturnType<typeof iconProp>) {
  const clean = text.replace(/\s*(?:->|[→>])$/, '')
  return h(
    'span',
    { style: { display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 18 } },
    clean,
    icon ? h(LucideIcon, { name: icon, size: 46 }) : null,
  )
}

/**
 * Instagram-first version of Gig Announcement.
 *
 * The editor and export share ProjectComposition, so these exact coordinates
 * are used in both places. The lower safe area intentionally remains empty for
 * Reels controls, account/audio metadata and caption UI.
 */
export const GigAnnouncementTemplate: React.FC<Props> = ({ item, frame, width, height }) => {
  const props = item.templateProps
  const colors = MOTION_ACCENTS[item.accent] || MOTION_ACCENTS['ultraviolet']
  const layout = gigAnnouncementLayout(width, height)

  const headline = textProp(props, 'headline')
  const date = textProp(props, 'date')
  const time = textProp(props, 'time')
  const venue = textProp(props, 'venue')
  const location = textProp(props, 'location')
  const cta = textProp(props, 'cta')

  const rows = [
    { key: 'date', icon: iconProp('gig-announcement', props, 'dateIcon'), primary: date, secondary: '' },
    { key: 'time', icon: iconProp('gig-announcement', props, 'timeIcon'), primary: time, secondary: '' },
    { key: 'venue', icon: iconProp('gig-announcement', props, 'venueIcon'), primary: venue, secondary: location },
  ].filter(row => row.primary || row.secondary)

  const logoIn = reveal(frame, 0, 14)
  const kickerIn = reveal(frame, 8, 12)
  const headlineIn = reveal(frame, 12, 10)
  const panelIn = reveal(frame, 24, 12)
  const headlineSize = Math.min(172, layout.headlineWidth / Math.max(5.2, headline.length * 0.57))
  const cardPaddingX = 58
  const cardPaddingTop = 28

  return h(
    AbsoluteFill,
    { style: { pointerEvents: 'none', overflow: 'hidden' } },
    h(
      'div',
      {
        style: {
          position: 'absolute',
          top: layout.logoTop,
          left: '50%',
          transform: 'translateX(-50%)',
          width: layout.logoWidth,
        },
      },
      h(LayeredWordmark, {
        width: layout.logoWidth,
        opacity: logoIn,
        scale: interpolate(logoIn, [0, 1], [1.12, 1], clamp),
      }),
    ),
    h(
      'div',
      {
        style: {
          position: 'absolute',
          top: layout.kickerTop,
          left: 0,
          width: '100%',
          textAlign: 'center',
          fontFamily: BODY_FONT_FAMILY,
          fontSize: 25,
          fontWeight: 800,
          letterSpacing: 11,
          color: '#fff',
          textTransform: 'uppercase',
          textShadow: `0 0 16px ${colors.glow}, 0 4px 14px rgba(0,0,0,.75)`,
          opacity: kickerIn,
          transform: `translateY(${(1 - kickerIn) * 12}px)`,
        },
      },
      'PRESENTEERT',
    ),
    headline
      ? h(
          'div',
          {
            style: {
              position: 'absolute',
              top: layout.headlineTop,
              left: '50%',
              width: layout.headlineWidth,
              transform: `translateX(-50%) rotate(-5.4deg) scale(${interpolate(headlineIn, [0, 1], [1.2, 1], clamp)})`,
              transformOrigin: 'center',
              opacity: headlineIn,
              textAlign: 'center',
            },
          },
          h(
            'div',
            {
              style: {
                ...gradientText(colors),
                fontSize: headlineSize,
                lineHeight: 0.92,
                letterSpacing: -4,
                whiteSpace: 'nowrap',
                transform: 'skewX(-8deg)',
              },
            },
            headline,
          ),
          h('div', {
            style: {
              width: '78%',
              height: 5,
              margin: '-4px auto 0',
              background: `linear-gradient(90deg, transparent 0%, ${colors.accent} 9%, ${colors.soft} 74%, transparent 100%)`,
              boxShadow: `0 0 18px ${colors.glow}`,
              transform: `scaleX(${headlineIn})`,
              transformOrigin: 'left center',
            },
          }),
        )
      : null,
    rows.length || cta
      ? h(
          'div',
          {
            style: {
              position: 'absolute',
              top: layout.panelTop,
              left: layout.panelLeft,
              width: layout.panelWidth,
              height: layout.panelHeight,
              boxSizing: 'border-box',
              background: 'linear-gradient(180deg, rgba(8,5,17,.94), rgba(5,3,12,.91))',
              border: `2px solid ${colors.accent}cc`,
              boxShadow: `0 0 36px ${colors.glow}88, inset 0 0 34px ${colors.glow}24, 0 26px 55px rgba(0,0,0,.55)`,
              transform: `translateY(${(1 - panelIn) * 42}px) skewX(-3.5deg)`,
              transformOrigin: 'center',
              opacity: panelIn,
            },
          },
          h(
            'div',
            {
              style: {
                height: '100%',
                boxSizing: 'border-box',
                transform: 'skewX(3.5deg)',
                display: 'flex',
                flexDirection: 'column',
                padding: `${cardPaddingTop}px ${cardPaddingX}px 26px`,
              },
            },
            h(
              'div',
              {
                style: {
                  flex: 1,
                  minHeight: 0,
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-evenly',
                },
              },
              rows.map((row, index) => {
                const rowIn = reveal(frame, 27 + index * 3, 10)
                const venueRow = row.key === 'venue'
                return h(
                  'div',
                  {
                    key: row.key,
                    style: {
                      display: 'grid',
                      gridTemplateColumns: '64px 1fr',
                      alignItems: 'center',
                      gap: 22,
                      minHeight: venueRow ? 104 : 82,
                      padding: venueRow ? '12px 4px 14px' : '8px 4px 18px',
                      borderBottom: index < rows.length - 1 ? `1px solid ${colors.accent}70` : 'none',
                      opacity: rowIn,
                      transform: `translateX(${(1 - rowIn) * -34}px)`,
                    },
                  },
                  h(
                    'div',
                    {
                      style: {
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        color: '#fff',
                        filter: `drop-shadow(0 0 10px ${colors.glow})`,
                      },
                    },
                    row.icon ? h(LucideIcon, { name: row.icon, size: venueRow ? 50 : 48 }) : null,
                  ),
                  h(
                    'div',
                    { style: { minWidth: 0 } },
                    row.primary
                      ? h(
                          'div',
                          {
                            style: {
                              fontFamily: DISPLAY_FONT_FAMILY,
                              fontSize: venueRow ? 52 : row.key === 'time' ? 56 : 52,
                              fontWeight: 900,
                              lineHeight: 1.02,
                              color: '#fff',
                              textTransform: 'uppercase',
                              letterSpacing: venueRow ? -1.5 : 0.5,
                              whiteSpace: venueRow ? 'normal' : 'nowrap',
                              textShadow: '0 5px 18px rgba(0,0,0,.72)',
                            },
                          },
                          row.primary,
                        )
                      : null,
                    row.secondary
                      ? h(
                          'div',
                          {
                            style: {
                              marginTop: 7,
                              fontFamily: BODY_FONT_FAMILY,
                              fontSize: 31,
                              fontWeight: 650,
                              lineHeight: 1,
                              letterSpacing: 8,
                              color: '#fff',
                              textTransform: 'uppercase',
                              textShadow: `0 0 12px ${colors.glow}`,
                            },
                          },
                          row.secondary,
                        )
                      : null,
                  ),
                )
              }),
            ),
            cta
              ? h(
                  'div',
                  {
                    style: {
                      height: layout.ctaHeight,
                      flexShrink: 0,
                      marginTop: 12,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      background: `linear-gradient(90deg, ${colors.glow}, ${colors.accent})`,
                      boxShadow: `0 0 28px ${colors.glow}aa`,
                      transform: 'skewX(-5deg)',
                      opacity: reveal(frame, 36, 10),
                    },
                  },
                  h(
                    'div',
                    {
                      style: {
                        transform: 'skewX(5deg)',
                        fontFamily: DISPLAY_FONT_FAMILY,
                        fontSize: 48,
                        fontWeight: 900,
                        fontStyle: 'italic',
                        lineHeight: 1,
                        letterSpacing: 1.5,
                        color: '#fff',
                        textTransform: 'uppercase',
                        textShadow: '0 5px 16px rgba(0,0,0,.35)',
                      },
                    },
                    ctaContents(cta, iconProp('gig-announcement', props, 'ctaIcon')),
                  ),
                )
              : null,
          ),
        )
      : null,
    layout.tall
      ? h('div', {
          style: {
            position: 'absolute',
            left: 0,
            right: 0,
            bottom: 0,
            height: layout.bottomSafe,
            borderTop: '1px solid transparent',
          },
        })
      : null,
  )
}
