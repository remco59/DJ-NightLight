export function gigEndFromDuration(
  startsAt: string | Date | null | undefined,
  durationHours: string | number | null | undefined,
) {
  if (!startsAt || durationHours === null || durationHours === undefined || durationHours === '') return null

  const start = startsAt instanceof Date ? new Date(startsAt.getTime()) : new Date(startsAt)
  const hours = typeof durationHours === 'string'
    ? Number(durationHours.replace(',', '.'))
    : Number(durationHours)

  if (Number.isNaN(start.getTime()) || !Number.isFinite(hours) || hours <= 0) return null

  return new Date(start.getTime() + hours * 60 * 60 * 1000)
}
