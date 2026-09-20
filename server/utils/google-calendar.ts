type TokenResponse = {
  access_token: string
  expires_in?: number
}

let cachedToken: { value: string, expiresAt: number } | null = null

function credentials() {
  const config = useRuntimeConfig()
  const calendar = config.googleCalendar as { clientId?: string, clientSecret?: string, refreshToken?: string }
  if (!calendar.clientId || !calendar.clientSecret || !calendar.refreshToken) {
    throw new Error('Google Calendar credentials are not configured')
  }
  return {
    clientId: calendar.clientId,
    clientSecret: calendar.clientSecret,
    refreshToken: calendar.refreshToken,
  }
}

async function accessToken(forceRefresh = false) {
  if (!forceRefresh && cachedToken && cachedToken.expiresAt > Date.now() + 60_000) {
    return cachedToken.value
  }

  const { clientId, clientSecret, refreshToken } = credentials()
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  })

  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500)
    throw new Error(`Google OAuth refresh failed (${response.status}): ${detail}`)
  }

  const payload = await response.json() as TokenResponse
  if (!payload.access_token) throw new Error('Google OAuth response did not contain an access token')
  cachedToken = {
    value: payload.access_token,
    expiresAt: Date.now() + Math.max(60, payload.expires_in || 3600) * 1000,
  }
  return cachedToken.value
}

export async function googleCalendarFetch(path: string, init: RequestInit = {}) {
  async function execute(forceRefresh = false) {
    const token = await accessToken(forceRefresh)
    const headers = new Headers(init.headers)
    headers.set('authorization', `Bearer ${token}`)
    if (init.body && !headers.has('content-type')) headers.set('content-type', 'application/json')
    return fetch(`https://www.googleapis.com/calendar/v3/${path}`, { ...init, headers })
  }

  let response = await execute()
  if (response.status === 401) {
    cachedToken = null
    response = await execute(true)
  }
  return response
}
