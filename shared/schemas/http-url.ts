import { z } from 'zod'

/**
 * Absolute URL limited to http(s). `z.url()` alone also accepts `javascript:`, `data:` and
 * other schemes, which must never end up in an `href` or `src` on our pages.
 */
export const httpUrl = z.url({ protocol: /^https?$/ })

/**
 * Site-internal path such as `/boeken`. Protocol-relative URLs (`//host`) and their
 * backslash variants (`/\host`, which browsers treat the same) point to another site.
 */
export function isInternalPath(value: string) {
  return value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\')
}
