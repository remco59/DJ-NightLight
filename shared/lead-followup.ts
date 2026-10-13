/** A new request should get an answer within this many hours. */
export const RESPOND_WITHIN_HOURS = 24
/** Default wait before following up on a lead that has been answered. */
export const DEFAULT_FOLLOW_UP_DAYS = 3
export const FOLLOW_UP_CHOICES = [
  { days: 3, label: 'Over 3 dagen' },
  { days: 7, label: 'Over een week' },
] as const

const HOUR_MS = 60 * 60 * 1000
const DAY_MS = 24 * HOUR_MS

export type LeadFollowUpState = 'new' | 'respond' | 'waiting' | 'follow_up'

export type LeadFollowUpInput = {
  createdAt: Date | string
  lastContactedAt?: Date | string | null
  followUpAt?: Date | string | null
  startsAt?: Date | string | null
}

export type LeadFollowUp = {
  state: LeadFollowUpState
  /** When action is (or was) due; null while waiting without a follow-up date. */
  dueAt: Date | null
  /** Whether this lead needs the owner to do something now. */
  actionable: boolean
  label: string
  tone: 'info' | 'danger' | 'warning' | 'neutral'
}

const time = (value: Date | string | null | undefined) => value ? new Date(value).getTime() : null

/**
 * Where a lead stands in the follow-up. Returns null once the event date has passed,
 * because there is nothing left to follow up on.
 */
export function leadFollowUp(input: LeadFollowUpInput, now = new Date()): LeadFollowUp | null {
  const startsAt = time(input.startsAt)
  if (startsAt !== null && startsAt < now.getTime()) return null

  const createdAt = time(input.createdAt) ?? now.getTime()
  const contactedAt = time(input.lastContactedAt)

  if (contactedAt === null) {
    const dueAt = new Date(createdAt + RESPOND_WITHIN_HOURS * HOUR_MS)
    return dueAt.getTime() <= now.getTime()
      ? { state: 'respond', dueAt, actionable: true, label: 'Nog niet gereageerd', tone: 'danger' }
      : { state: 'new', dueAt, actionable: true, label: 'Nieuw', tone: 'info' }
  }

  const followUpAt = time(input.followUpAt)
  if (followUpAt !== null && followUpAt <= now.getTime()) {
    return { state: 'follow_up', dueAt: new Date(followUpAt), actionable: true, label: 'Opvolgen', tone: 'warning' }
  }
  return { state: 'waiting', dueAt: followUpAt === null ? null : new Date(followUpAt), actionable: false, label: 'Wacht op klant', tone: 'neutral' }
}

/** The follow-up moment when marking a lead as answered; null means no follow-up. */
export function followUpDate(days: number | null, from = new Date()) {
  return days === null ? null : new Date(from.getTime() + days * DAY_MS)
}

/** "Opvolgen op di 18 nov" style hint for a waiting lead, or a short age for the others. */
export function leadFollowUpHint(followUp: LeadFollowUp, now = new Date()) {
  if (followUp.state === 'waiting') {
    if (!followUp.dueAt) return 'Geen opvolgdatum'
    return `Opvolgen op ${new Intl.DateTimeFormat('nl-NL', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Europe/Amsterdam' }).format(followUp.dueAt)}`
  }
  if (!followUp.dueAt) return ''
  const hours = Math.max(0, Math.round((now.getTime() - followUp.dueAt.getTime()) / HOUR_MS))
  if (followUp.state === 'new') return 'Binnengekomen vandaag'
  const days = Math.floor(hours / 24)
  if (days >= 1) return `${days} ${days === 1 ? 'dag' : 'dagen'} geleden aan de beurt`
  return hours >= 1 ? `${hours} uur geleden aan de beurt` : 'Nu aan de beurt'
}

export const leadFollowUpLabels: Record<LeadFollowUpState, string> = {
  new: 'Nieuw',
  respond: 'Nog niet gereageerd',
  waiting: 'Wacht op klant',
  follow_up: 'Opvolgen',
}
