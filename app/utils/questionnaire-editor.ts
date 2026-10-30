import type { QuestionnaireField, QuestionnaireFieldType } from '~~/shared/questionnaire'

/** A question as the editor handles it: options as one text per line, and an empty condition as an empty string. */
export type EditableField = Omit<QuestionnaireField, 'showIf' | 'section' | 'helpText'> & {
  helpText: string
  section: string
  optionsText: string
  /** Id of the earlier question this one depends on; empty for "always show". */
  showIfFieldId: string
  /** The answer that shows the question: an option, or `true`/`false` for a tick box. */
  showIfEquals: string
}

export const questionnaireTypeLabels: Record<QuestionnaireFieldType, string> = {
  short_text: 'Korte tekst', long_text: 'Lange tekst', email: 'E-mail', phone: 'Telefoon', number: 'Getal', date: 'Datum', time: 'Tijd',
  select: 'Keuzelijst', multi_select: 'Meerkeuze', checkbox: 'Selectievakje', acknowledgement: 'Akkoord / voorwaarden', url: 'URL', timed_list: 'Lijst met tijdstip en tekst',
}

/** Field types a condition can look at: they have a small set of possible answers. */
export const conditionTypes: readonly QuestionnaireFieldType[] = ['select', 'multi_select', 'checkbox', 'acknowledgement']

export function toEditable(fields: QuestionnaireField[]): EditableField[] {
  return fields.map(field => ({
    id: field.id,
    type: field.type,
    label: field.label,
    required: field.required,
    helpText: field.helpText || '',
    section: field.section || '',
    optionsText: (field.options || []).join('\n'),
    showIfFieldId: field.showIf?.fieldId || '',
    showIfEquals: field.showIf ? String(field.showIf.equals) : '',
  }))
}

export function fromEditable(fields: EditableField[]): QuestionnaireField[] {
  return fields.map((field) => {
    const trigger = fields.find(other => other.id === field.showIfFieldId)
    const triggerIsTick = trigger?.type === 'checkbox' || trigger?.type === 'acknowledgement'
    return {
      id: field.id,
      type: field.type,
      label: field.label,
      required: field.required,
      helpText: field.helpText.trim() || undefined,
      section: field.section.trim() || undefined,
      options: field.type === 'select' || field.type === 'multi_select' ? field.optionsText.split('\n').map(item => item.trim()).filter(Boolean) : undefined,
      showIf: field.showIfFieldId && (triggerIsTick || field.showIfEquals)
        ? { fieldId: field.showIfFieldId, equals: triggerIsTick ? field.showIfEquals !== 'false' : field.showIfEquals }
        : undefined,
    }
  })
}

export function newEditableField(): EditableField {
  return { id: `field_${Date.now().toString(36)}`, type: 'short_text', label: 'Nieuwe vraag', helpText: '', section: '', required: false, optionsText: '', showIfFieldId: '', showIfEquals: '' }
}
