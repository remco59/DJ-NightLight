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
      detail: `NightLight kiest automatisch de beste optie voor jouw systeem.${data.value?.engine === 'auto' && active ? ` Nu actief: ${RENDER_ENGINE_LABELS[active]}.` : ''}`,
      available: true,
      icon: 'lucide:sparkles',
      badge: 'Aanbevolen',
    },
    {
      id: 'intel' as const,
      detail: intel?.detail || 'Snelle hardware-encoding met Intel VAAPI wanneer beschikbaar.',
      available: Boolean(intel?.available),
      icon: 'lucide:cpu',
      badge: intel?.available ? 'Beschikbaar' : 'Niet beschikbaar',
    },
    {
      id: 'cpu' as const,
      detail: 'Software-encoding. Werkt op alle systemen, maar is doorgaans langzamer.',
      available: true,
      icon: 'lucide:microchip',
      badge: 'Beschikbaar',
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
  <section id="rendering" class="rendering">
    <div class="section-card">
      <div class="head">
        <div class="title-wrap">
          <span class="section-icon"><Icon name="lucide:play" aria-hidden="true"/></span>
          <div>
            <h2>Video rendering</h2>
            <p>Kies hoe NightLight video’s rendert. Beschikbare hardware wordt automatisch gedetecteerd.</p>
          </div>
        </div>
        <div class="status-stack">
          <span class="pill" :class="{ on: data?.workerOnline }">
            <span class="dot"/>
            {{ data?.workerOnline ? 'Worker online' : 'Worker offline' }}
          </span>
          <small>Gecontroleerd {{ formatAge(data?.detectedAt ?? null) }}</small>
        </div>
      </div>

      <fieldset class="engines">
        <legend class="sr-only">Render-engine</legend>
        <label
          v-for="option in options"
          :key="option.id"
          class="engine"
          :class="{ disabled: !option.available, selected: engine === option.id }"
        >
          <input v-model="engine" type="radio" name="render-engine" :value="option.id" :disabled="!option.available">
          <span class="engine-icon"><Icon :name="option.icon" aria-hidden="true"/></span>
          <span class="engine-copy">
            <strong>{{ RENDER_ENGINE_LABELS[option.id] }}<template v-if="option.id === 'auto'"> (aanbevolen)</template></strong>
            <small>{{ option.detail }}</small>
          </span>
          <span class="availability" :class="{ good: option.available, accent: option.id === 'auto' }">{{ option.badge }}</span>
        </label>
      </fieldset>

      <div class="actions">
        <span :class="messageType">{{ message }}</span>
        <div>
          <button class="ghost" type="button" :disabled="pending" @click="refresh()">{{ pending ? 'Controleren…' : 'Vernieuwen' }}</button>
          <button type="button" :disabled="saving || engine === data?.engine" @click="save">{{ saving ? 'Opslaan…' : 'Wijzigingen opslaan' }}</button>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rendering{margin-top:1rem;scroll-margin-top:1rem}
.section-card{padding:1.15rem;border:1px solid #2b2631;border-radius:1rem;background:linear-gradient(180deg,#111016,#0f0d13)}
.head,.actions{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}
.title-wrap{display:flex;gap:.8rem;align-items:flex-start}
.section-icon{display:grid;place-items:center;flex:0 0 2.5rem;height:2.5rem;border-radius:.75rem;background:#241440;color:#b98cff}
.head h2{margin:0;font-size:1.15rem}
.head p{margin:.25rem 0 0;color:#8c8594;font-size:.82rem;line-height:1.45}
.status-stack{display:grid;justify-items:end;gap:.3rem;flex:none}
.status-stack small{color:#716a78;font-size:.7rem}
.pill{display:inline-flex;align-items:center;gap:.4rem;padding:.28rem .7rem;border-radius:99px;background:#2b2631;color:#aaa4b1;font-size:.72rem;font-weight:750}
.pill .dot{width:.42rem;height:.42rem;border-radius:50%;background:#8b8491}
.pill.on{background:#153426;color:#7be0a8}
.pill.on .dot{background:#48df89}
.engines{display:grid;gap:.65rem;margin:1rem 0 0;padding:0;border:0}
.engine{position:relative;display:grid;grid-template-columns:auto auto minmax(0,1fr) auto;gap:.75rem;align-items:center;padding:.9rem;border:1px solid #29242f;border-radius:.85rem;background:#0b0a0d;cursor:pointer;transition:border-color .2s ease,background .2s ease,transform .2s ease}
.engine:hover:not(.disabled){border-color:#473654;background:#100d14}
.engine.selected{border-color:#7849bc;background:linear-gradient(90deg,rgba(91,46,181,.13),#0b0a0d);box-shadow:inset 0 0 0 1px rgba(120,73,188,.25)}
.engine.disabled{cursor:not-allowed;opacity:.5}
.engine input{accent-color:#8f5af5}
.engine-icon{display:grid;place-items:center;width:2.2rem;height:2.2rem;border-radius:.65rem;background:#17131c;color:#c8b4dd}
.engine-copy{display:grid;gap:.22rem}
.engine-copy strong{font-size:.86rem;color:#f5f1f8}
.engine-copy small{color:#8c8594;font-size:.75rem;line-height:1.42;word-break:break-word}
.availability{padding:.28rem .6rem;border-radius:99px;background:#252129;color:#928a98;font-size:.68rem;font-weight:750;white-space:nowrap}
.availability.good{background:#143527;color:#6ee59f}
.availability.accent{background:#382064;color:#caa8ff}
.actions{align-items:center;margin-top:1rem}
.actions>div{display:flex;gap:.6rem}
.actions>span{color:#aaa4b1;font-size:.8rem}
.actions .success{color:#8ed6a3}
.actions .error{color:#ff9d9d}
button{border:0;border-radius:.7rem;padding:.7rem 1rem;background:linear-gradient(135deg,#7737f2,#5c25d9);color:#fff;font-weight:800;cursor:pointer}
button:disabled{cursor:not-allowed;opacity:.55}
button.ghost{border:1px solid #332e39;background:transparent;color:#f6f3fa}
.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:700px){
  .head,.actions{align-items:stretch;flex-direction:column}
  .status-stack{justify-items:start}
  .engine{grid-template-columns:auto auto minmax(0,1fr)}
  .availability{grid-column:2/-1;justify-self:start}
  .actions>div{display:grid}
  .actions button{width:100%}
}
</style>
