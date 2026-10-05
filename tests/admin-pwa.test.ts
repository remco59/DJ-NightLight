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

  it('only caches gig endpoints and never writes', () => {
    const sw = read('public/admin-sw.js')
    const match = sw.match(/const GIG_API = (\/.*\/i)/)!
    const gigApi = new RegExp(match[1]!.slice(1, -2), 'i')
    const id = '123e4567-e89b-12d3-a456-426614174000'
    expect(gigApi.test('/api/admin/gigs')).toBe(true)
    expect(gigApi.test(`/api/admin/gigs/${id}`)).toBe(true)
    expect(gigApi.test(`/api/admin/gigs/${id}/portal-links`)).toBe(false)
    expect(gigApi.test('/api/admin/clients')).toBe(false)
    expect(sw).toContain("request.method !== 'GET'")
  })
})
