import { describe, expect, it } from 'vitest'
import { firstSettingsPath, legacySettingsHashes, legacySettingsPaths, settingsGroups, settingsGroupsFor, settingsSectionAllowed } from '../app/utils/settings-sections'

const sections = settingsGroups.flatMap(group => group.sections)

describe('settings sections', () => {
  it('gives every section a unique path under /admin/settings', () => {
    const paths = sections.map(section => section.to)
    expect(new Set(paths).size).toBe(paths.length)
    for (const path of paths) expect(path).toMatch(/^\/admin\/settings\/[a-z-]+$/)
  })

  it('lets the owner reach everything', () => {
    expect(settingsGroupsFor('owner').flatMap(group => group.sections)).toHaveLength(sections.length)
  })

  it('keeps managers to the sections their API permissions allow', () => {
    const allowed = settingsGroupsFor('manager').flatMap(group => group.sections.map(section => section.to))
    expect(allowed).toEqual(['/admin/settings/emails', '/admin/settings/questionnaire', '/admin/settings/terms', '/admin/settings/account'])
    expect(settingsSectionAllowed('manager', '/admin/settings/users')).toBe(false)
    expect(settingsSectionAllowed('manager', '/admin/settings/emails/')).toBe(true)
  })

  it('leaves DJs and content editors with their own account only', () => {
    for (const role of ['dj', 'content_editor'] as const) {
      expect(settingsGroupsFor(role).flatMap(group => group.sections.map(section => section.to))).toEqual(['/admin/settings/account'])
      expect(firstSettingsPath(role)).toBe('/admin/settings/account')
    }
  })

  it('opens the owner on the company details and has no landing page without a role', () => {
    expect(firstSettingsPath('owner')).toBe('/admin/settings/company')
    expect(firstSettingsPath(undefined)).toBe('/admin')
    expect(settingsSectionAllowed(undefined, '/admin/settings/company')).toBe(false)
  })

  it('maps every old URL and anchor to a section that exists', () => {
    const paths = new Set(sections.map(section => section.to))
    for (const target of [...Object.values(legacySettingsPaths), ...Object.values(legacySettingsHashes)]) expect(paths.has(target), target).toBe(true)
  })
})
