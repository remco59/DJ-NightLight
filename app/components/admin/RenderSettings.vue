<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import {
  RENDER_ENGINE_LABELS,
  type RenderEngine,
  type RenderEngineCapability,
  type RenderEngineSetting,
} from '~~/shared/render-engine'

type RenderSettingsData = {
  engine: RenderEngineSetting
  activeEngine: RenderEngine | null
  capabilities: RenderEngineCapability[]
  detectedAt: string | null
  heartbeatAt: string | null
  workerOnline: boolean
}

const { data, refresh, pending } = await useFetch<RenderSettingsData>('/api/admin/render-settings')

const engine = ref<RenderEngineSetting>('auto')
const saving = ref(false)
const message = ref('')
const messageType = ref<'success' | 'error' | ''>('')

watchEffect(() => {
  if (data.value) engine.value = data.value.engine
})

function capability(id: RenderEngine) {
  return data.value?.capabilities.find(item => item.id === id)
}

const options = computed(() => {
  const intel = capability('intel')
  const active = data.value?.activeEngine
  return [
    {
      id: 'auto' as const,
      detail: `Gebruikt de Intel GPU als die beschikbaar is, anders de CPU.${data.value?.engine === 'auto' && active ? ` Nu: ${RENDER_ENGINE_LABELS[active]}.` : ''}`,
      available: true,
    },
    { id: 'cpu' as const, detail: 'Software-encoding. Altijd beschikbaar.', available: true },
    {
      id: 'intel' as const,
      detail: intel?.detail || 'Nog niet gedetecteerd. Start de renderworker om te controleren of er een Intel GPU is.',
      available: Boolean(intel?.available),
    },
  ]
})

function formatAge(value: string | null) {
  if (!value) return 'nooit'
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000))
  if (seconds < 90) return `${seconds} s geleden`
  const minutes = Math.round(seconds / 60)
  if (minutes < 90) return `${minutes} min geleden`
  return new Date(value).toLocaleString('nl-NL')
}

async function save() {
  saving.value = true
  message.value = ''
  messageType.value = ''
  try {
    await $fetch('/api/admin/render-settings', { method: 'PUT', body: { engine: engine.value } })
    await refresh()
    message.value = 'Renderinstelling opgeslagen. Die geldt vanaf de volgende export.'
    messageType.value = 'success'
  } catch (error: unknown) {
    message.value = apiErrorMessage(error, 'Renderinstelling opslaan is niet gelukt.')
    messageType.value = 'error'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <section id="rendering" class="card rendering">
    <div class="head">
      <div>
        <p class="eyebrow">Video-exports</p>
        <h2>Video renderen</h2>
        <p>Kies hoe de renderworker geëxporteerde video’s codeert. Beschikbare hardware wordt automatisch gedetecteerd.</p>
      </div>
      <div class="status-stack">
        <span class="pill" :class="{ on: data?.workerOnline }">{{ data?.workerOnline ? 'Worker online' : 'Worker offline' }}</span>
        <small>Hardware gecontroleerd {{ formatAge(data?.detectedAt ?? null) }}</small>
      </div>
    </div>

    <fieldset class="engines">
      <legend class="sr-only">Render-engine</legend>
      <label v-for="option in options" :key="option.id" class="engine" :class="{ disabled: !option.available, selected: engine === option.id }">
        <input v-model="engine" type="radio" name="render-engine" :value="option.id" :disabled="!option.available">
        <span>
          <strong>{{ RENDER_ENGINE_LABELS[option.id] }}<template v-if="option.id === 'auto'"> (aanbevolen)</template></strong>
          <small>{{ option.detail }}</small>
        </span>
      </label>
    </fieldset>

    <div class="actions">
      <span :class="messageType">{{ message }}</span>
      <div>
        <button class="ghost" type="button" :disabled="pending" @click="refresh()">{{ pending ? 'Controleren…' : 'Vernieuwen' }}</button>
        <button type="button" :disabled="saving || engine === data?.engine" @click="save">{{ saving ? 'Opslaan…' : 'Renderinstelling opslaan' }}</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rendering{margin-top:1.5rem;padding:1.2rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14;scroll-margin-top:1rem}
.head,.actions{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}
.head h2{margin:.15rem 0 .3rem}
.head p:last-child{margin:0;color:#8c8594;font-size:.85rem;line-height:1.5}
.status-stack{display:grid;justify-items:end;gap:.3rem;flex:none}
.status-stack small{color:#716a78;font-size:.72rem}
.pill{padding:.25rem .7rem;border-radius:99px;background:#2b2631;color:#aaa4b1;font-size:.75rem;font-weight:700}
.pill.on{background:#16382a;color:#7be0a8}
.engines{display:grid;gap:.6rem;margin:1rem 0 0;padding:0;border:0}
.engine{display:flex;gap:.75rem;align-items:flex-start;padding:.85rem;border:1px solid #29242f;border-radius:.8rem;background:#0b0a0d;cursor:pointer}
.engine.selected{border-color:#6f5a86}
.engine.disabled{cursor:not-allowed;opacity:.55}
.engine input{margin-top:.2rem}
.engine span{display:grid;gap:.25rem}
.engine small{color:#8c8594;font-size:.78rem;line-height:1.45;word-break:break-word}
.actions{align-items:center;margin-top:1rem}
.actions>div{display:flex;gap:.6rem}
.actions span{color:#aaa4b1;font-size:.85rem}
.actions .success{color:#8ed6a3}
.actions .error{color:#ff9d9d}
button{border:0;border-radius:.7rem;padding:.7rem 1rem;background:#fff;color:#09080b;font-weight:800;cursor:pointer}
button:disabled{cursor:not-allowed;opacity:.55}
button.ghost{border:1px solid #332e39;background:transparent;color:#f6f3fa}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:650px){
  .head,.actions{align-items:stretch;flex-direction:column}
  .status-stack{justify-items:start}
  .actions>div{flex-direction:column}
  .actions button{width:100%}
}
</style>
