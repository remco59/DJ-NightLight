import type { QuestionnaireField } from './questionnaire'

/**
 * Ready-made booking forms. Choosing one for a gig copies its questions to that gig, where they can be changed
 * without touching the template or other gigs. The "standaard" choice instead copies the questionnaire from Instellingen.
 */
export const bookingFormTemplateKeys = ['standaard', 'bruiloft', 'bedrijfsfeest', 'verjaardag'] as const
export type BookingFormTemplateKey = typeof bookingFormTemplateKeys[number]

export const bookingFormTemplateLabels: Record<BookingFormTemplateKey, { label: string, description: string }> = {
  standaard: { label: 'Standaard vragenlijst', description: 'De vragenlijst uit Instellingen, zoals die nu is.' },
  bruiloft: { label: 'Bruiloft', description: 'Namen, ceremonie, openingsdans, entree en de algemene vragen.' },
  bedrijfsfeest: { label: 'Bedrijfsfeest / zakelijk', description: 'Bedrijfsgegevens, factuurreferentie, muziekrechten en de algemene vragen.' },
  verjaardag: { label: 'Verjaardag / privéfeest', description: 'Korte versie met de algemene vragen.' },
}

const FEEST = 'Het feest'
const LOCATIE = 'Locatie en techniek'
const MUZIEK = 'Muziek'
const PROGRAMMA = 'Tijdens het event'
const OVERIG = 'Overig'

const soundOwn = 'Ik of de locatie verzorgt het geluid'

const algemeen: QuestionnaireField[] = [
  { id: 'guest_count', type: 'number', label: 'Ongeveer hoeveel gasten verwacht je?', required: true, section: FEEST },
  { id: 'age_group', type: 'select', label: 'Wat is de leeftijdsgroep?', required: false, section: FEEST, options: ['Vooral jong (tot 25)', 'Gemengd', 'Vooral 40 en ouder', 'Alle leeftijden'] },
  { id: 'onsite_contact', type: 'short_text', label: 'Contactpersoon op de dag zelf (naam)', required: true, section: FEEST, helpText: 'Vaak niet de opdrachtgever. Iemand die de DJ kan helpen en bereikbaar is.' },
  { id: 'onsite_phone', type: 'phone', label: 'Telefoonnummer van de contactpersoon', required: true, section: FEEST },

  { id: 'location_type', type: 'select', label: 'Wat voor locatie is het?', required: true, section: LOCATIE, options: ['Zaal of feestlocatie', 'Feesttent', 'Buiten', 'Thuis', 'Anders'] },
  { id: 'load_info', type: 'long_text', label: 'Laden en lossen', required: false, section: LOCATIE, helpText: 'Waar kan de DJ parkeren, hoe ver is het naar de opstelplek, zit er een trap of lift in en vanaf hoe laat is de locatie toegankelijk?' },
  { id: 'sound_provider', type: 'select', label: 'Wie verzorgt de geluidsinstallatie?', required: true, section: LOCATIE, options: ['De DJ verzorgt het geluid', soundOwn] },
  { id: 'sound_details', type: 'short_text', label: 'Merk en type van de installatie', required: false, section: LOCATIE, showIf: { fieldId: 'sound_provider', equals: soundOwn } },
  { id: 'sound_connections', type: 'multi_select', label: 'Welke aansluitingen zijn er?', required: true, section: LOCATIE, options: ['XLR', '6,3 mm jack', 'RCA/tulp', '3,5 mm', 'Weet ik niet'], showIf: { fieldId: 'sound_provider', equals: soundOwn } },
  { id: 'sound_distance', type: 'acknowledgement', label: 'Er is een aansluiting binnen 6 meter van de DJ-plek.', required: true, section: LOCATIE, showIf: { fieldId: 'sound_provider', equals: soundOwn } },
  { id: 'light_provider', type: 'select', label: 'Wie verzorgt het licht?', required: true, section: LOCATIE, options: ['De DJ verzorgt het licht', 'Ik of de locatie verzorgt het licht', 'Geen licht nodig'] },
  { id: 'dj_spot', type: 'acknowledgement', label: 'Er is een plek van minimaal 2 meter lang en 1,5 meter breed voor de DJ, bij voorkeur op een verhoging.', required: true, section: LOCATIE },
  { id: 'power', type: 'acknowledgement', label: 'Er is minimaal 1 stopcontact (of stekkerdoos) binnen 1,5 meter van de DJ-plek.', required: true, section: LOCATIE },
  { id: 'sound_limit', type: 'long_text', label: 'Zijn er geluidsbeperkingen of een vaste eindtijd?', required: false, section: LOCATIE, helpText: 'Bijvoorbeeld door de gemeente, de locatie of de buren.' },

  { id: 'genres', type: 'multi_select', label: 'Welke muziek mag er gedraaid worden?', required: true, section: MUZIEK, options: ['Top 40 / pop', 'Nederlandstalig', 'Dance / house', 'Hiphop / R&B', 'Rock', 'Disco / funk', 'Jaren 80 en 90', 'Latin', 'Van alles wat'] },
  { id: 'music_notes', type: 'long_text', label: 'Toelichting op de muziek', required: false, section: MUZIEK, helpText: 'Sfeer, wat past bij jullie, wat past niet. Specifieke nummers voeg je toe bij Muziekwensen.' },
  { id: 'no_explicit', type: 'checkbox', label: 'Geen nummers met expliciete teksten', required: false, section: MUZIEK },

  { id: 'program', type: 'long_text', label: 'Programma en andere artiesten', required: false, section: PROGRAMMA, helpText: 'Diner, toespraken, optredens, pauzes. Dit helpt bij het bepalen van de speeltijden.' },
  { id: 'announcements', type: 'timed_list', label: 'Dingen die omgeroepen moeten worden', required: false, section: PROGRAMMA, helpText: 'Per regel een tijdstip en wat de DJ moet zeggen. Schrijf namen uit zoals ze uitgesproken worden.' },

  { id: 'media_objection', type: 'checkbox', label: 'Ik wil niet dat foto’s en video’s van de set voor promotie worden gebruikt', required: false, section: OVERIG },
  { id: 'notes', type: 'long_text', label: 'Overige opmerkingen', required: false, section: OVERIG },
]

const bruiloft: QuestionnaireField[] = [
  { id: 'couple_names', type: 'short_text', label: 'Namen van het bruidspaar', required: true, section: 'De bruiloft' },
  { id: 'ceremony', type: 'select', label: 'Verzorgt de DJ muziek bij de ceremonie?', required: true, section: 'De bruiloft', options: ['Ja', 'Nee'] },
  { id: 'ceremony_details', type: 'long_text', label: 'Wat is er nodig voor de ceremonie?', required: false, section: 'De bruiloft', helpText: 'Tijdstip, locatie en de muziek bij de entree, het jawoord en de uitgang.', showIf: { fieldId: 'ceremony', equals: 'Ja' } },
  { id: 'entrance', type: 'short_text', label: 'Entree van het bruidspaar: nummer', required: false, section: 'De bruiloft' },
  { id: 'opening_dance', type: 'short_text', label: 'Openingsdans: nummer en gewenst moment', required: false, section: 'De bruiloft' },
]

const bedrijfsfeest: QuestionnaireField[] = [
  { id: 'company_name', type: 'short_text', label: 'Bedrijfsnaam', required: true, section: 'Zakelijk' },
  { id: 'invoice_reference', type: 'short_text', label: 'Referentie of PO-nummer voor de factuur', required: false, section: 'Zakelijk' },
  { id: 'licence', type: 'select', label: 'Heeft de locatie een muziekrechtenlicentie (Buma/Stemra en Sena)?', required: true, section: 'Zakelijk', options: ['Ja', 'Nee', 'Weet ik niet'] },
  { id: 'licence_ack', type: 'acknowledgement', label: 'Ik regel en betaal de muziekrechten zelf, zoals in de voorwaarden staat.', required: true, section: 'Zakelijk', showIf: { fieldId: 'licence', equals: 'Nee' } },
]

const verjaardag: QuestionnaireField[] = [
  { id: 'celebrant', type: 'short_text', label: 'Wie wordt gevierd en hoe oud wordt diegene?', required: true, section: 'Het feestvarken' },
  { id: 'surprise', type: 'checkbox', label: 'Het is een verrassing', required: false, section: 'Het feestvarken' },
]

const fieldsByTemplate: Record<Exclude<BookingFormTemplateKey, 'standaard'>, QuestionnaireField[]> = {
  bruiloft: [...bruiloft, ...algemeen],
  bedrijfsfeest: [...bedrijfsfeest, ...algemeen],
  verjaardag: [...verjaardag, ...algemeen],
}

/** A fresh copy of the questions of a ready-made template. `standaard` is not here; it comes from Instellingen. */
export function bookingFormTemplateFields(key: Exclude<BookingFormTemplateKey, 'standaard'>): QuestionnaireField[] {
  return structuredClone(fieldsByTemplate[key])
}

export function isReadyMadeTemplate(key: string): key is Exclude<BookingFormTemplateKey, 'standaard'> {
  return key in fieldsByTemplate
}

/** The event type of a gig suggests the template, so the owner usually only has to confirm. */
export function suggestBookingFormTemplate(eventType: string | null | undefined): BookingFormTemplateKey {
  const value = (eventType || '').toLowerCase()
  if (value.includes('bruiloft') || value.includes('wedding')) return 'bruiloft'
  if (value.includes('bedrijf') || value.includes('zakelijk') || value.includes('corporate')) return 'bedrijfsfeest'
  if (value.includes('verjaardag') || value.includes('priv') || value.includes('jubileum')) return 'verjaardag'
  return 'standaard'
}
