<script setup lang="ts">
import type { TermsVersion } from '~~/db/schema'
import { renderTermsHtml } from '~~/shared/terms'
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'admin' })

type VersionRow = Omit<TermsVersion, 'createdAt' | 'updatedAt' | 'publishedAt'> & { createdAt: string, updatedAt: string, publishedAt: string | null }
const { data, refresh } = await useFetch<{ versions: VersionRow[] }>('/api/admin/terms')
const versions = computed(() => data.value?.versions ?? [])
const draft = computed(() => versions.value.find(version => version.status === 'draft'))
const published = computed(() => versions.value.find(version => version.status === 'published'))
// Edit the draft, or start from the newest version (published if there is no draft).
const source = computed(() => draft.value ?? versions.value[0])

const title = ref(source.value?.title ?? 'Voorwaarden DJ NightLight')
const body = ref(source.value?.body ?? '')
const summaryText = ref((source.value?.summary ?? []).join('\n'))
const saving = ref(false)
const publishing = ref(false)
const message = ref('')
const preview = ref(false)

const { isDirty, markSaved } = useUnsavedChanges(() => ({ title: title.value, body: body.value, summary: summaryText.value }))
const html = computed(() => renderTermsHtml(body.value))
const summaryPoints = computed(() => summaryText.value.split('\n').map(line => line.trim()).filter(Boolean))
const dateFormat = new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' })

async function save() {
  saving.value = true; message.value = ''
  try {
    await $fetch('/api/admin/terms/draft', { method: 'PUT', body: { title: title.value, body: body.value, summary: summaryPoints.value } })
    markSaved()
    await refresh()
    message.value = 'Concept opgeslagen. Clients zien het pas na publiceren.'
  }
  catch (error: unknown) { message.value = apiErrorMessage(error, 'Opslaan is niet gelukt.') }
  finally { saving.value = false }
}

async function publish() {
  if (isDirty.value) await save()
  if (!draft.value) { message.value = 'Er is geen concept om te publiceren.'; return }
  if (!window.confirm('Publiceren maakt dit de versie die klanten accepteren. Een gepubliceerde versie kun je niet meer wijzigen. Doorgaan?')) return
  publishing.value = true; message.value = ''
  try {
    await $fetch('/api/admin/terms/publish', { method: 'POST' })
    await refresh()
    message.value = 'Gepubliceerd. Nieuwe offertes gebruiken deze versie.'
  }
  catch (error: unknown) { message.value = apiErrorMessage(error, 'Publiceren is niet gelukt.') }
  finally { publishing.value = false }
}

useSeoMeta({ title: 'Voorwaarden — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="editor">
    <header class="page-header">
      <div>
        <h2>Voorwaarden</h2>
        <p>Eén tekst voor de algemene en aanvullende voorwaarden. Elke gepubliceerde versie blijft bewaard en het akkoord van een klant wordt aan die versie gekoppeld.</p>
      </div>
      <div class="save-state">
        <span v-if="isDirty" class="dirty-note" role="status">Niet-opgeslagen wijzigingen</span>
        <button class="secondary" :disabled="saving || !isDirty" @click="save">{{ saving ? 'Opslaan…' : 'Concept opslaan' }}</button>
        <button class="primary" :disabled="publishing || (!draft && !isDirty)" @click="publish">{{ publishing ? 'Publiceren…' : 'Publiceren' }}</button>
      </div>
    </header>

    <p class="status" role="status">
      <template v-if="published">Gepubliceerd: versie {{ published.version }} sinds {{ published.publishedAt ? dateFormat.format(new Date(published.publishedAt)) : '' }}. </template>
      <template v-else>Er is nog niets gepubliceerd. Klanten zien geen voorwaarden totdat je publiceert. </template>
      <template v-if="draft">Je bewerkt concept versie {{ draft.version }}.</template>
      <template v-else>Een wijziging wordt een nieuwe versie.</template>
    </p>
    <p v-if="!published" class="warn">Laat de tekst eerst nakijken, vooral de punten met <code>[CONTROLEER]</code> in docs/boeking/voorwaarden-samengevoegd.md.</p>

    <section class="card">
      <label>Titel<input v-model="title"></label>
      <label>Samenvatting (één punt per regel, getoond boven de volledige tekst)<textarea v-model="summaryText" rows="7" /></label>
      <div class="tabs" role="tablist">
        <button role="tab" :aria-selected="!preview" :class="{ active: !preview }" @click="preview = false">Tekst</button>
        <button role="tab" :aria-selected="preview" :class="{ active: preview }" @click="preview = true">Voorbeeld</button>
      </div>
      <label v-if="!preview">Volledige tekst <small>Gebruik <code>## Artikel 1. Titel</code> voor een kop, <code>1.</code> voor genummerde leden en <code>**vet**</code>.</small>
        <textarea v-model="body" rows="28" class="mono" />
      </label>
      <!-- eslint-disable-next-line vue/no-v-html -- the renderer escapes all input -->
      <article v-else class="preview" v-html="html" />
    </section>

    <p v-if="message" class="message">{{ message }}</p>

    <section v-if="versions.length" class="card">
      <h3>Versies</h3>
      <ul class="versions">
        <li v-for="version in versions" :key="version.id">
          <strong>Versie {{ version.version }}</strong>
          <span>{{ version.status === 'published' ? `Gepubliceerd ${version.publishedAt ? dateFormat.format(new Date(version.publishedAt)) : ''}` : 'Concept' }}</span>
          <NuxtLink v-if="version.status === 'published'" :to="`/voorwaarden?version=${version.version}`" target="_blank">Bekijken</NuxtLink>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.editor{max-width:980px;margin-inline:auto}.page-header{display:flex;align-items:end;justify-content:space-between;gap:1rem;margin-bottom:1rem}.page-header h2{margin:.2rem 0;font-size:clamp(1.5rem,3vw,2rem);letter-spacing:-.04em}.page-header p{max-width:640px;margin:0;color:#8b8493}
.save-state{display:flex;flex-wrap:wrap;align-items:center;gap:.6rem}.dirty-note{color:#f2cf8a;font-size:.82rem}
.status{color:var(--text-muted);font-size:.9rem}.warn{padding:.7rem 1rem;border:1px solid #5b4a24;border-radius:.7rem;color:#f2cf8a;font-size:.88rem}
.card{display:grid;gap:.9rem;margin-bottom:.8rem;padding:1.1rem;border:1px solid var(--border);border-radius:1rem;background:var(--surface-card)}
label{display:grid;gap:.35rem;color:var(--text-muted);font-size:.78rem}input,textarea{width:100%;border:1px solid var(--border-strong);border-radius:.6rem;padding:.68rem;background:var(--surface-input);color:var(--text);font:inherit}.mono{font-family:ui-monospace,monospace;font-size:.85rem;line-height:1.5}
.tabs{display:flex;gap:.4rem}.tabs button{min-height:2.5rem;padding:.4rem .9rem;border:1px solid var(--border);border-radius:.55rem;background:transparent;color:var(--text-muted);cursor:pointer}.tabs button.active{color:var(--text);border-color:var(--border-strong)}
.preview :deep(h2){margin:1.6rem 0 .5rem;font-size:1.15rem}.preview :deep(p),.preview :deep(li){line-height:1.6;color:var(--text-muted)}.preview :deep(ol){padding-left:1.3rem;display:grid;gap:.4rem}
.primary,.secondary{border-radius:.7rem;padding:.75rem 1rem;font-weight:800;cursor:pointer}.primary{border:0;background:var(--button-primary-bg);color:var(--button-primary-fg)}.secondary{border:1px solid var(--border-strong);background:transparent;color:var(--text)}button:disabled{opacity:.5;cursor:not-allowed}
.versions{display:grid;gap:.5rem;margin:0;padding:0;list-style:none}.versions li{display:flex;flex-wrap:wrap;gap:.8rem;align-items:center;color:var(--text-muted)}.message{color:#a49dab}
@media(max-width:680px){.page-header{align-items:stretch;flex-direction:column}.primary,.secondary{width:100%}}
</style>
