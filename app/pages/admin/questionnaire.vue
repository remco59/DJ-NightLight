<script setup lang="ts">
import type { QuestionnaireField, QuestionnaireFieldType } from '~~/shared/questionnaire'
import { questionnaireFieldTypes } from '~~/shared/questionnaire'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'admin' })
type EditableField = QuestionnaireField & { optionsText: string }
type TemplateResponse = { template: { name: string, version: number, fields: QuestionnaireField[], createdAt: string } }
const { data, refresh } = await useFetch<TemplateResponse>('/api/admin/questionnaire')
if (!data.value) throw createError({ statusCode: 404, statusMessage: 'Questionnaire not found' })
const name = ref(data.value.template.name)
const fields = ref<EditableField[]>(data.value.template.fields.map(field => ({ ...field, helpText: field.helpText || '', optionsText: (field.options || []).join('\n') })))
const saving = ref(false)
const message = ref('')
const typeLabels: Record<QuestionnaireFieldType, string> = {
  short_text: 'Short text', long_text: 'Long text', email: 'Email', phone: 'Phone', number: 'Number', date: 'Date', time: 'Time', select: 'Select', multi_select: 'Multi-select', checkbox: 'Checkbox', acknowledgement: 'Acknowledgement / terms', url: 'URL',
}

function addField() {
  fields.value.push({ id: `field_${Date.now()}`, type: 'short_text', label: 'New question', helpText: '', required: false, optionsText: '' })
}
function move(index: number, direction: number) {
  const target = index + direction
  if (target < 0 || target >= fields.value.length) return
  const [field] = fields.value.splice(index, 1)
  if (field) fields.value.splice(target, 0, field)
}
async function save() {
  saving.value = true; message.value = ''
  try {
    await $fetch('/api/admin/questionnaire', { method: 'PUT', body: {
      name: name.value,
      fields: fields.value.map(({ optionsText, ...field }) => ({
        ...field,
        helpText: field.helpText || undefined,
        options: field.type === 'select' || field.type === 'multi_select' ? optionsText.split('\n').map(item => item.trim()).filter(Boolean) : undefined,
      })),
    } })
    await refresh()
    message.value = `Version ${data.value?.template.version || ''} saved. Existing submissions keep their original version.`
  } catch (error: unknown) { message.value = apiErrorMessage(error, 'Could not save questionnaire.') } finally { saving.value = false }
}
useSeoMeta({ title: 'Client portal — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="editor">
    <header class="page-header"><div><p class="eyebrow">Client portal</p><h1>Questionnaire</h1><p>Every save creates a new immutable version. Submitted gigs keep the exact questions they received.</p></div><button class="primary" :disabled="saving" @click="save">{{ saving ? 'Saving…' : 'Save new version' }}</button></header>
    <section class="card meta"><label>Template name<input v-model="name"></label><span>Current version {{ data?.template.version }}</span></section>
    <section class="field-list">
      <article v-for="(field,index) in fields" :key="field.id" class="card field-card">
        <div class="field-heading"><strong>Question {{ index + 1 }}</strong><div><button @click="move(index,-1)">↑</button><button @click="move(index,1)">↓</button><button class="remove" @click="fields.splice(index,1)">Remove</button></div></div>
        <div class="grid"><label class="wide">Label<input v-model="field.label" required></label><label>Field type<select v-model="field.type"><option v-for="type in questionnaireFieldTypes" :key="type" :value="type">{{ typeLabels[type] }}</option></select></label><label>Stable field id<input v-model="field.id" pattern="[a-z0-9_]+"></label><label class="wide">Help text<input v-model="field.helpText"></label><label v-if="field.type==='select'||field.type==='multi_select'" class="wide">Options (one per line)<textarea v-model="field.optionsText" rows="4"/></label><label class="check"><input v-model="field.required" type="checkbox"> Required</label></div>
      </article>
    </section>
    <button class="add" @click="addField">+ Add question</button><p v-if="message" class="message">{{ message }}</p>
  </div>
</template>

<style scoped>
.editor{max-width:980px;margin-inline:auto}.page-header{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1.5rem}.page-header h1{margin:.2rem 0;font-size:clamp(2.5rem,6vw,4.6rem);letter-spacing:-.05em}.page-header p:last-child{max-width:640px;margin:0;color:#8b8493}.card{margin-bottom:.8rem;padding:1.1rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}.meta{display:flex;align-items:end;justify-content:space-between;gap:1rem}.meta label{flex:1}.meta span{color:#847d8c;font-size:.8rem}.field-heading{display:flex;justify-content:space-between;gap:1rem;margin-bottom:.8rem}.field-heading div{display:flex;gap:.35rem}.field-heading button,.add{border:1px solid #302a37;border-radius:.55rem;padding:.45rem .65rem;background:#19151f;color:#d8d2de;cursor:pointer}.field-heading .remove{color:#e5a0aa}.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.7rem}.wide{grid-column:1/-1}label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.78rem}input,select,textarea{width:100%;border:1px solid #332e39;border-radius:.6rem;padding:.68rem;background:#0b0a0d;color:#f6f3fa}.check{display:flex;align-items:center;gap:.5rem}.check input{width:auto}.primary{border:0;border-radius:.7rem;padding:.75rem 1rem;background:#fff;color:#09080b;font-weight:800;cursor:pointer}.message{color:#a49dab}@media(max-width:680px){.page-header,.meta{align-items:stretch;flex-direction:column}.grid{grid-template-columns:1fr}.wide{grid-column:auto}.primary{width:100%}}
</style>
