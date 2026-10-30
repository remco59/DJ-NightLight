import { z } from 'zod'

export const reservationModes = ['fixed', 'percentage'] as const
export type ReservationMode = typeof reservationModes[number]
/** Cents for a fixed amount, basis points (2500 = 25%) for a percentage. */
export type Reservation = { mode: ReservationMode, value: number }

/** What the amount starts at when the owner switches reservation costs on for a quote. */
export const RESERVATION_DEFAULT_BASIS_POINTS = 2500

export const reservationInputSchema = z.object({
  mode: z.enum(reservationModes),
  value: z.number().int().positive('Het bedrag of percentage voor de reservering moet groter dan nul zijn'),
}).refine(value => value.mode === 'fixed' || value.value <= 10000, { path: ['value'], message: 'Een percentage kan niet hoger zijn dan 100%' })

/** The reservation in cents for a quote total, never more than the total itself. Zero when there is no reservation. */
export function reservationCents(totalCents: number, reservation: Reservation | null | undefined) {
  if (!reservation) return 0
  const raw = reservation.mode === 'fixed' ? reservation.value : Math.round(totalCents * reservation.value / 10000)
  return Math.min(Math.max(raw, 0), Math.max(totalCents, 0))
}

/** Whether a reservation on this total is workable: more than nothing, and not more than the total. */
export function reservationProblem(totalCents: number, reservation: Reservation | null | undefined) {
  if (!reservation) return null
  if (reservation.mode === 'fixed' && reservation.value > totalCents) return 'De reserveringskosten zijn hoger dan het totaalbedrag van de offerte.'
  if (reservationCents(totalCents, reservation) <= 0) return 'De reserveringskosten komen uit op € 0,00.'
  return null
}

export function quoteReservation(quote: { reservationMode: string | null, reservationValue: number | null }): Reservation | null {
  return quote.reservationMode && quote.reservationValue ? { mode: quote.reservationMode as ReservationMode, value: quote.reservationValue } : null
}
