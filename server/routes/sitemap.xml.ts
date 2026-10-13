import { and, eq } from 'drizzle-orm'
import { landingPages } from '../../db/schema'
import { buildSitemapXml, isIndexableSite, type SitemapEntry } from '../../shared/seo'
import { db } from '../utils/db'

type PublicContent = { content?: { gallery?: Array<{ url?: string }>, showreelUrl?: string | null } }

export default defineEventHandler(async (event) => {
  const siteUrl = String(useRuntimeConfig().public.siteUrl)
  setResponseHeader(event, 'content-type', 'application/xml; charset=utf-8')
  setResponseHeader(event, 'cache-control', 'public, max-age=3600')
  if (!isIndexableSite(siteUrl)) return buildSitemapXml(siteUrl, [])

  const site = await $fetch<PublicContent>('/api/public/content').catch(() => null)
  const hasMedia = Boolean(site?.content?.gallery?.some(image => image.url) || site?.content?.showreelUrl)
  const pages = await db
    .select({ slug: landingPages.slug, updatedAt: landingPages.updatedAt })
    .from(landingPages)
    .where(and(eq(landingPages.published, true), eq(landingPages.indexable, true)))

  const entries: SitemapEntry[] = [
    { path: '/' },
    { path: '/about' },
    ...(hasMedia ? [{ path: '/media' }] : []),
    { path: '/agenda' },
    { path: '/boeken' },
    ...pages.map(page => ({ path: `/diensten/${page.slug}`, lastModified: page.updatedAt })),
  ]
  return buildSitemapXml(siteUrl, entries)
})
