// The six-week grid the agenda shows for a month: it starts on the Monday on or
// before the 1st. The agenda page and the offline warm-up must ask the API for
// exactly the same range, otherwise the cached response is never found.
export function monthGridRange(value: Date) {
  const first = new Date(value.getFullYear(), value.getMonth(), 1)
  const weekday = first.getDay() || 7
  const start = new Date(first.getFullYear(), first.getMonth(), first.getDate() + 1 - weekday)
  const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 42)
  return { start, end }
}
