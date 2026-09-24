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
  <section v-if="status" class="card stripe">
    <div class="head">
      <div>
        <h2>Online betalen (Stripe)</h2>
        <p class="lede">Laat klanten definitieve facturen vanuit hun portaal betalen met kaart, iDEAL of bankoverschrijving. Stripe koppelt overschrijvingen automatisch en NightLight toont de status bij de gig.</p>
      </div>
      <span class="pill" :class="{ on: status.keyConfigured && status.webhookConfigured }">
        {{ status.keyConfigured && status.webhookConfigured ? (status.livemode ? 'Live' : 'Testmodus') : 'Niet ingesteld' }}
      </span>
    </div>

    <p v-if="status.source === 'environment'" class="hint">Op dit moment worden inloggegevens uit de omgevingsvariabelen van de server gebruikt. Een sleutel die je hier opslaat, gaat daarboven.</p>

    <ol class="steps">
      <li v-for="(label, i) in steps" :key="label" :class="{ active: step === i + 1, done: step > i + 1 }">
        <span><Icon v-if="step > i + 1" name="lucide:check" aria-hidden="true" /><template v-else>{{ i + 1 }}</template></span>{{ label }}
      </li>
    </ol>

    <div v-if="step === 1" class="panel">
      <h3>Stap 1 — Maak een beperkte API-sleutel aan</h3>
      <ol class="how">
        <li>Open het <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener">Stripe Dashboard <Icon name="lucide:chevron-right" aria-hidden="true" /> Developers <Icon name="lucide:chevron-right" aria-hidden="true" /> API keys</a>. Begin in <strong>test mode</strong>, zodat er niets echt wordt afgeschreven.</li>
        <li>Klik op <strong>Create restricted key</strong> en noem hem “DJ NightLight”.</li>
        <li>Zet <strong>Checkout Sessions</strong> en <strong>Customers</strong> op <strong>Write</strong>. NightLight heeft de Customers-rechten nodig om de virtuele IBAN voor bankoverschrijvingen aan te maken. Zet ook <strong>Webhook Endpoints</strong> op <strong>Write</strong> als je de webhook in stap 2 automatisch wilt laten aanmaken.</li>
        <li>Schakel bij <a href="https://dashboard.stripe.com/settings/payment_methods" target="_blank" rel="noopener">Payment methods</a> <strong>Bank transfer</strong> in voor je account. Facturen in euro gebruiken de Europese overschrijvingsinstructies van Stripe.</li>
        <li>Maak de sleutel aan en plak hem hier. Hij wordt gecontroleerd bij Stripe, daarna versleuteld opgeslagen en nooit meer getoond.</li>
      </ol>
      <label>Beperkte sleutel
        <input v-model="secretKey" type="password" autocomplete="off" spellcheck="false" placeholder="rk_test_…">
      </label>
      <div class="row">
        <button :disabled="!secretKey || busy === 'key'" @click="saveKey">{{ busy === 'key' ? 'Controleren…' : 'Sleutel controleren & opslaan' }}</button>
        <button v-if="editingKey" class="ghost" @click="editingKey = false; secretKey = ''">Annuleren</button>
      </div>
    </div>

    <div v-else-if="step === 2" class="panel">
      <h3>Stap 2 — Koppel de webhook</h3>
      <p class="lede">Stripe laat NightLight weten wanneer een betaling slaagt of mislukt. Zo worden facturen als betaald gemarkeerd.</p>
      <template v-if="status.webhookPublic">
        <button :disabled="busy === 'auto'" @click="autoWebhook">{{ busy === 'auto' ? 'Aanmaken…' : 'Webhook automatisch aanmaken' }}</button>
        <p class="hint">Registreert <code>{{ status.webhookUrl }}</code> in Stripe voor de 5 events die NightLight nodig heeft.</p>
      </template>
      <p v-else class="hint warn">De URL van je site ({{ status.webhookUrl }}) is geen publiek HTTPS-adres, dus Stripe kan hem niet bereiken. Stel <code>NUXT_PUBLIC_SITE_URL</code> in voor automatische installatie, of stuur voor lokaal testen events door met de Stripe CLI en plak het signing secret hieronder.</p>
      <button class="link" @click="showManual = !showManual">{{ showManual ? 'Handmatige stappen verbergen' : 'Liever handmatig instellen' }}</button>
      <div v-if="showManual || !status.webhookPublic" class="manual">
        <ol class="how">
          <li>Stripe Dashboard <Icon name="lucide:chevron-right" aria-hidden="true" /> <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener">Developers <Icon name="lucide:chevron-right" aria-hidden="true" /> Webhooks</a> <Icon name="lucide:chevron-right" aria-hidden="true" /> <strong>Add endpoint</strong>.</li>
          <li>Endpoint-URL: <code>{{ status.webhookUrl }}</code> <button class="link" @click="copyUrl">{{ copied ? 'Gekopieerd' : 'Kopiëren' }}</button></li>
          <li>Kies deze events: <code>checkout.session.completed</code>, <code>checkout.session.async_payment_succeeded</code>, <code>checkout.session.async_payment_failed</code>, <code>checkout.session.expired</code>, <code>payment_intent.payment_failed</code>.</li>
          <li>Toon na het aanmaken het <strong>Signing secret</strong> (begint met <code>whsec_</code>) en plak het hier.</li>
        </ol>
        <label>Signing secret
          <input v-model="webhookSecret" type="password" autocomplete="off" spellcheck="false" placeholder="whsec_…">
        </label>
        <button :disabled="!webhookSecret || busy === 'manual'" @click="manualWebhook">{{ busy === 'manual' ? 'Opslaan…' : 'Signing secret opslaan' }}</button>
      </div>
    </div>

    <div v-else class="panel">
      <h3>Stap 3 — Controleren</h3>
      <dl class="facts">
        <div><dt>Sleutel</dt><dd>{{ status.keyPreview }}</dd></div>
        <div><dt>Modus</dt><dd>{{ status.livemode ? 'Live — echte betalingen' : 'Test — geen echt geld' }}</dd></div>
        <div v-if="status.accountName || status.accountId"><dt>Account</dt><dd>{{ status.accountName || status.accountId }}</dd></div>
        <div><dt>Webhook</dt><dd>Signing secret opgeslagen{{ status.webhookEndpointId ? ' (beheerd door NightLight)' : '' }}</dd></div>
      </dl>
      <div class="row">
        <button :disabled="busy === 'test'" @click="runTest">{{ busy === 'test' ? 'Controleren…' : 'Verbinding controleren' }}</button>
      </div>
      <ul v-if="checks.length" class="checks">
        <li v-for="c in checks" :key="c.label" :class="c.ok ? 'ok' : 'bad'"><strong><Icon :name="c.ok ? 'lucide:circle-check' : 'lucide:circle-x'" aria-hidden="true" /> {{ c.label }}</strong> {{ c.detail }}</li>
      </ul>
      <p v-if="!status.livemode" class="hint">Je zit in testmodus. Klaar voor echte betalingen? Herhaal deze stappen dan met een <strong>live</strong> sleutel (<code>rk_live_…</code>) — zet eerst “Test mode” uit in het Stripe Dashboard.</p>
    </div>

    <p v-if="notice" class="msg ok">{{ notice }}</p>
    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>

    <div v-if="status.keyConfigured && status.source === 'settings'" class="row foot">
      <button v-if="step === 3" class="ghost" @click="editingKey = true">Sleutel vervangen</button>
      <button class="ghost danger" :disabled="busy === 'disconnect'" @click="disconnect">Stripe ontkoppelen</button>
    </div>
  </section>
</template>

<style scoped>
.card{margin-bottom:1rem;padding:1.2rem;border:1px solid #2b2631;border-radius:1rem;background:#100e14}
h2,h3{margin:0 0 .4rem}
h3{font-size:1rem}
.head{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start}
.lede,.hint{color:#8c8594;font-size:.85rem;margin:.2rem 0 .8rem}
.hint.warn{color:#e9c46a}
.pill{flex:none;padding:.25rem .7rem;border-radius:99px;background:#2b2631;color:#aaa4b1;font-size:.75rem;font-weight:700}
.pill.on{background:#16382a;color:#7be0a8}
.steps{display:flex;gap:.5rem;list-style:none;margin:1rem 0;padding:0;flex-wrap:wrap}
.steps li{display:flex;align-items:center;gap:.5rem;padding:.4rem .8rem;border:1px solid #332e39;border-radius:99px;color:#716a78;font-size:.8rem}
.steps li span{display:grid;place-items:center;width:1.3rem;height:1.3rem;border-radius:50%;background:#2b2631;font-size:.7rem}
.steps li.active{color:#f6f3fa;border-color:#fff}
.steps li.done{color:#7be0a8}
.panel{padding:1rem;border:1px solid #2b2631;border-radius:.8rem;background:#0b0a0d}
.how{margin:.5rem 0 1rem;padding-left:1.2rem;color:#c9c3d0;font-size:.85rem;line-height:1.6}
.how a,.hint a{color:#fff}
code{padding:.1rem .35rem;border-radius:.35rem;background:#1c1922;font-size:.78rem;word-break:break-all}
label{display:grid;gap:.35rem;color:#aaa4b1;font-size:.8rem;margin-bottom:.8rem}
input{width:100%;border:1px solid #332e39;border-radius:.65rem;padding:.7rem;background:#100e14;color:#f6f3fa}
button{border:0;border-radius:.7rem;padding:.65rem 1rem;background:#fff;color:#09080b;font-weight:800;cursor:pointer}
button:disabled{opacity:.5;cursor:not-allowed}
button.ghost{background:transparent;color:#f6f3fa;border:1px solid #332e39}
button.danger{color:#ff8a8a}
button.link{background:none;color:#aaa4b1;padding:.2rem 0;text-decoration:underline;font-weight:600;margin-left:.4rem}
.row{display:flex;gap:.6rem;flex-wrap:wrap}
.foot{margin-top:1rem}
.manual{margin-top:.8rem}
.facts{display:grid;gap:.4rem;margin:0 0 1rem}
.facts div{display:flex;gap:1rem;font-size:.85rem}
.facts dt{width:6rem;color:#8c8594}
.facts dd{margin:0}
.checks{list-style:none;margin:1rem 0 0;padding:0;display:grid;gap:.4rem;font-size:.85rem}
.checks .ok strong{color:#7be0a8}
.checks .bad strong{color:#ff8a8a}
.msg{margin:.8rem 0 0;font-size:.85rem}
.msg.ok{color:#7be0a8}
.msg.bad{color:#ff8a8a}
@media(max-width:650px){.head{flex-direction:column}button{width:100%}.row{flex-direction:column}}
</style>
