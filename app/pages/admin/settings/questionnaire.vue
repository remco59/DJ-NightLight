<script setup lang="ts">
import type { QuestionnaireField } from '~~/shared/questionnaire'
import { apiErrorMessage } from '~/utils/api-error'
import { fromEditable, toEditable } from '~/utils/questionnaire-editor'

definePageMeta({ layout: 'admin' })
type TemplateResponse = { template: { name: string, version: number, fields: QuestionnaireField[], createdAt: string } }
const { data, refresh } = await useFetch<TemplateResponse>('/api/admin/questionnaire')
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Vragenlijst niet gevonden' })
const name = ref(data.value.template.name)
const fields = ref(toEditable(data.value.template.fields))
const saving = ref(false)
const message = ref('')
const { isDirty, markSaved } = useUnsavedChanges(() => ({ name: name.value, fields: fields.value }))
async function save() {
  saving.value = true; message.value = ''
  try {
    await $fetch('/api/admin/questionnaire', { method: 'PUT', body: {
      name: name.value,
      fields: fromEditable(fields.value),
    } })
    markSaved()
    await refresh()
    message.value = `Versie ${data.value?.template.version || ''} opgeslagen. Bestaande inzendingen houden hun oorspronkelijke versie.`
  } catch (error: unknown) { message.value = apiErrorMessage(error, 'Vragenlijst opslaan is niet gelukt.') } finally { saving.value = false }
}
useSeoMeta({ title: 'Klantportaal — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="editor">
    <header class="page-header"><div><h2>Vragenlijst</h2><p>Elke keer opslaan maakt een nieuwe, vaste versie. Ingediende gigs houden precies de vragen die ze kregen.</p></div><div class="save-state"><span v-if="isDirty" class="dirty-note" role="status">Niet-opgeslagen wijzigingen</span><button class="primary" :disabled="saving||!isDirty" @click="save">{{ saving ? 'Opslaan…' : 'Nieuwe versie opslaan' }}</button></div></header>
    <section class="card meta"><label>Naam template<input v-model="name"></label><span>Huidige versie {{ data?.template.version }}</span></section>
    <FormsQuestionnaireFieldsEditor v-model="fields" />
    <p v-if="message" class="message">{{ message }}</p>
  </div>
</template>

<style scoped>
.field-key{align-self:end;color:var(--text-muted);font-size:.8rem}.field-key summary{cursor:pointer;min-height:2.75rem;display:flex;align-items:center}.field-key small{display:block;color:var(--text-subtle)}.save-state{display:flex;flex-wrap:wrap;align-items:center;gap:.75rem}.dirty-note{color:#f2cf8a;font-size:.82rem}
.editor{max-width:980px;margin-inline:auto}.page-header{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1.5rem}.page-header h2{margin:.2rem 0;font-size:clamp(1.5rem,3vw,2rem);letter-spacing:-.04em}.page-header p:last-child{max-width:640px;margin:0;color:#8b8493}.card{margin-bottom:.8rem;padding:1.1rem;border:1px solid var(--border);border-radius:1rem;background:var(--surface-card)}.meta{display:flex;align-items:end;justify-content:space-between;gap:1rem}.meta label{flex:1}.meta span{color:#847d8c;font-size:.8rem}.field-heading{display:flex;justify-content:space-between;gap:1rem;margin-bottom:.8rem}.field-heading div{display:flex;gap:.35rem}.field-heading button,.add{border:1px solid #302a37;border-radius:.55rem;padding:.45rem .65rem;background:#19151f;color:#d8d2de;cursor:pointer}.field-heading .remove{color:#e5a0aa}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.7rem}.wide{grid-column:1/-1}label{display:grid;gap:.35rem;color:var(--text-muted);font-size:.78rem}input,select,textarea{width:100%;border:1px solid var(--border-strong);border-radius:.6rem;padding:.68rem;background:var(--surface-input);color:var(--text)}.check{display:flex;align-items:center;gap:.5rem}.check input{width:auto}.primary{border:0;border-radius:.7rem;padding:.75rem 1rem;background:var(--button-primary-bg);color:var(--button-primary-fg);font-weight:800;cursor:pointer}.message{color:#a49dab}@media(max-width:680px){.page-header,.meta{align-items:stretch;flex-direction:column}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.primary{width:100%}}
</style>
