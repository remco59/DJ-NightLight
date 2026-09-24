// Dutch display labels for values stored in the database. The stored values stay
// English; the back office shows these labels instead.

type Labels = Record<string, string>

export const gigStatusLabels: Labels = {
  lead: 'Lead',
  booked: 'Geboekt',
  declined: 'Afgewezen',
  cancelled: 'Geannuleerd',
}

export const invoiceStatusLabels: Labels = {
  draft: 'Concept',
  finalized: 'Definitief',
  void: 'Vervallen',
}

export const paymentStatusLabels: Labels = {
  unpaid: 'Onbetaald',
  pending: 'In afwachting',
  paid: 'Betaald',
  failed: 'Mislukt',
  succeeded: 'Geslaagd',
  cancelled: 'Geannuleerd',
  expired: 'Verlopen',
}

export const roleLabels: Labels = {
  owner: 'Eigenaar',
  manager: 'Manager',
  dj: 'DJ',
  content_editor: 'Contentredacteur',
}

export const clientTypeLabels: Labels = {
  person: 'Particulier',
  company: 'Bedrijf',
}

export const portalLinkStateLabels: Labels = {
  active: 'Actief',
  expired: 'Verlopen',
  revoked: 'Ingetrokken',
}

export const submissionStatusLabels: Labels = {
  not_started: 'Nog niet begonnen',
  draft: 'Concept',
  submitted: 'Ingediend',
}

export const musicWishCategoryLabels: Labels = {
  must_play: 'Moet gedraaid worden',
  nice_to_have: 'Leuk om te draaien',
  do_not_play: 'Niet draaien',
  special_moment: 'Speciaal moment',
}

export const calendarSyncStatusLabels: Labels = {
  pending: 'In wachtrij',
  syncing: 'Bezig met synchroniseren',
  synced: 'Gesynchroniseerd',
  failed: 'Mislukt',
  skipped: 'Overgeslagen',
}

export const emailJobStatusLabels: Labels = {
  pending: 'In wachtrij',
  processing: 'Bezig',
  sent: 'Verzonden',
  failed: 'Mislukt',
  cancelled: 'Geannuleerd',
  suppressed: 'Onderdrukt',
}

export const activityActionLabels: Labels = {
  created: 'Aangemaakt',
  updated: 'Bijgewerkt',
  status_changed: 'Status gewijzigd',
  assignment_changed: 'DJ-toewijzing gewijzigd',
  duplicated: 'Gedupliceerd',
  archived: 'Gearchiveerd',
  deleted: 'Verwijderd',
  invoice_created: 'Factuur aangemaakt',
  invoice_draft_updated: 'Conceptfactuur bijgewerkt',
  invoice_finalized: 'Factuur definitief gemaakt',
  invoice_voided: 'Factuur vervallen verklaard',
  payment_received: 'Betaling ontvangen',
  payment_failed: 'Betaling mislukt',
  payment_expired: 'Betaling verlopen',
  payment_pending: 'Betaling in afwachting',
  payment_amount_mismatch: 'Betaald bedrag wijkt af',
  portal_accessed: 'Portaal geopend',
  portal_link_created: 'Portaallink aangemaakt',
  portal_link_revoked: 'Portaallink ingetrokken',
  portal_invitation_resent: 'Portaaluitnodiging opnieuw verstuurd',
  portal_submission_completed: 'Portaalformulier ingediend',
  questionnaire_version_created: 'Nieuwe vragenlijstversie',
  website_inquiry: 'Aanvraag via website',
  user_created: 'Gebruiker aangemaakt',
  user_updated: 'Gebruiker bijgewerkt',
  user_disabled: 'Gebruiker uitgeschakeld',
  password_changed: 'Wachtwoord gewijzigd',
  password_reset: 'Wachtwoord opnieuw ingesteld',
}

// Falls back to the raw value with underscores as spaces, so a value added later
// still reads sensibly until it gets a label.
export function labelFor(labels: Labels, value: string | null | undefined) {
  if (!value) return ''
  return labels[value] ?? value.replaceAll('_', ' ')
}
