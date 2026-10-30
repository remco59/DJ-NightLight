<script setup lang="ts">
import { renderTermsHtml, termsHeadings, termsPlainText, type PublicTerms } from '~~/shared/terms'

definePageMeta({ layout: 'public' })

const route = useRoute()
const version = computed(() => Number(route.query.version) || undefined)
const { data, error } = await useFetch<{ terms: PublicTerms }>('/api/terms', { query: { version } })
const terms = computed(() => data.value?.terms)
const html = computed(() => terms.value ? renderTermsHtml(terms.value.body) : '')
const headings = computed(() => terms.value ? termsHeadings(terms.value.body) : [])
const publishedOn = computed(() => terms.value ? new Intl.DateTimeFormat('nl-NL', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Europe/Amsterdam' }).format(new Date(terms.value.publishedAt)) : '')
const downloadHref = computed(() => terms.value ? `data:text/plain;charset=utf-8,${encodeURIComponent(termsPlainText(terms.value))}` : '')

function printPage() { window.print() }

useSeoMeta({ title: 'Voorwaarden — DJ NightLight', description: 'De voorwaarden voor het boeken van DJ NightLight.' })
</script>

<template>
  <main class="terms-page">
    <header class="terms-head">
      <p class="eyebrow">Voorwaarden</p>
      <h1>{{ terms?.title || 'Voorwaarden' }}</h1>
      <p v-if="terms" class="meta">Versie {{ terms.version }}, geldig sinds {{ publishedOn }}</p>
    </header>

    <p v-if="error || !terms" class="empty" role="status">De voorwaarden zijn nog niet beschikbaar. Neem contact op als je ze eerder nodig hebt.</p>

    <template v-else>
      <section v-if="terms.summary.length" class="summary" aria-labelledby="summary-title">
        <h2 id="summary-title">Het belangrijkste in het kort</h2>
        <ul><li v-for="point in terms.summary" :key="point">{{ point }}</li></ul>
        <p class="note">Dit is een samenvatting. De volledige tekst hieronder geldt.</p>
      </section>

      <div class="actions">
        <button type="button" class="action" @click="printPage"><Icon name="lucide:printer" aria-hidden="true" /> Afdrukken of opslaan als PDF</button>
        <a class="action" :href="downloadHref" :download="`voorwaarden-nightlight-v${terms.version}.txt`"><Icon name="lucide:download" aria-hidden="true" /> Download als tekst</a>
      </div>

      <nav class="toc" aria-label="Inhoudsopgave">
        <h2>Inhoud</h2>
        <ol><li v-for="heading in headings" :key="heading.anchor"><a :href="`#${heading.anchor}`">{{ heading.title }}</a></li></ol>
      </nav>

      <!-- eslint-disable-next-line vue/no-v-html -- the renderer escapes all input -->
      <article class="terms-body" v-html="html" />
    </template>
  </main>
</template>

<style scoped>
.terms-page{max-width:52rem;margin:0 auto;padding:clamp(7rem,12vw,9rem) clamp(1rem,3vw,2rem) 5rem;color:var(--text)}
.terms-head h1{margin:.3rem 0;font-size:clamp(2rem,5vw,3rem);letter-spacing:-.04em}.eyebrow{margin:0;color:var(--text-subtle);font-size:.78rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase}.meta{margin:0;color:var(--text-muted)}
.empty{margin-top:2rem;color:var(--text-muted)}
.summary{margin:2rem 0 1rem;padding:1.25rem 1.4rem;border:1px solid var(--border);border-radius:1rem;background:var(--surface-card)}.summary h2{margin:0 0 .6rem;font-size:1.1rem}.summary ul{margin:0;padding-left:1.2rem;display:grid;gap:.5rem;line-height:1.55}.note{margin:.8rem 0 0;color:var(--text-subtle);font-size:.85rem}
.actions{display:flex;flex-wrap:wrap;gap:.6rem;margin:1rem 0 2rem}.action{display:inline-flex;align-items:center;gap:.5rem;min-height:2.75rem;padding:.6rem 1rem;border:1px solid var(--border);border-radius:.7rem;background:transparent;color:var(--text);font:inherit;font-size:.9rem;text-decoration:none;cursor:pointer}
.toc{margin-bottom:2rem}.toc h2{font-size:1rem;margin:0 0 .5rem}.toc ol{margin:0;padding-left:1.2rem;columns:2;column-gap:2rem;line-height:1.8}.toc a{color:var(--text-muted)}
.terms-body :deep(h2){margin:2.2rem 0 .6rem;font-size:1.25rem;scroll-margin-top:6rem}.terms-body :deep(p),.terms-body :deep(li){line-height:1.65;color:var(--text-muted)}.terms-body :deep(ol){padding-left:1.4rem;display:grid;gap:.5rem}.terms-body :deep(strong){color:var(--text)}
@media(max-width:640px){.toc ol{columns:1}}
@media print{.actions,.toc{display:none}.terms-page{padding-top:1rem;color:#000}.terms-body :deep(p),.terms-body :deep(li),.summary,.terms-body :deep(strong){color:#000}}
</style>
