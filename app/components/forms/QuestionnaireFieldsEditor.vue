<script setup lang="ts">
import { questionnaireFieldTypes } from '~~/shared/questionnaire'
import { conditionTypes, newEditableField, questionnaireTypeLabels, type EditableField } from '~/utils/questionnaire-editor'

const fields = defineModel<EditableField[]>({ required: true })

function addField() { fields.value.push(newEditableField()) }
function move(index: number, direction: number) {
  const target = index + direction
  if (target < 0 || target >= fields.value.length) return
  const [field] = fields.value.splice(index, 1)
  if (field) fields.value.splice(target, 0, field)
}
/** Questions this one can depend on: earlier ones with a small set of answers. */
function triggers(index: number) {
  return fields.value.slice(0, index).filter(field => conditionTypes.includes(field.type))
}
function trigger(field: EditableField) {
  return fields.value.find(other => other.id === field.showIfFieldId)
}
function triggerOptions(field: EditableField) {
  return trigger(field)?.optionsText.split('\n').map(item => item.trim()).filter(Boolean) ?? []
}
function triggerIsTick(field: EditableField) {
  const type = trigger(field)?.type
  return type === 'checkbox' || type === 'acknowledgement'
}
function pickTrigger(field: EditableField) {
  field.showIfEquals = triggerIsTick(field) ? 'true' : ''
}
</script>

<template>
  <div>
    <section class="field-list">
      <article v-for="(field, index) in fields" :key="field.id" class="card field-card">
        <div class="field-heading">
          <strong>Vraag {{ index + 1 }}<small v-if="field.section"> · {{ field.section }}</small></strong>
          <div>
            <button type="button" aria-label="Omhoog" title="Omhoog" @click="move(index, -1)"><Icon name="lucide:arrow-up" aria-hidden="true" /></button>
            <button type="button" aria-label="Omlaag" title="Omlaag" @click="move(index, 1)"><Icon name="lucide:arrow-down" aria-hidden="true" /></button>
            <button type="button" class="remove" @click="fields.splice(index, 1)">Verwijderen</button>
          </div>
        </div>
        <div class="grid">
          <label class="wide">Label<input v-model="field.label" required></label>
          <label>Soort veld
            <select v-model="field.type"><option v-for="type in questionnaireFieldTypes" :key="type" :value="type">{{ questionnaireTypeLabels[type] }}</option></select>
          </label>
          <label>Sectie <small>vragen met dezelfde sectie staan bij elkaar</small><input v-model="field.section" placeholder="Bijv. Locatie en techniek" maxlength="120"></label>
          <label class="wide">Hulptekst<input v-model="field.helpText"></label>
          <label v-if="field.type === 'select' || field.type === 'multi_select'" class="wide">Opties (één per regel)<textarea v-model="field.optionsText" rows="4" /></label>
          <label class="wide">Alleen tonen als…
            <select v-model="field.showIfFieldId" @change="pickTrigger(field)">
              <option value="">Altijd tonen</option>
              <option v-for="option in triggers(index)" :key="option.id" :value="option.id">{{ option.label }}</option>
            </select>
          </label>
          <label v-if="field.showIfFieldId && !triggerIsTick(field)" class="wide">Het antwoord is
            <select v-model="field.showIfEquals"><option value="">Kies…</option><option v-for="option in triggerOptions(field)" :key="option" :value="option">{{ option }}</option></select>
          </label>
          <label v-else-if="field.showIfFieldId" class="wide">Het vakje is
            <select v-model="field.showIfEquals"><option value="true">Aangevinkt</option><option value="false">Niet aangevinkt</option></select>
          </label>
          <details class="field-key"><summary>Technische sleutel</summary><label>Veld-ID <small>Alleen kleine letters, cijfers en _. Wijzig dit niet als er al antwoorden zijn.</small><input v-model="field.id" pattern="[a-z0-9_]+"></label></details>
          <label class="check"><input v-model="field.required" type="checkbox"> Verplicht</label>
        </div>
      </article>
    </section>
    <button type="button" class="add" @click="addField"><Icon name="lucide:plus" aria-hidden="true" /> Vraag toevoegen</button>
  </div>
</template>

<style scoped>
.card{margin-bottom:.8rem;padding:1.1rem;border:1px solid var(--border);border-radius:1rem;background:var(--surface-card)}
.field-heading{display:flex;justify-content:space-between;gap:1rem;margin-bottom:.8rem}.field-heading small{color:var(--text-subtle);font-weight:400}.field-heading div{display:flex;gap:.35rem}
.field-heading button,.add{border:1px solid #302a37;border-radius:.55rem;padding:.45rem .65rem;background:#19151f;color:#d8d2de;cursor:pointer}.field-heading .remove{color:#e5a0aa}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:.7rem}.wide{grid-column:1/-1}
label{display:grid;gap:.35rem;color:var(--text-muted);font-size:.78rem}label small{color:var(--text-subtle)}
input,select,textarea{width:100%;border:1px solid var(--border-strong);border-radius:.6rem;padding:.68rem;background:var(--surface-input);color:var(--text)}
.check{display:flex;align-items:center;gap:.5rem}.check input{width:auto}
.field-key{align-self:end;color:var(--text-muted);font-size:.8rem}.field-key summary{cursor:pointer;min-height:2.75rem;display:flex;align-items:center}
@media(max-width:680px){.grid{grid-template-columns:1fr}.wide{grid-column:auto}}
</style>
