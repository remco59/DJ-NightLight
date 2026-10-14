import type { OwnerNotificationKind } from '~~/shared/owner-notifications'
import { apiErrorMessage } from '~/utils/api-error'

export type BusinessSettings = {
  companyName: string
  address: string
  postalCode: string
  city: string
  country: string
  email: string
  phone: string
  registrationNumber: string
  vatNumber: string
  iban: string
  invoicePrefix: string
  nextInvoiceNumber: number
  defaultVatMode: 'exclusive' | 'inclusive' | 'exempt'
  defaultVatRateBasisPoints: number
  defaultPaymentTermDays: number
  paymentTerms: string
  legalText: string
  ownerNotificationEmail: string
  ownerNotificationKinds: OwnerNotificationKind[]
}

// Company, invoicing and notification settings are one record on the server; each
// settings page edits its own part and saves the whole record.
export function useBusinessSettingsForm(settings: Ref<{ settings: BusinessSettings } | null | undefined>, refresh: () => Promise<void>, successMessage: string) {
  if (!settings.value) throw createError({ statusCode: 500, statusMessage: 'Bedrijfsinstellingen niet beschikbaar' })
  const form = reactive({ ...settings.value.settings })
  const saving = ref(false)
  const message = ref('')
  const failed = ref(false)

  async function save() {
    saving.value = true
    message.value = ''
    failed.value = false
    try {
      await $fetch('/api/admin/business-settings', { method: 'PUT', body: form })
      await refresh()
      message.value = successMessage
    } catch (error: unknown) {
      failed.value = true
      message.value = apiErrorMessage(error, 'Instellingen opslaan is niet gelukt.')
    } finally {
      saving.value = false
    }
  }

  return { form, saving, message, failed, save }
}
