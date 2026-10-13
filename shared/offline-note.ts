// An offline note is appended to the gig's internal notes with a header, so it
// can never overwrite what someone else wrote in the meantime.
export function formatOfflineNote(text: string, author: string, madeAt: Date) {
  const when = new Intl.DateTimeFormat('nl-NL', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Amsterdam',
  }).format(madeAt).replace(/[.,]/g, '')
  return `[${when} · ${author}] ${text.trim()}`
}

export function appendNote(existing: string | null, note: string) {
  const current = existing?.trimEnd()
  return current ? `${current}\n\n${note}` : note
}
