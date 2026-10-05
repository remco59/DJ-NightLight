import { randomBytes, timingSafeEqual } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { calendarSyncSettings } from '../../db/schema'
import { decryptSecret, encryptSecret } from '../../shared/secret-box'
import { db } from './db'
import { getCalendarSyncSettings } from './calendar-sync'

function password() {
  return String(useRuntimeConfig().session.password || '')
}

function newToken() {
  return randomBytes(32).toString('base64url')
}

export async function ensureIcsToken() {
  const settings = await getCalendarSyncSettings()
  if (settings.icsTokenEncrypted) return decryptSecret(settings.icsTokenEncrypted, password())

  const token = newToken()
  await db.update(calendarSyncSettings)
    .set({ icsTokenEncrypted: encryptSecret(token, password()), updatedAt: new Date() })
    .where(eq(calendarSyncSettings.key, 'default'))
  return token
}

export async function rotateIcsToken() {
  await getCalendarSyncSettings()
  const token = newToken()
  await db.update(calendarSyncSettings)
    .set({ icsTokenEncrypted: encryptSecret(token, password()), updatedAt: new Date() })
    .where(eq(calendarSyncSettings.key, 'default'))
  return token
}

export async function validIcsToken(candidate: string) {
  const expected = await ensureIcsToken()
  const a = Buffer.from(candidate)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

export function calendarFeedUrl(token: string) {
  const siteUrl = String(useRuntimeConfig().public.siteUrl || '').replace(/\/$/, '')
  return `${siteUrl}/api/calendar/feed/${encodeURIComponent(token)}.ics`
}
