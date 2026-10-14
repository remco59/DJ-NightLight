<script setup lang="ts">
import { ownerNotificationKinds, ownerNotificationLabels, type OwnerNotificationKind } from '~~/shared/owner-notifications'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'admin' })
useSeoMeta({ title: 'Meldingen — DJ NightLight', robots: 'noindex, nofollow' })

const { data, refresh } = await useFetch<{ settings: BusinessSettings }>('/api/admin/business-settings')
const { form, saving, message, failed, save } = useBusinessSettingsForm(data, async () => { await refresh() }, 'Meldingen opgeslagen.')

const testSending = ref(false)
const testMessage = ref('')
const testFailed = ref(false)

function toggleNotification(kind: OwnerNotificationKind, on: boolean) {
  form.ownerNotificationKinds = on ? [...new Set([...form.ownerNotificationKinds, kind])] : form.ownerNotificationKinds.filter(item => item !== kind)
}

async function sendTestNotification() {
  testSending.value = true
  testMessage.value = ''
  testFailed.value = false
  try {
    const result = await $fetch<{ recipient: string }>('/api/admin/business-settings/test-notification', { method: 'POST', body: { kind: form.ownerNotificationKinds[0] || 'new_inquiry' } })
    testMessage.value = `Testmelding verstuurd naar ${result.recipient}.`
  } catch (error: unknown) {
    testFailed.value = true
    testMessage.value = apiErrorMessage(error, 'Testmelding versturen is niet gelukt.')
  } finally {
    testSending.value = false
  }
}
</script>

<template>
  <AdminSettingsForm title="Meldingen" description="Laat je per e-mail weten wanneer er iets gebeurt, zodat je niet steeds het dashboard hoeft te openen." icon="lucide:bell" :saving="saving" :message="message" :failed="failed" @save="save">
    <label class="wide">E-mailadres voor meldingen<input v-model="form.ownerNotificationEmail" type="email" autocomplete="email" placeholder="jij@example.com"><small>Laat leeg om geen meldingen te ontvangen.</small></label>
    <template #extra>
      <fieldset class="notification-kinds" :disabled="!form.ownerNotificationEmail">
        <legend>Waarover wil je een melding?</legend>
        <label v-for="kind in ownerNotificationKinds" :key="kind" class="notification-kind">
          <input type="checkbox" :checked="form.ownerNotificationKinds.includes(kind)" @change="toggleNotification(kind, ($event.target as HTMLInputElement).checked)">
          <span><strong>{{ ownerNotificationLabels[kind].label }}</strong><small>{{ ownerNotificationLabels[kind].description }}</small></span>
        </label>
      </fieldset>
      <p v-if="testMessage" class="test-result" :class="{ error: testFailed }" role="status">{{ testMessage }}</p>
    </template>
    <template #actions>
      <button type="button" class="outline" :disabled="testSending || !data?.settings.ownerNotificationEmail || form.ownerNotificationEmail !== data?.settings.ownerNotificationEmail" @click="sendTestNotification">{{ testSending ? 'Versturen…' : 'Testmelding versturen' }}</button>
    </template>
  </AdminSettingsForm>
</template>

<style scoped>
.notification-kinds{display:grid;gap:.4rem;margin:1.1rem 0 0;padding:0;border:0}
.notification-kinds legend{margin-bottom:.4rem;padding:0;font-weight:700}
.notification-kinds:disabled{opacity:.5}
.notification-kind{display:flex;align-items:flex-start;gap:.7rem;padding:.65rem .75rem;border:1px solid var(--border);border-radius:.7rem;color:var(--text-muted);font-size:.75rem;cursor:pointer}
.notification-kind input{width:auto;margin-top:.2rem}
.notification-kind span{display:grid;gap:.1rem}
.notification-kind small{color:var(--text-subtle)}
.test-result{margin:.8rem 0 0;color:var(--text-muted);font-size:.78rem}
.test-result.error{color:#ff9d9d}
button.outline{border:1px solid var(--border-strong);background:transparent;color:var(--text)}
</style>
