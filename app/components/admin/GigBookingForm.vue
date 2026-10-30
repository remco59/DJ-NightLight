<script setup lang="ts">
import type { QuestionnaireField } from '~~/shared/questionnaire'
import { apiErrorMessage } from '~/utils/api-error'
import { fromEditable, toEditable } from '~/utils/questionnaire-editor'

type TemplateKey = 'standaard' | 'bruiloft' | 'bedrijfsfeest' | 'verjaardag'
type FormData = {
  enabled: boolean
  templateKey: string | null
  fields: QuestionnaireField[]
  suggested: TemplateKey
  templates: Array<{ key: TemplateKey, label: string, description: string }>
}

const props = defineProps<{ gigId: string }>()
const emit = defineEmits<{ changed: [] }>()
const confirmAction = useConfirm()
const { data, refresh } = await useFetch<FormData>(`/api/admin/gigs/${props.gigId}/booking-form`)

const template = ref<TemplateKey>(data.value?.suggested ?? 'standaard')
const fields = ref(toEditable(data.value?.fields ?? []))
const showEditor = ref(false)
const busy = ref(false)
const message = ref('')
const dirty = ref(false)
watch(fields, () => { if (showEditor.value) dirty.value = true }, { deep: true })

const templateLabel = computed(() => data.value?.templates.find(item => item.key === data.value?.templateKey)?.label ?? (data.value?.templateKey === 'aangepast' ? 'Aangepast' : null))

async function reload() {
  await refresh()
  fields.value = toEditable(data.value?.fields ?? [])
  dirty.value = false
  emit('changed')
}

async function toggle(enabled: boolean) {
  busy.value = true; message.value = ''
  try {
    await $fetch(`/api/admin/gigs/${props.gigId}/booking-form`, { method: 'PUT', body: { enabled, ...(enabled && !data.value?.templateKey ? { template: template.value } : {}) } })
    await reload()
    message.value = enabled ? 'Het formulier staat aan. De klant ziet het in het klantportaal.' : 'Het formulier staat uit. Vragen en antwoorden blijven bewaard.'
  }
  catch (error: unknown) { message.value = apiErrorMessage(error, 'Wijzigen is niet gelukt.') }
  finally { busy.value = false }
}

async function applyTemplate() {
  if (data.value?.templateKey && !(await confirmAction({ title: 'Vragen vervangen door een template?', body: 'De vragen van deze gig worden vervangen. Bestaande antwoorden van de klant blijven bewaard, maar worden alleen getoond bij vragen met hetzelfde ID.', confirmLabel: 'Vervangen' }))) return
  busy.value = true; message.value = ''
  try {
    await $fetch(`/api/admin/gigs/${props.gigId}/booking-form`, { method: 'PUT', body: { template: template.value } })
    await reload()
    message.value = 'Template toegepast.'
  }
  catch (error: unknown) { message.value = apiErrorMessage(error, 'Template toepassen is niet gelukt.') }
  finally { busy.value = false }
}

async function saveFields() {
  busy.value = true; message.value = ''
  try {
    await $fetch(`/api/admin/gigs/${props.gigId}/booking-form/fields`, { method: 'PUT', body: { fields: fromEditable(fields.value) } })
    await reload()
    message.value = 'Vragen opgeslagen voor deze gig.'
  }
  catch (error: unknown) { message.value = apiErrorMessage(error, 'Opslaan is niet gelukt.') }
  finally { busy.value = false }
}
</script>

<template>
  <section class="card booking-form-card">
    <header class="card-head"><Icon name="lucide:clipboard-list" class="lead-icon" aria-hidden="true" /><h2>Boekingsformulier</h2></header>
    <p class="note">Een vragenlijst voor de klant in het klantportaal. Staat standaard uit en is geen voorwaarde voor de boeking.</p>

    <label class="switch">
      <input type="checkbox" :checked="data?.enabled" :disabled="busy" @change="toggle(($event.target as HTMLInputElement).checked)">
      <span>{{ data?.enabled ? 'Aan voor deze gig' : 'Uit voor deze gig' }}</span>
    </label>

    <template v-if="!data?.templateKey">
      <label class="field">Template om mee te starten
        <select v-model="template"><option v-for="item in data?.templates" :key="item.key" :value="item.key">{{ item.label }}{{ item.key === data?.suggested ? ' (past bij dit type feest)' : '' }}</option></select>
      </label>
      <p class="note">{{ data?.templates.find(item => item.key === template)?.description }} Zet je het formulier aan, dan worden deze vragen naar de gig gekopieerd en kun je ze daarna aanpassen.</p>
    </template>

    <template v-else>
      <p class="note">Gebaseerd op: <strong>{{ templateLabel }}</strong> · {{ data.fields.length }} vragen. Wijzigingen gelden alleen voor deze gig.</p>
      <div class="actions">
        <button type="button" class="secondary" @click="showEditor = !showEditor">{{ showEditor ? 'Vragen verbergen' : 'Vragen aanpassen' }}</button>
        <label class="field inline">Opnieuw starten met
          <select v-model="template"><option v-for="item in data.templates" :key="item.key" :value="item.key">{{ item.label }}</option></select>
        </label>
        <button type="button" class="ghost" :disabled="busy" @click="applyTemplate">Toepassen</button>
      </div>
      <div v-if="showEditor" class="editor">
        <FormsQuestionnaireFieldsEditor v-model="fields" />
        <div class="actions"><button type="button" class="primary" :disabled="busy || !dirty" @click="saveFields">{{ busy ? 'Opslaan…' : 'Vragen opslaan' }}</button></div>
      </div>
    </template>
    <p v-if="message" class="note" role="status">{{ message }}</p>
  </section>
</template>

<style scoped>
.card{padding:1rem 1.1rem;border:1px solid var(--border);border-radius:1rem;background:var(--surface-card)}
.card-head{display:flex;align-items:center;gap:.7rem;margin:0 0 .7rem}.card-head h2{margin:0;font-size:1.05rem}
.note{margin:.3rem 0 .8rem;color:var(--text-subtle);font-size:.88rem;line-height:1.5}
.switch{display:flex;align-items:center;gap:.7rem;min-height:2.75rem;margin-bottom:.6rem;color:var(--text);font-weight:650}.switch input{width:1.2rem;height:1.2rem}
.field{display:grid;gap:.35rem;margin-bottom:.6rem;color:var(--text-muted);font-size:.78rem}.field.inline{margin:0}
select{width:100%;min-height:2.75rem;border:1px solid var(--border-strong);border-radius:.6rem;padding:.6rem;background:var(--surface-input);color:var(--text)}
.actions{display:flex;flex-wrap:wrap;gap:.6rem;align-items:end;margin:.4rem 0 .8rem}
.primary,.secondary,.ghost{min-height:2.75rem;padding:.6rem 1rem;border-radius:.7rem;font:inherit;font-weight:700;cursor:pointer}
.primary{border:0;background:var(--button-primary-bg);color:var(--button-primary-fg)}.secondary{border:0;background:var(--button-secondary-bg);color:var(--button-secondary-fg)}.ghost{border:1px solid var(--border-strong);background:transparent;color:var(--text)}
button:disabled{opacity:.5;cursor:not-allowed}
</style>
