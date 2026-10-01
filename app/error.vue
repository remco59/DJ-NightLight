<script setup lang="ts">
import type { NuxtError } from '#app'

const props = defineProps<{ error: NuxtError }>()
const route = useRoute()

const isNotFound = computed(() => props.error.statusCode === 404)
const inAdmin = computed(() => route.path.startsWith('/admin'))

const title = computed(() => isNotFound.value ? 'Deze pagina bestaat niet (meer).' : 'Hier ging iets mis.')
const body = computed(() => isNotFound.value
  ? 'Misschien is de link verouderd of zit er een typfout in. Via de homepage vind je alles terug.'
  : 'Probeer het over een paar minuten opnieuw. Blijft het misgaan, laat het dan even weten.')

useSeoMeta({ title: () => `${isNotFound.value ? 'Pagina niet gevonden' : 'Er ging iets mis'} — DJ NightLight`, robots: 'noindex, nofollow' })

function goHome() {
  clearError({ redirect: inAdmin.value ? '/admin' : '/' })
}
</script>

<template>
  <NuxtLayout :name="inAdmin ? 'default' : 'public'">
    <main class="public-page error-page">
      <div class="public-container">
        <p class="error-code">{{ error.statusCode || 500 }}</p>
        <h1 class="display-title">{{ title }}</h1>
        <p class="error-body">{{ body }}</p>
        <div class="error-actions">
          <button type="button" class="public-button" @click="goHome">
            {{ inAdmin ? 'Naar het dashboard' : 'Naar de homepage' }} <Icon name="lucide:arrow-right" aria-hidden="true" />
          </button>
          <NuxtLink v-if="!inAdmin" class="public-button secondary" to="/boeken">Een avond plannen</NuxtLink>
        </div>
      </div>
    </main>
  </NuxtLayout>
</template>

<style scoped>
.error-page{min-height:80vh}.error-code{margin:0;color:#b48cff;font-size:.85rem;font-weight:800;letter-spacing:.12em}.error-body{max-width:38rem;color:#aaa4af;font-size:1.05rem;line-height:1.65}.error-actions{display:flex;flex-wrap:wrap;gap:.65rem;margin-top:2rem}.public-button{border:0;cursor:pointer}
</style>
