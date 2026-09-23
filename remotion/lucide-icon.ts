import type React from 'react'
import { createElement as h } from 'react'

// The website draws its icons from Lucide (@iconify-json/lucide via @nuxt/icon).
// Remotion renders React, not Vue, so the few icons the templates need are
// copied here verbatim instead of bundling the whole icon set into the preview
// and the render worker. tests/video-composition.test.ts keeps them in sync.
export const LUCIDE_ICONS = {
  'calendar': '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M8 2v3m8-3v3"/><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/></g>',
  'clock': '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></g>',
  'map-pin': '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></g>',
  'instagram': '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><rect width="20" height="20" x="2" y="2" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8A4 4 0 0 1 16 11.37m1.5-4.87h.01"/></g>',
  'globe': '<g fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20a14.5 14.5 0 0 0 0-20M2 12h20"/></g>',
  'arrow-right': '<path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 12h14m-7-7l7 7l-7 7"/>',
} as const

export type LucideIconName = keyof typeof LUCIDE_ICONS

/** A Lucide icon sized by `size` (px or CSS length) and coloured by `currentColor`. */
export const LucideIcon: React.FC<{
  name: LucideIconName
  size?: number | string
  style?: React.CSSProperties
}> = ({ name, size = '1em', style }) =>
  h('svg', {
    'xmlns': 'http://www.w3.org/2000/svg',
    'viewBox': '0 0 24 24',
    'width': size,
    'height': size,
    'aria-hidden': true,
    'style': { display: 'inline-block', flexShrink: 0, ...style },
    'dangerouslySetInnerHTML': { __html: LUCIDE_ICONS[name] },
  })
