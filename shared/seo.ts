/** Hosts that should never be indexed: local development and the staging environment. */
export function isIndexableSite(siteUrl: string) {
  let host: string
  try {
    host = new URL(siteUrl).hostname.toLowerCase()
  }
  catch {
    return false
  }
  if (host === 'localhost' || host === '127.0.0.1' || host === '[::1]' || host.endsWith('.local') || host.endsWith('.test')) return false
  return !/^(dev|staging|test|acc)\./.test(host)
}

/** `path` made absolute on the site; keeps the site's own origin and drops a trailing slash except for the root. */
export function absoluteUrl(siteUrl: string, path: string) {
  const origin = new URL(siteUrl).origin
  const clean = path.split('#')[0]!.split('?')[0]!
  const normalized = clean === '/' || clean === '' ? '/' : `/${clean.replace(/^\/+|\/+$/g, '')}`
  return `${origin}${normalized}`
}

export function buildRobotsTxt(siteUrl: string) {
  if (!isIndexableSite(siteUrl)) return 'User-agent: *\nDisallow: /\n'
  return [
    'User-agent: *',
    'Disallow: /admin',
    'Disallow: /api/',
    'Disallow: /client/',
    '',
    `Sitemap: ${absoluteUrl(siteUrl, '/sitemap.xml')}`,
    '',
  ].join('\n')
}

export type SitemapEntry = { path: string, lastModified?: Date | string | null }

function escapeXml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;')
}

export function buildSitemapXml(siteUrl: string, entries: SitemapEntry[]) {
  const urls = entries.map((entry) => {
    const lastmod = entry.lastModified ? new Date(entry.lastModified) : null
    const lastmodTag = lastmod && !Number.isNaN(lastmod.getTime()) ? `<lastmod>${lastmod.toISOString().slice(0, 10)}</lastmod>` : ''
    return `  <url><loc>${escapeXml(absoluteUrl(siteUrl, entry.path))}</loc>${lastmodTag}</url>`
  })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

type BusinessInput = {
  siteUrl: string
  name: string
  description?: string | null
  image?: string | null
  email?: string | null
  phone?: string | null
  sameAs?: Array<string | null | undefined>
}

function absoluteImage(siteUrl: string, image: string | null | undefined) {
  if (!image) return undefined
  try {
    return new URL(image, new URL(siteUrl).origin).toString()
  }
  catch {
    return undefined
  }
}

function withoutEmpty<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined && item !== null && item !== '' && !(Array.isArray(item) && item.length === 0))) as Partial<T>
}

/** schema.org description of the DJ as a local entertainment business (home page). */
export function businessJsonLd(input: BusinessInput) {
  return withoutEmpty({
    '@context': 'https://schema.org',
    '@type': 'EntertainmentBusiness',
    'name': input.name,
    'url': absoluteUrl(input.siteUrl, '/'),
    'description': input.description || undefined,
    'image': absoluteImage(input.siteUrl, input.image),
    'email': input.email || undefined,
    'telephone': input.phone || undefined,
    'sameAs': (input.sameAs ?? []).filter((link): link is string => Boolean(link)),
    'areaServed': 'NL',
  })
}

type EventInput = {
  siteUrl: string
  title: string
  description?: string | null
  startsAt: string
  endsAt?: string | null
  location?: string | null
  organizer: string
}

/** schema.org Event for a public agenda item. The venue is only named, never given a street address. */
export function eventJsonLd(input: EventInput) {
  return withoutEmpty({
    '@context': 'https://schema.org',
    '@type': 'Event',
    'name': input.title,
    'description': input.description || undefined,
    'startDate': new Date(input.startsAt).toISOString(),
    'endDate': input.endsAt ? new Date(input.endsAt).toISOString() : undefined,
    'eventStatus': 'https://schema.org/EventScheduled',
    'eventAttendanceMode': 'https://schema.org/OfflineEventAttendanceMode',
    'location': input.location ? { '@type': 'Place', 'name': input.location } : undefined,
    'performer': { '@type': 'PerformingGroup', 'name': input.organizer },
    'url': absoluteUrl(input.siteUrl, '/agenda'),
  })
}

/** JSON for a `<script type="application/ld+json">`, safe against `</script>` and HTML comments in the data. */
export function jsonLdScript(data: unknown) {
  return JSON.stringify(data).replace(/</g, '\\u003c')
}
