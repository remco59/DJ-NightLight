import { z } from 'zod'

/**
 * Absolute URL limited to http(s). `z.url()` alone also accepts `javascript:`, `data:` and
 * other schemes, which must never end up in an `href` or `src` on our pages.
 */
export const httpUrl = z.url({ protocol: /^https?$/ })
