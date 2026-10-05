/** Today's date in the Netherlands as YYYY-MM-DD, so "today" matches the visitor's calendar. */
export function todayInAmsterdam(now = new Date()) {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Amsterdam' }).format(now)
}
