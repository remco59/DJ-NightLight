import type { InstagramHealthLevel } from '~~/shared/instagram'

export type Source = 'settings' | 'environment' | 'none'
export type CancellationBehavior = 'delete' | 'mark_cancelled' | 'keep'

export type InstagramStatus = {
  source: Source
  configured: boolean
  appIdPreview: string | null
  appSecretConfigured: boolean
  loginConfigId: string
  redirectUri: string
  account: {
    id: string
    username: string
    accountType: string | null
    externalIdPreview: string
    pageName: string | null
    status: 'active' | 'needs_reauth' | 'disabled'
    tokenIssuedAt: string
    tokenExpiresAt: string
    canPublish: boolean
    lastCheckedAt: string | null
    lastError: string | null
  } | null
  lastPublishedAt: string | null
  lastWorkerRunAt: string | null
  workerOnline: boolean
  health: { level: InstagramHealthLevel, title: string, detail: string }
}

export type IntegrationsData = {
  instagram: InstagramStatus
  calendar: {
    source: Source
    configured: boolean
    clientId: string
    clientSecretConfigured: boolean
    refreshTokenConfigured: boolean
    enabled: boolean
    calendarId: string
    cancellationBehavior: CancellationBehavior
  }
  email: {
    source: Source
    configured: boolean
    apiKeyConfigured: boolean
    apiKeyPreview: string | null
    from: string
    reviewUrl: string
  }
}
