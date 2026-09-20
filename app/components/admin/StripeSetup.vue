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
const steps = ['Get an API key', 'Connect the webhook', 'Verify & go live']

async function run(name: string, action: () => Promise<void>) {
  busy.value = name
  error.value = ''
  notice.value = ''
  try {
    await action()
  } catch (e: unknown) {
    error.value = apiErrorMessage(e, 'Something went wrong. Please try again.')
  } finally {
    busy.value = ''
  }
}

const saveKey = () => run('key', async () => {
  const res = await $fetch<{ status: Status }>('/api/admin/stripe/key', { method: 'POST', body: { secretKey: secretKey.value } })
  data.value = res
  secretKey.value = ''
  editingKey.value = false
  notice.value = 'Key verified with Stripe and saved encrypted.'
})

const autoWebhook = () => run('auto', async () => {
  data.value = await $fetch<{ status: Status }>('/api/admin/stripe/webhook', { method: 'POST', body: { mode: 'auto' } })
  notice.value = 'Webhook endpoint created in Stripe and its signing secret saved.'
})

const manualWebhook = () => run('manual', async () => {
  data.value = await $fetch<{ status: Status }>('/api/admin/stripe/webhook', { method: 'POST', body: { mode: 'manual', webhookSecret: webhookSecret.value } })
  webhookSecret.value = ''
  notice.value = 'Signing secret saved encrypted.'
})

const runTest = () => run('test', async () => {
  const res = await $fetch<{ checks: Check[], status: Status }>('/api/admin/stripe/test', { method: 'POST' })
  checks.value = res.checks
  data.value = { status: res.status }
})

const disconnect = () => {
  if (!confirm('Disconnect Stripe? Clients will no longer be able to pay invoices online until it is set up again.')) return
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
        <h2>Online payments (Stripe)</h2>
        <p class="lede">Let clients pay finalized invoices by card or iDEAL from their portal. Follow the steps below; nothing needs to be edited on the server.</p>
      </div>
      <span class="pill" :class="{ on: status.keyConfigured && status.webhookConfigured }">
        {{ status.keyConfigured && status.webhookConfigured ? (status.livemode ? 'Live' : 'Test mode') : 'Not set up' }}
      </span>
    </div>

    <p v-if="status.source === 'environment'" class="hint">Currently using credentials from server environment variables. Saving a key here overrides them.</p>

    <ol class="steps">
      <li v-for="(label, i) in steps" :key="label" :class="{ active: step === i + 1, done: step > i + 1 }">
        <span>{{ step > i + 1 ? '✓' : i + 1 }}</span>{{ label }}
      </li>
    </ol>

    <div v-if="step === 1" class="panel">
      <h3>Step 1 — Create a restricted API key</h3>
      <ol class="how">
        <li>Open the <a href="https://dashboard.stripe.com/apikeys" target="_blank" rel="noopener">Stripe Dashboard → Developers → API keys</a>. Start in <strong>test mode</strong> so nothing real is charged.</li>
        <li>Click <strong>Create restricted key</strong> and name it “DJ NightLight”.</li>
        <li>Set <strong>Checkout Sessions</strong> to <strong>Write</strong>. Also set <strong>Webhook Endpoints</strong> to <strong>Write</strong> if you want the webhook created for you in step 2.</li>
        <li>Create the key and paste it here. It is verified with Stripe, then stored encrypted and never shown again.</li>
      </ol>
      <label>Restricted key
        <input v-model="secretKey" type="password" autocomplete="off" spellcheck="false" placeholder="rk_test_…">
      </label>
      <div class="row">
        <button :disabled="!secretKey || busy === 'key'" @click="saveKey">{{ busy === 'key' ? 'Verifying…' : 'Verify & save key' }}</button>
        <button v-if="editingKey" class="ghost" @click="editingKey = false; secretKey = ''">Cancel</button>
      </div>
    </div>

    <div v-else-if="step === 2" class="panel">
      <h3>Step 2 — Connect the webhook</h3>
      <p class="lede">Stripe tells NightLight when a payment succeeds or fails. This is what marks invoices as paid.</p>
      <template v-if="status.webhookPublic">
        <button :disabled="busy === 'auto'" @click="autoWebhook">{{ busy === 'auto' ? 'Creating…' : 'Create webhook automatically' }}</button>
        <p class="hint">Registers <code>{{ status.webhookUrl }}</code> in Stripe for the 5 events NightLight needs.</p>
      </template>
      <p v-else class="hint warn">Your site URL ({{ status.webhookUrl }}) is not a public HTTPS address, so Stripe can’t reach it. Set <code>NUXT_PUBLIC_SITE_URL</code> for automatic setup, or for local testing forward events with the Stripe CLI and paste the signing secret below.</p>
      <button class="link" @click="showManual = !showManual">{{ showManual ? 'Hide manual steps' : 'Set it up manually instead' }}</button>
      <div v-if="showManual || !status.webhookPublic" class="manual">
        <ol class="how">
          <li>Stripe Dashboard → <a href="https://dashboard.stripe.com/webhooks" target="_blank" rel="noopener">Developers → Webhooks</a> → <strong>Add endpoint</strong>.</li>
          <li>Endpoint URL: <code>{{ status.webhookUrl }}</code> <button class="link" @click="copyUrl">{{ copied ? 'Copied' : 'Copy' }}</button></li>
          <li>Select events: <code>checkout.session.completed</code>, <code>checkout.session.async_payment_succeeded</code>, <code>checkout.session.async_payment_failed</code>, <code>checkout.session.expired</code>, <code>payment_intent.payment_failed</code>.</li>
          <li>After creating it, reveal the <strong>Signing secret</strong> (starts with <code>whsec_</code>) and paste it here.</li>
        </ol>
        <label>Signing secret
          <input v-model="webhookSecret" type="password" autocomplete="off" spellcheck="false" placeholder="whsec_…">
        </label>
        <button :disabled="!webhookSecret || busy === 'manual'" @click="manualWebhook">{{ busy === 'manual' ? 'Saving…' : 'Save signing secret' }}</button>
      </div>
    </div>

    <div v-else class="panel">
      <h3>Step 3 — Verify</h3>
      <dl class="facts">
        <div><dt>Key</dt><dd>{{ status.keyPreview }}</dd></div>
        <div><dt>Mode</dt><dd>{{ status.livemode ? 'Live — real payments' : 'Test — no real money' }}</dd></div>
        <div v-if="status.accountName || status.accountId"><dt>Account</dt><dd>{{ status.accountName || status.accountId }}</dd></div>
        <div><dt>Webhook</dt><dd>Signing secret saved{{ status.webhookEndpointId ? ' (managed by NightLight)' : '' }}</dd></div>
      </dl>
      <div class="row">
        <button :disabled="busy === 'test'" @click="runTest">{{ busy === 'test' ? 'Checking…' : 'Run connection check' }}</button>
      </div>
      <ul v-if="checks.length" class="checks">
        <li v-for="c in checks" :key="c.label" :class="c.ok ? 'ok' : 'bad'"><strong>{{ c.ok ? '✓' : '✕' }} {{ c.label }}</strong> {{ c.detail }}</li>
      </ul>
      <p v-if="!status.livemode" class="hint">You’re in test mode. When ready to take real payments, repeat these steps with a <strong>live</strong> key (<code>rk_live_…</code>) — toggle “Test mode” off in the Stripe Dashboard first.</p>
    </div>

    <p v-if="notice" class="msg ok">{{ notice }}</p>
    <p v-if="error" class="msg bad" role="alert">{{ error }}</p>

    <div v-if="status.keyConfigured && status.source === 'settings'" class="row foot">
      <button v-if="step === 3" class="ghost" @click="editingKey = true">Replace key</button>
      <button class="ghost danger" :disabled="busy === 'disconnect'" @click="disconnect">Disconnect Stripe</button>
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
