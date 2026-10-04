<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'

definePageMeta({ layout: 'admin' })

type GigOption = {
  id: string
  title: string
  startsAt: string | null
  imageUrl: string | null
  venueName: string | null
}
type AppearanceData = { defaultImageUrl: string | null, gigs: GigOption[] }

const { data } = await useFetch<AppearanceData>('/api/admin/questionnaire/portal-appearance')
if (!data.value) throw createError({ statusCode: 500, statusMessage: 'Klantportaal-instellingen laden is niet gelukt' })

const defaultImageUrl = ref<string | null>(data.value.defaultImageUrl)
const selectedGigId = ref(data.value.gigs[0]?.id || '')
const selectedImageUrl = ref<string | null>(data.value.gigs[0]?.imageUrl || null)
const savingDefault = ref(false)
const savingGig = ref(false)
const message = ref('')

const selectedGig = computed(() => data.value?.gigs.find(gig => gig.id === selectedGigId.value) || null)
const effectiveImageUrl = computed(() => selectedImageUrl.value || defaultImageUrl.value)

watch(selectedGigId, () => {
  selectedImageUrl.value = selectedGig.value?.imageUrl || null
  message.value = ''
})

function formatGig(gig: GigOption) {
  const date = gig.startsAt
    ? new Intl.DateTimeFormat('nl-NL', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(gig.startsAt))
    : 'Datum volgt nog'
  return `${gig.title} · ${date}${gig.venueName ? ` · ${gig.venueName}` : ''}`
}

async function saveDefault() {
  savingDefault.value = true
  message.value = ''
  try {
    const result = await $fetch<{ imageUrl: string | null }>('/api/admin/questionnaire/portal-appearance', {
      method: 'PUT',
      body: { imageUrl: defaultImageUrl.value },
    })
    defaultImageUrl.value = result.imageUrl
    if (data.value) data.value.defaultImageUrl = result.imageUrl
    message.value = 'Standaardafbeelding opgeslagen.'
  } catch (error: unknown) {
    message.value = apiErrorMessage(error, 'Standaardafbeelding opslaan is niet gelukt.')
  } finally {
    savingDefault.value = false
  }
}

async function saveGigImage() {
  if (!selectedGig.value) return
  savingGig.value = true
  message.value = ''
  try {
    const result = await $fetch<{ imageUrl: string | null }>(`/api/admin/gigs/${selectedGig.value.id}/client-portal-image`, {
      method: 'PUT',
      body: { imageUrl: selectedImageUrl.value },
    })
    selectedImageUrl.value = result.imageUrl
    selectedGig.value.imageUrl = result.imageUrl
    message.value = result.imageUrl ? 'Afbeelding voor deze gig opgeslagen.' : 'Deze gig gebruikt nu weer de standaardafbeelding.'
  } catch (error: unknown) {
    message.value = apiErrorMessage(error, 'Afbeelding voor deze gig opslaan is niet gelukt.')
  } finally {
    savingGig.value = false
  }
}

async function resetGigImage() {
  selectedImageUrl.value = null
  await saveGigImage()
}

useSeoMeta({ title: 'Klantportaal — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <main class="portal-admin">
    <header class="page-header">
      <div>
        <p class="eyebrow">Klantportaal</p>
        <h1>Uiterlijk klantportaal</h1>
        <p>Beheer de hero-afbeelding die klanten bovenaan hun persoonlijke boekingspagina zien.</p>
      </div>
      <NuxtLink to="/admin/questionnaire" class="secondary-button">
        Vragenlijst beheren <Icon name="lucide:clipboard-list" aria-hidden="true" />
      </NuxtLink>
    </header>

    <p v-if="message" class="message" role="status">{{ message }}</p>

    <section class="settings-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Standaard</p>
          <h2>Standaardafbeelding</h2>
          <p>Wordt gebruikt voor iedere gig waarvoor je geen eigen afbeelding instelt.</p>
        </div>
        <span class="badge">Globaal</span>
      </div>

      <AdminMediaPicker
        v-model="defaultImageUrl"
        label="Hero-afbeelding klantportaal"
        description="Kies een foto uit de mediabibliotheek. Een brede liggende foto werkt het beste."
      />

      <div class="actions">
        <button type="button" class="primary-button" :disabled="savingDefault" @click="saveDefault">
          {{ savingDefault ? 'Opslaan…' : 'Standaard opslaan' }}
        </button>
      </div>
    </section>

    <section class="settings-card">
      <div class="section-heading">
        <div>
          <p class="eyebrow">Per gig</p>
          <h2>Afbeelding overschrijven</h2>
          <p>Geef één boeking een eigen foto. Zonder override blijft de standaardafbeelding actief.</p>
        </div>
        <span class="badge subtle">{{ selectedGig?.imageUrl ? 'Eigen afbeelding' : 'Gebruikt standaard' }}</span>
      </div>

      <label class="gig-select">
        Gig
        <select v-model="selectedGigId">
          <option v-for="gig in (data?.gigs || [])" :key="gig.id" :value="gig.id">{{ formatGig(gig) }}</option>
        </select>
      </label>

      <template v-if="selectedGig">
        <AdminMediaPicker
          v-model="selectedImageUrl"
          label="Eigen klantportaal-afbeelding"
          description="Laat leeg om de globale standaardafbeelding te gebruiken."
        />

        <div class="effective-preview">
          <div>
            <span>Actieve bron</span>
            <strong>{{ selectedImageUrl ? 'Eigen afbeelding voor deze gig' : defaultImageUrl ? 'Globale standaardafbeelding' : 'Geen afbeelding ingesteld' }}</strong>
          </div>
          <img v-if="effectiveImageUrl" :src="effectiveImageUrl" alt="Voorbeeld van de actieve klantportaal-afbeelding">
        </div>

        <div class="actions split">
          <button v-if="selectedGig.imageUrl" type="button" class="secondary-button" :disabled="savingGig" @click="resetGigImage">Gebruik standaardafbeelding</button>
          <button type="button" class="primary-button" :disabled="savingGig" @click="saveGigImage">
            {{ savingGig ? 'Opslaan…' : 'Gig-afbeelding opslaan' }}
          </button>
        </div>
      </template>

      <p v-else class="empty">Er zijn nog geen gigs om aan te passen.</p>
    </section>
  </main>
</template>

<style scoped>
.portal-admin{display:grid;gap:1rem;max-width:980px;margin:0 auto;padding:1rem 0 3rem}.page-header{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.page-header h1{margin:.2rem 0 .5rem;font-size:clamp(2rem,5vw,3.5rem);letter-spacing:-.04em}.page-header p:last-child,.section-heading p:last-child{max-width:660px;margin:.2rem 0;color:var(--text-subtle)}.eyebrow{margin:0;color:#b99bff;font-size:.7rem;font-weight:800;letter-spacing:.16em;text-transform:uppercase}.settings-card{display:grid;gap:1.1rem;padding:1.25rem;border:1px solid #2c2732;border-radius:1.1rem;background:var(--surface-card)}.section-heading{display:flex;align-items:flex-start;justify-content:space-between;gap:1rem}.section-heading h2{margin:.2rem 0;font-size:1.35rem}.badge{flex:0 0 auto;border-radius:999px;padding:.35rem .6rem;background:#2a1940;color:#c99bff;font-size:.72rem;font-weight:750}.badge.subtle{background:#1c1920;color:#aaa3b1}.gig-select{display:grid;gap:.45rem;color:#c9c3ce;font-size:.82rem;font-weight:700}.gig-select select{width:100%;border:1px solid #3a3440;border-radius:.75rem;padding:.8rem;background:var(--surface-input);color:var(--text)}.actions{display:flex;justify-content:flex-end;gap:.7rem}.actions.split{justify-content:space-between}.primary-button,.secondary-button{display:inline-flex;align-items:center;justify-content:center;gap:.45rem;border-radius:.7rem;padding:.75rem 1rem;font:inherit;font-weight:750;text-decoration:none;cursor:pointer}.primary-button{border:0;background:linear-gradient(135deg,#7d3eff,#a754ff);color:#fff}.secondary-button{border:1px solid #494151;background:transparent;color:var(--text)}button:disabled{cursor:not-allowed;opacity:.5}.message{margin:0;padding:.8rem 1rem;border:1px solid #42394d;border-radius:.75rem;background:#151119;color:#d6cedd}.effective-preview{display:grid;grid-template-columns:minmax(0,1fr) minmax(180px,280px);align-items:center;gap:1rem;padding:1rem;border:1px solid #302a36;border-radius:.85rem;background:#0e0c11}.effective-preview div{display:grid;gap:.25rem}.effective-preview span{color:var(--text-subtle);font-size:.75rem}.effective-preview img{width:100%;aspect-ratio:16/9;border-radius:.65rem;object-fit:cover}.empty{color:var(--text-subtle)}@media(max-width:700px){.page-header,.section-heading{flex-direction:column}.effective-preview{grid-template-columns:1fr}.actions.split{align-items:stretch;flex-direction:column-reverse}.actions button,.page-header .secondary-button{width:100%}}
</style>
