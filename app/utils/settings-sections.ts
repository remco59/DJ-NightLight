import type { StaffRole } from '~~/shared/auth'

// The structure of Instellingen: one list drives the sidebar, the mobile picker,
// the role guard and the redirects from the old URLs.
export type SettingsSection = { label: string, to: string, icon: string, roles: readonly StaffRole[] }
export type SettingsGroup = { label: string, sections: SettingsSection[] }

const owner: readonly StaffRole[] = ['owner']
const ownerAndManager: readonly StaffRole[] = ['owner', 'manager']
const everyone: readonly StaffRole[] = ['owner', 'manager', 'dj', 'content_editor']

export const settingsGroups: SettingsGroup[] = [
  { label: 'Bedrijf', sections: [
    { label: 'Bedrijfsgegevens', to: '/admin/settings/company', icon: 'lucide:building-2', roles: owner },
    { label: 'Facturatie', to: '/admin/settings/invoicing', icon: 'lucide:receipt-text', roles: owner },
    { label: 'Meldingen', to: '/admin/settings/notifications', icon: 'lucide:bell', roles: owner },
  ] },
  { label: 'Communicatie', sections: [
    { label: 'E-mailautomatisering', to: '/admin/settings/emails', icon: 'lucide:mail', roles: ownerAndManager },
    { label: 'Vragenlijst', to: '/admin/settings/questionnaire', icon: 'lucide:clipboard-list', roles: ownerAndManager },
    { label: 'Voorwaarden', to: '/admin/settings/terms', icon: 'lucide:scroll-text', roles: ownerAndManager },
    { label: 'Klantportaal', to: '/admin/settings/client-portal', icon: 'lucide:image', roles: owner },
  ] },
  { label: 'Koppelingen', sections: [
    { label: 'Overzicht', to: '/admin/settings/integrations', icon: 'lucide:link-2', roles: owner },
    { label: 'Betalingen (Stripe)', to: '/admin/settings/stripe', icon: 'lucide:credit-card', roles: owner },
    { label: 'E-mail (Resend)', to: '/admin/settings/resend', icon: 'lucide:send', roles: owner },
    { label: 'Google Agenda', to: '/admin/settings/google-calendar', icon: 'lucide:calendar-days', roles: owner },
    { label: 'Instagram', to: '/admin/settings/instagram', icon: 'lucide:instagram', roles: owner },
  ] },
  { label: 'Team', sections: [
    { label: 'Gebruikers', to: '/admin/settings/users', icon: 'lucide:user-cog', roles: owner },
    { label: 'Mijn account', to: '/admin/settings/account', icon: 'lucide:lock-keyhole', roles: everyone },
  ] },
  { label: 'Systeem', sections: [
    { label: 'Status', to: '/admin/settings/system', icon: 'lucide:activity', roles: owner },
    { label: 'Video-rendering', to: '/admin/settings/rendering', icon: 'lucide:clapperboard', roles: owner },
    { label: 'Software-updates', to: '/admin/settings/updates', icon: 'lucide:download', roles: owner },
  ] },
]

export function settingsGroupsFor(role: StaffRole | undefined): SettingsGroup[] {
  if (!role) return []
  return settingsGroups
    .map(group => ({ ...group, sections: group.sections.filter(section => section.roles.includes(role)) }))
    .filter(group => group.sections.length)
}

export function settingsSectionAllowed(role: StaffRole | undefined, path: string) {
  if (!role) return false
  const clean = path.replace(/\/+$/, '')
  return settingsGroups.some(group => group.sections.some(section => section.to === clean && section.roles.includes(role)))
}

export function firstSettingsPath(role: StaffRole | undefined) {
  return settingsGroupsFor(role)[0]?.sections[0]?.to ?? '/admin'
}

// Old URLs and anchors, kept so bookmarks and links in sent e-mails keep working.
export const legacySettingsPaths: Record<string, string> = {
  '/admin/email': '/admin/settings/emails',
  '/admin/questionnaire': '/admin/settings/questionnaire',
  '/admin/client-portal': '/admin/settings/client-portal',
  '/admin/users': '/admin/settings/users',
  '/admin/account': '/admin/settings/account',
  '/admin/system': '/admin/settings/system',
}

export const legacySettingsHashes: Record<string, string> = {
  general: '/admin/settings/company',
  integrations: '/admin/settings/integrations',
  rendering: '/admin/settings/rendering',
  system: '/admin/settings/system',
}
