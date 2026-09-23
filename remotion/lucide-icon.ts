import type React from 'react'
import { createElement as h } from 'react'
import { LUCIDE_ICONS, type LucideIconName } from '../shared/lucide-icons'

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
    'dangerouslySetInnerHTML': { __html: LUCIDE_ICONS[name].body },
  })
