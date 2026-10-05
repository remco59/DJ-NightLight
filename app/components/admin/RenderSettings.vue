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
      detail: `NightLight kiest automatisch de beste renderer voor jouw server.${data.value?.engine === 'auto' && active ? ` Nu actief: ${RENDER_ENGINE_LABELS[active]}.` : ''}`,
      available: true,
      icon: 'lucide:zap',
      badge: 'Aanbevolen',
      benefits: ['Snelste beschikbare optie', 'Gebruikt GPU als die beschikbaar is', 'Beste balans tussen snelheid en stabiliteit'],
    },
    {
      id: 'intel' as const,
      detail: intel?.detail || 'Gebruik de Intel GPU voor snelle hardware-encoding.',
      available: Boolean(intel?.available),
      icon: 'lucide:cpu',
      badge: intel?.available ? 'Snel' : 'Niet beschikbaar',
      benefits: ['Snelle rendering', 'Lage CPU-belasting', 'Alleen beschikbaar met Intel GPU'],
    },
    {
      id: 'cpu' as const,
      detail: 'Software-encoding. Werkt vrijwel overal, maar is doorgaans langzamer.',
      available: true,
      icon: 'lucide:microchip',
      badge: 'Compatibel',
      benefits: ['Werkt altijd', 'Geen extra hardware nodig', 'Geschikt voor eenvoudige renders'],
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
    <div class="head">
      <div class="title-wrap">
        <span class="section-icon"><Icon name="lucide:clapperboard" aria-hidden="true"/></span>
        <div>
          <h2>Video rendering</h2>
          <p>Kies hoe NightLight video’s rendert. Je keuze heeft invloed op snelheid en compatibiliteit.</p>
        </div>
      </div>
      <div class="status-stack">
        <span class="pill" :class="{ on: data?.workerOnline }"><span class="dot"/>{{ data?.workerOnline ? 'Renderer beschikbaar' : 'Renderer offline' }}</span>
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
        <span class="choice-dot"/>
        <span class="engine-icon"><Icon :name="option.icon" aria-hidden="true"/></span>
        <span class="badge" :class="{accent:option.id==='auto',good:option.id==='intel'&&option.available}">{{option.badge}}</span>
        <span class="engine-copy">
          <strong>{{ RENDER_ENGINE_LABELS[option.id] }}<template v-if="option.id === 'auto'"> (aanbevolen)</template></strong>
          <small>{{ option.detail }}</small>
        </span>
        <ul>
          <li v-for="benefit in option.benefits" :key="benefit"><Icon name="lucide:circle-check"/>{{benefit}}</li>
        </ul>
      </label>
    </fieldset>

    <details class="advanced">
      <summary><span><Icon name="lucide:settings"/>Geavanceerde instellingen</span><Icon name="lucide:chevron-down"/></summary>
      <div class="advanced-body">
        <p>NightLight detecteert beschikbare renderhardware automatisch. Gebruik <strong>Automatisch</strong> tenzij je bewust een specifieke renderer wilt afdwingen.</p>
        <button class="ghost" type="button" :disabled="pending" @click="refresh()">{{ pending ? 'Controleren…' : 'Hardware opnieuw detecteren' }}</button>
      </div>
    </details>

    <div class="actions">
      <span :class="messageType">{{ message }}</span>
      <button type="button" :disabled="saving || engine === data?.engine" @click="save">{{ saving ? 'Opslaan…' : 'Wijzigingen opslaan' }}</button>
    </div>
  </section>
</template>

<style scoped>
.rendering{scroll-margin-top:1rem}.head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;margin-bottom:1rem}.title-wrap{display:flex;gap:.8rem;align-items:flex-start}.section-icon{display:grid;place-items:center;flex:0 0 2.55rem;height:2.55rem;border-radius:.75rem;background:#28164a;color:#bd91ff}.head h2{margin:0;font-size:1.3rem}.head p{max-width:650px;margin:.25rem 0 0;color:var(--text-subtle);font-size:.8rem;line-height:1.45}.status-stack{display:grid;justify-items:end;gap:.3rem;flex:none}.status-stack small{color:var(--text-subtle);font-size:.67rem}.pill{display:inline-flex;align-items:center;gap:.4rem;padding:.28rem .7rem;border-radius:99px;background:#252129;color:#928a98;font-size:.7rem;font-weight:800}.pill .dot{width:.42rem;height:.42rem;border-radius:50%;background:#8b8491}.pill.on{background:#143527;color:#6ee59f}.pill.on .dot{background:#48df89}
.engines{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:.8rem;margin:0;padding:0;border:0}.engine{position:relative;display:flex;min-height:265px;flex-direction:column;align-items:flex-start;gap:.7rem;padding:1rem;border:1px solid var(--border);border-radius:1rem;background:linear-gradient(180deg,#121017,#0e0c12);cursor:pointer;transition:.18s ease}.engine:hover:not(.disabled){border-color:#5b3a80;transform:translateY(-1px)}.engine.selected{border-color:#8c46f3;background:linear-gradient(180deg,rgba(92,37,217,.18),#0f0d13);box-shadow:inset 0 0 0 1px rgba(140,70,243,.38),0 10px 35px rgba(80,32,160,.12)}.engine.disabled{cursor:not-allowed;opacity:.45}.engine input{position:absolute;opacity:0;pointer-events:none}.choice-dot{position:absolute;right:.9rem;top:.9rem;width:.9rem;height:.9rem;border:1px solid #81758a;border-radius:50%}.engine.selected .choice-dot{border:4px solid #8d49f4;background:#fff}.engine-icon{display:grid;place-items:center;width:2.8rem;height:2.8rem;margin-top:.2rem;border-radius:.75rem;background:#17131c;color:#d5c2e9;font-size:1.5rem}.engine.selected .engine-icon{background:#3d1a71;color:#b777ff}.badge{position:absolute;right:2.2rem;top:.82rem;padding:.25rem .55rem;border-radius:99px;background:#252129;color:#aaa0b0;font-size:.62rem;font-weight:850}.badge.accent{background:#5f25cf;color:#fff}.badge.good{background:#153426;color:#72e6a2}.engine-copy{display:grid;gap:.35rem}.engine-copy strong{font-size:.92rem;color:#f5f1f8}.engine-copy small{color:var(--text-subtle);font-size:.73rem;line-height:1.45}.engine ul{display:grid;gap:.45rem;margin:.1rem 0 0;padding:0;list-style:none}.engine li{display:flex;align-items:flex-start;gap:.45rem;color:#beb4c5;font-size:.69rem;line-height:1.35}.engine li svg{flex:none;margin-top:.04rem;color:#56df91}
.advanced{margin-top:.85rem;border:1px solid var(--border);border-radius:.85rem;background:#0d0b10}.advanced summary{display:flex;align-items:center;justify-content:space-between;padding:.85rem 1rem;cursor:pointer;color:#d8d0dd;font-size:.76rem;font-weight:800}.advanced summary span{display:flex;align-items:center;gap:.5rem}.advanced-body{display:flex;justify-content:space-between;gap:1rem;align-items:center;padding:0 1rem 1rem;border-top:1px solid var(--border)}.advanced-body p{margin:.9rem 0 0;color:var(--text-subtle);font-size:.72rem;line-height:1.45}.actions{display:flex;justify-content:flex-end;align-items:center;gap:1rem;margin-top:1rem}.actions>span{margin-right:auto;color:var(--text-muted);font-size:.76rem}.actions .success{color:#8ed6a3}.actions .error{color:#ff9d9d}button{border:0;border-radius:.68rem;padding:.68rem 1rem;background:linear-gradient(135deg,#7737f2,#5c25d9);color:#fff;font-weight:800;cursor:pointer}button:disabled{cursor:not-allowed;opacity:.5}button.ghost{border:1px solid var(--border-strong);background:transparent;color:var(--text)}.sr-only{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media(max-width:850px){.engines{grid-template-columns:1fr}.engine{min-height:0}.head{flex-direction:column}.status-stack{justify-items:start}.advanced-body{align-items:stretch;flex-direction:column}.actions{align-items:stretch;flex-direction:column}.actions button{width:100%}}
</style>
