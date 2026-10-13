import { describe, expect, it } from 'vitest'
import { DEFAULT_FOLLOW_UP_DAYS, followUpDate, leadFollowUp, leadFollowUpHint, RESPOND_WITHIN_HOURS } from '../shared/lead-followup'

const now = new Date('2026-11-10T12:00:00.000Z')
const hoursAgo = (hours: number) => new Date(now.getTime() - hours * 3600_000)
const daysFromNow = (days: number) => new Date(now.getTime() + days * 86_400_000)

describe('lead follow-up state', () => {
  it('is new within a day of the request', () => {
    const result = leadFollowUp({ createdAt: hoursAgo(3) }, now)
    expect(result).toMatchObject({ state: 'new', actionable: true, tone: 'info' })
  })

  it('asks for a reaction once a day has passed without one', () => {
    const result = leadFollowUp({ createdAt: hoursAgo(RESPOND_WITHIN_HOURS + 1) }, now)
    expect(result).toMatchObject({ state: 'respond', actionable: true, tone: 'danger', label: 'Nog niet gereageerd' })
    expect(result?.dueAt?.getTime()).toBe(hoursAgo(1).getTime())
  })

  it('waits on the client after a reaction', () => {
    const result = leadFollowUp({ createdAt: hoursAgo(80), lastContactedAt: hoursAgo(2), followUpAt: daysFromNow(2) }, now)
    expect(result).toMatchObject({ state: 'waiting', actionable: false })
    expect(result?.dueAt?.getTime()).toBe(daysFromNow(2).getTime())
  })

  it('waits without a date when no follow-up was planned', () => {
    expect(leadFollowUp({ createdAt: hoursAgo(80), lastContactedAt: hoursAgo(2), followUpAt: null }, now)).toMatchObject({ state: 'waiting', dueAt: null, actionable: false })
  })

  it('asks to follow up when the follow-up date has come', () => {
    expect(leadFollowUp({ createdAt: hoursAgo(200), lastContactedAt: hoursAgo(100), followUpAt: hoursAgo(5) }, now)).toMatchObject({ state: 'follow_up', actionable: true, tone: 'warning' })
  })

  it('is over once the event date has passed', () => {
    expect(leadFollowUp({ createdAt: hoursAgo(200), startsAt: hoursAgo(1) }, now)).toBeNull()
    expect(leadFollowUp({ createdAt: hoursAgo(200), startsAt: daysFromNow(10) }, now)?.state).toBe('respond')
  })
})

describe('follow-up date', () => {
  it('adds the chosen number of days', () => {
    expect(followUpDate(DEFAULT_FOLLOW_UP_DAYS, now)?.toISOString()).toBe('2026-11-13T12:00:00.000Z')
  })

  it('can be skipped', () => {
    expect(followUpDate(null, now)).toBeNull()
  })
})

describe('follow-up hint', () => {
  it('names the follow-up day while waiting', () => {
    const waiting = leadFollowUp({ createdAt: hoursAgo(80), lastContactedAt: hoursAgo(2), followUpAt: new Date('2026-11-13T12:00:00.000Z') }, now)!
    expect(leadFollowUpHint(waiting, now)).toMatch(/^Opvolgen op .*13 nov/)
  })

  it('says how long a lead has been due', () => {
    expect(leadFollowUpHint(leadFollowUp({ createdAt: hoursAgo(24 * 3 + 5) }, now)!, now)).toBe('2 dagen geleden aan de beurt')
    expect(leadFollowUpHint(leadFollowUp({ createdAt: hoursAgo(26) }, now)!, now)).toBe('2 uur geleden aan de beurt')
    expect(leadFollowUpHint(leadFollowUp({ createdAt: hoursAgo(2) }, now)!, now)).toBe('Binnengekomen vandaag')
  })
})
