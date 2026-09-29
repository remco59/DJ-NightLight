<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'

type Status = {
  source: 'settings' | 'environment' | 'none'
  keyConfigured: boolean
  keyPreview: string | null
  livemode: boolean | null
  accountName: string | null
  accountId: string | null
  verifiedAt: string | null
  webhookConfigured: boolean
  webhookEndpointId: string | null
  webhookUrl: string
  webhookPublic: boolean
}
type Check = { label: string, ok: boolean, detail: string }

const { data, refresh } = await useFetch<{ status: Status }>('/api/admin/stripe')
const status = computed(() => data.value?.status)
const secretKey = ref('')
const webhookSecret = ref('')
const busy = ref('')
const error = ref('')
const notice = ref('')
const checks = ref<Check[]>([])
const editingKey = ref(false)
const showManual = ref(false)
const copied = ref(false)

const step = computed(() => {
  if (!status.value?.keyConfigured || editingKey.value) return 1
  if (!status.value.webhookConfigured) return 2
  return 3
})
const steps = ['API-sleutel aanmaken', 'Webhook koppelen', 'Controleren & live gaan']

async function run(name: string, action: () => Promise<void>) {
  busy.value = name
  error.value = ''
  notice.value = ''
  try {
    await action()
  } catch (e: unknown) {
    error.value = apiErrorMessage(e, 'Er ging iets mis. Probeer het opnieuw.')
  } finally {
    busy.value = ''
  }
}

const saveKey = () => run('key', async () => {
  const res = await $fetch<{ status: Status }>('/api/admin/stripe/key', { method: 'POST', body: { secretKey: secretKey.value } })
  data.value = res
  secretKey.value = ''
  editingKey.value = false
  notice.value = 'Sleutel gecontroleerd bij Stripe en versleuteld opgeslagen.'
})

const autoWebhook = () => run('auto', async () => {
  data.value = await $fetch<{ status: Status }>('/api/admin/stripe/webhook', { method: 'POST', body: { mode: 'auto' } })
  notice.value = 'Webhook-endpoint aangemaakt in Stripe en het signing secret opgeslagen.'
})

const manualWebhook = () => run('manual', async () => {
  data.value = await $fetch<{ status: Status }>('/api/admin/stripe/webhook', { method: 'POST', body: { mode: 'manual', webhookSecret: webhookSecret.value } })
  webhookSecret.value = ''
  notice.value = 'Signing secret versleuteld opgeslagen.'
})

const runTest = () => run('test', async () => {
  const res = await $fetch<{ checks: Check[], status: Status }>('/api/admin/stripe/test', { method: 'POST' })
  checks.value = res.checks
  data.value = { status: res.status }
})

const disconnect = () => {
  if (!confirm('Stripe ontkoppelen? Klanten kunnen facturen dan niet meer online betalen totdat je het opnieuw instelt.')) return
  return run('disconnect', async () => {
    await $fetch('/api/admin/stripe', { method: 'DELETE' })
    checks.value = []
    await refresh()
  })
}

async function copyUrl() {
  if (!status.value) return
  try {
    await navigator.clipboard.writeText(status.value.webhookUrl)
    copied.value = true
    setTimeout(() => { copied.value = false }, 1500)
  } catch {
    copied.value = false
  }
}
</script>

<template>
  <section v-if="status" class="stripe-card">
    <div class="head">
      <div class="integration-title">
        <span class="brand-icon">S</span>
        <div>
          <h3>Stripe</h3>
          <p>Ontvang online betalingen via Stripe. Veilig, snel en betrouwbaar.</p>
        </div>
      </div>
      <span class="pill" :class="{ on: status.keyConfigured && status.webhookConfigured }">
        <span class="dot"/>
        {{ status.keyConfigured && status.webhookConfigured ? (status.livemode ? 'Live' : 'Testmodus') : 'Niet ingesteld' }}
      </span>
    </div>

    <p v-if="status.source === 'environment'" class="hint source-note">NightLight gebruikt momenteel Stripe-inloggegevens uit de serveromgeving.</p>

    <template v-if="step === 3">
      <div class="summary-grid">
        <div>
          <span>Modus</span>
          <strong>{{ status.livemode ? 'Live' : 'Test' }}</strong>
        </div>
        <div>
          <span>Account</span>
          <strong>{{ status.accountName || status.accountId || 'Gekoppeld' }}</strong>
        </div>
        <div>
          <span>Webhook</span>
          <strong class="good"><span class="mini-dot"/>Actief</strong>
        </div>
      </div>

      <div class="compact-actions">
        <button class="ghost" :disabled="busy === 'test'" @click="runTest">{{ busy === 'test' ? 'Controleren…' : 'Verbinding controleren' }}</button>
        <button v-if="status.source === 'settings'" class="ghost" @click="editingKey = true">API-sleutel vervangen</button>
        <button v-if="status.source === 'settings'" class="ghost danger" :disabled="busy === 'disconnect'" @click="disconnect">Stripe ontkoppelen</button>
      </div>

      <details class="advanced">
        <summary>Technische details</summary>
        <dl class="facts">
          <div><dt>Sleutel</dt><dd>{{ status.keyPreview }}</dd></div>
          <div><dt>Modus</dt><dd>{{ status.livemode ? 'Live — echte betalingen' : 'Test — geen echt geld' }}</dd></div>
          <div v-if="status.accountName || status.accountId"><dt>Account</dt><dd>{{ status.accountName || status.accountId }}</dd></div>
          <div><dt>Webhook</dt><dd>Signing secret opgeslagen{{ status.webhookEndpointId ? ' (beheerd door NightLight)' : '' }}</dd></div>
        </dl>
        <ul v-if="checks.length" class="checks">
          <li v-for="c in checks" :key="c.label" :class="c.ok ? 'ok' : 'bad'"><strong><Icon :name="c.ok ? 'lucide:circle-check' : 'lucide:circle-x'" aria-hidden="true" /> {{ c.label }}</strong> {{ c.detail }}</li>
        </ul>
        <p v-if="!status.livemode" class="hint">Je zit in testmodus. Gebruik een live restricted key wanneer je echte betalingen wilt ontvangen.</p>
      </details>
    </template>

    <template v-else>
      <ol class="steps">
        <li v-for="(label, i) in steps" :key="label" :class="{ active: step === i + 1, done: step > i + 1 }">
          <span><Icon v-if="step > i + 1" name="lucide:check" aria-hidden="true" /><template v-else>{{ i + 1 }}</template></span>{{ label }}
        </li>
      </ol>

      <div v-if="step === 1" class="panel">
        <h4>Stap 1 — API-sleutel koppelen</h4>
        <p class="hint">Gebruik een beperkte Stripe-sleutel. NightLight controleert hem en slaat hem versleuteld op.</p>
        <details class="advanced">
          <summary>Installatie-instructies</summary>
          <ol class="how">
            <li>Open het <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener">Stripe Dashboard</a> en maak een restricted key voor DJ NightLight.</li>
            <li>Geef Checkout Sessions, Customers en eventueel Webhook Endpoints de benodigde schrijfrechten.</li>
            <li>Schakel de gewenste betaalmethoden in, waaronder bank transfer wanneer je overschrijvingen gebruikt.</li>
          </ol>
        </details>
        <label>Beperkte sleutel
          <input v-model="secretKey" type="password" autocomplete="off" spellcheck="false" placeholder="rk_test_…">
        </label>
        <div class="row">
          <button :disabled="!secretKey || busy === 'key'" @click="saveKey">{{ busy === 'key' ? 'Controleren…' : 'Sleutel controleren & opslaan' }}</button>
          <button v-if="editingKey" class="ghost" @click="editingKey = false; secretKey = ''">Annuleren</button>
        </div>
      </div>

      <div v-else class="panel">
        <h4>Stap 2 — Webhook koppelen</h4>
        <p class="hint">De webhook houdt betaalstatussen automatisch synchroon met NightLight.</p>
        <template v-if="status.webhookPublic">
          <button :disabled="busy === 'auto'" @click="autoWebhook">{{ busy === 'auto' ? 'Aanmaken…' : 'Webhook automatisch aanmaken' }}</button>
          <p class="hint">NightLight registreert automatisch de benodigde Stripe-events.</p>
        </template>
        <p v-else class="hint warn">De ingestelde site-URL is geen publiek HTTPS-adres. Gebruik handmatige configuratie of stel een publieke URL in.</p>
        <button class="link" @click="showManual = !showManual">{{ showManual ? 'Handmatige stappen verbergen' : 'Handmatig instellen' }}</button>
        <div v-if="showManual || !status.webhookPublic" class="manual">
          <p class="hint">Webhook-URL: <code>{{ status.webhookUrl }}</code> <button class="link" @click="copyUrl">{{ copied ? 'Gekopieerd' : 'Kopiëren' }}</button></p>
          <label>Signing secret
            <input v-model="webhookSecret" type="password" autocomplete="off" spellcheck="false" placeholder="whsec_…">
          </label>
          <button :disabled="!webhookSecret || busy === 'manual'" @click="manualWebhook">{{ busy === 'manual' ? 'Opslaan…' : 'Signing secret opslaan' }}</button>
        </div>
      </div>
    </template>

    <p v-if="notice" class="msg ok">{{ notice }}</p>
    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>
  </section>
</template>

<style scoped>
.stripe-card{margin-bottom:1rem;padding:1.15rem;border:1px solid #2b2631;border-radius:1rem;background:linear-gradient(180deg,#111016,#0f0d13)}
.head{display:flex;justify-content:space-between;gap:1rem;align-items:center}
.integration-title{display:flex;gap:.8rem;align-items:center}
.integration-title h3{margin:0 0 .2rem;font-size:1.05rem}
.integration-title p{margin:0;color:#8c8594;font-size:.8rem}
.brand-icon{display:grid;place-items:center;flex:0 0 2.5rem;height:2.5rem;border-radius:.75rem;background:linear-gradient(135deg,#7855ff,#4f2de0);color:#fff;font-size:1.15rem;font-weight:900}
.pill{display:inline-flex;align-items:center;gap:.4rem;flex:none;padding:.28rem .68rem;border-radius:99px;background:#2b2631;color:#aaa4b1;font-size:.7rem;font-weight:750}
.pill .dot{width:.42rem;height:.42rem;border-radius:50%;background:#7d7682}
.pill.on{background:#153426;color:#72e6a2}
.pill.on .dot{background:#48df89}
.source-note{margin-top:.8rem}
.summary-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:.65rem;margin-top:1rem}
.summary-grid>div{display:grid;gap:.25rem;padding:.8rem;border:1px solid #29242f;border-radius:.75rem;background:#0b0a0d}
.summary-grid span{color:#716a78;font-size:.7rem}
.summary-grid strong{font-size:.8rem;word-break:break-word}
.summary-grid strong.good{display:flex;align-items:center;gap:.4rem;color:#72e6a2}
.mini-dot{width:.4rem;height:.4rem;border-radius:50%;background:#48df89}
.compact-actions{display:flex;gap:.6rem;flex-wrap:wrap;margin-top:1rem}
.steps{display:flex;gap:.5rem;list-style:none;margin:1rem 0;padding:0;flex-wrap:wrap}
.steps li{display:flex;align-items:center;gap:.45rem;padding:.38rem .7rem;border:1px solid #332e39;border-radius:99px;color:#716a78;font-size:.74rem}
.steps li span{display:grid;place-items:center;width:1.2rem;height:1.2rem;border-radius:50%;background:#2b2631;font-size:.65rem}
.steps li.active{color:#f6f3fa;border-color:#7445b1}
.steps li.done{color:#7be0a8}
.panel{margin-top:.8rem;padding:1rem;border:1px solid #29242f;border-radius:.8rem;background:#0b0a0d}
h4{margin:0 0 .35rem;font-size:.9rem}
.hint{color:#8c8594;font-size:.78rem;margin:.2rem 0 .8rem;line-height:1.45}
.hint.warn{color:#e9c46a}
.advanced{margin-top:.8rem;border-top:1px solid #29242f;padding-top:.7rem}
.advanced summary{cursor:pointer;color:#bfb5c8;font-size:.76rem;font-weight:700}
.how{margin:.6rem 0 1rem;padding-left:1.2rem;color:#bcb4c4;font-size:.78rem;line-height:1.55}
.how a,.hint a{color:#fff}
code{padding:.1rem .35rem;border-radius:.35rem;background:#1c1922;font-size:.72rem;word-break:break-all}
label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.78rem;margin:.8rem 0}
input{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.72rem;background:#100e14;color:#f6f3fa}
input:focus{outline:none;border-color:#6741a1;box-shadow:0 0 0 3px rgba(103,65,161,.13)}
button{border:0;border-radius:.7rem;padding:.68rem 1rem;background:linear-gradient(135deg,#7737f2,#5c25d9);color:#fff;font-weight:800;cursor:pointer}
button:disabled{opacity:.5;cursor:not-allowed}
button.ghost{background:transparent;color:#f6f3fa;border:1px solid #332e39}
button.danger{border-color:#552b34;color:#ff9d9d}
button.link{background:none;color:#aaa4b1;padding:.2rem 0;text-decoration:underline;font-weight:600}
.row{display:flex;gap:.6rem;flex-wrap:wrap}
.manual{margin-top:.8rem}
.facts{display:grid;gap:.45rem;margin:.8rem 0 0}
.facts div{display:flex;gap:1rem;font-size:.78rem}
.facts dt{width:6rem;color:#8c8594}
.facts dd{margin:0}
.checks{list-style:none;margin:.8rem 0 0;padding:0;display:grid;gap:.4rem;font-size:.78rem}
.checks .ok strong{color:#7be0a8}
.checks .bad strong{color:#ff8a8a}
.msg{margin:.8rem 0 0;font-size:.78rem}
.msg.ok{color:#7be0a8}
.msg.bad{color:#ff8a8a}
@media(max-width:700px){
  .head{align-items:flex-start;flex-direction:column}
  .summary-grid{grid-template-columns:1fr}
  .compact-actions,.row{display:grid}
  button{width:100%}
}
</style>
