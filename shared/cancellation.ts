/**
 * The cancellation scale from the terms (article 11): free up to 21 days before the event, then 25% up to 7 days,
 * 50% up to 24 hours, and 100% after that. Reservation costs already paid count towards the fee.
 */
export const CANCELLATION_STEPS = [
  { minHoursBefore: 21 * 24, percent: 0 },
  { minHoursBefore: 7 * 24, percent: 25 },
  { minHoursBefore: 24, percent: 50 },
  { minHoursBefore: 0, percent: 100 },
] as const

export function cancellationPercent(startsAt: Date | string, now = new Date()) {
  const hoursBefore = (new Date(startsAt).getTime() - now.getTime()) / 3_600_000
  return CANCELLATION_STEPS.find(step => hoursBefore >= step.minHoursBefore)?.percent ?? 100
}

/**
 * What cancelling now costs: the fee, what the paid reservation already covers, and what is still to invoice.
 * Costs for rented gear or travel that were really made come on top, up to the full price; they are not known here.
 */
export function cancellationFee(input: { totalCents: number, reservationPaidCents: number, startsAt: Date | string, now?: Date }) {
  const percent = cancellationPercent(input.startsAt, input.now)
  const feeCents = Math.round(input.totalCents * percent / 100)
  const coveredCents = Math.min(input.reservationPaidCents, feeCents)
  return { percent, feeCents, coveredCents, dueCents: feeCents - coveredCents }
}
