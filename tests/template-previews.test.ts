import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { MOTION_TEMPLATE_KEYS } from '../shared/video-templates'

// Previews are rendered by `npm run templates:previews`; a new template needs one.
describe('motion template previews', () => {
  it.each(MOTION_TEMPLATE_KEYS)('%s has a rendered preview', (key) => {
    expect(existsSync(resolve(process.cwd(), 'public/brand/templates', `${key}.webp`))).toBe(true)
  })
})
