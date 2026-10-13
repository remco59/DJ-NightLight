import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8')

describe('admin PWA', () => {
  const manifest = JSON.parse(read('public/admin.webmanifest'))

  it('has an installable manifest scoped to the admin', () => {
    expect(manifest.display).toBe('standalone')
    expect(manifest.start_url.startsWith(manifest.scope)).toBe(true)
    expect(manifest.scope).toBe('/admin')
    const sizes = manifest.icons.map((icon: { sizes: string }) => icon.sizes)
    expect(sizes).toEqual(expect.arrayContaining(['192x192', '512x512']))
    for (const icon of manifest.icons) expect(existsSync(resolve(process.cwd(), `public${icon.src}`))).toBe(true)
  })

  it('serves the service worker with a matching scope header', () => {
    expect(read('nuxt.config.ts')).toContain("'service-worker-allowed': '/admin'")
    expect(read('public/admin-sw.js')).toContain('/admin-offline.html')
  })

  it('only caches the read-only offline endpoints and never writes', () => {
    const sw = read('public/admin-sw.js')
    const block = sw.match(/const DATA_API = \[([\s\S]*?)\n\]/)![1]!
    const patterns = [...block.matchAll(/^\s*\/(.*)\/i,$/gm)].map(match => new RegExp(match[1]!, 'i'))
    const id = '123e4567-e89b-12d3-a456-426614174000'
    const cached = (path: string) => patterns.some(pattern => pattern.test(path))
    for (const path of ['/api/admin/gigs', `/api/admin/gigs/${id}`, `/api/admin/gigs/${id}/portal-submission`, `/api/admin/venues/${id}`, `/api/admin/clients/${id}`, '/api/admin/dashboard', '/api/admin/calendar/events']) {
      expect(cached(path), path).toBe(true)
    }
    // Portal links hold secret URLs, the calendar settings hold the ICS token, invoices are financial.
    for (const path of [`/api/admin/gigs/${id}/portal-links`, `/api/admin/gigs/${id}/offline-changes`, '/api/admin/calendar', '/api/admin/clients', '/api/admin/venues', '/api/admin/invoices', '/api/admin/settings', '/api/auth/session']) {
      expect(cached(path), path).toBe(false)
    }
    expect(sw).toContain("request.method !== 'GET'")
  })

  it('serves the same pages offline as the app allows', async () => {
    const { worksOffline } = await import('../shared/offline-routes')
    const sw = read('public/admin-sw.js')
    const block = sw.match(/const DATA_PAGES = \[([\s\S]*?)\n\]/)![1]!
    const patterns = [...block.matchAll(/^\s*\/(.*)\/i,$/gm)].map(match => new RegExp(match[1]!, 'i'))
    const id = '123e4567-e89b-12d3-a456-426614174000'
    for (const path of ['/admin', '/admin/gigs', `/admin/gigs/${id}`, '/admin/calendar', `/admin/venues/${id}`, `/admin/clients/${id}`, '/admin/invoices', '/admin/venues', '/admin/settings']) {
      expect(patterns.some(pattern => pattern.test(path)), path).toBe(worksOffline(path))
    }
  })

  it('wipes the cached data when the session ends', () => {
    expect(read('public/admin-sw.js')).toContain("'clear-cache'")
    expect(read('app/plugins/admin-pwa.client.ts')).toContain("type: 'clear-cache'")
  })
})

describe('offline routes', () => {
  it('keeps the dashboard, gigs, agenda, venues, clients and the offline page available offline', async () => {
    const { worksOffline } = await import('../shared/offline-routes')
    const id = '123e4567-e89b-12d3-a456-426614174000'
    for (const path of ['/admin', '/admin/', '/admin/gigs', `/admin/gigs/${id}`, '/admin/calendar', `/admin/venues/${id}`, `/admin/clients/${id}`, '/admin/offline']) {
      expect(worksOffline(path), path).toBe(true)
    }
    for (const path of ['/admin/invoices', '/admin/clients', '/admin/venues', '/admin/gigs/new', '/admin/settings', '/admin/media', '/admin/users', '/admin/post-generator']) {
      expect(worksOffline(path), path).toBe(false)
    }
  })
})
