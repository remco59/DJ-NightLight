<script setup lang="ts">
import { apiErrorMessage } from '~/utils/api-error'
import { canCancelRender, type VideoRenderStatus } from '~~/shared/video-generator'
import { VIDEO_ASPECTS, VIDEO_ASPECT_KEYS, type VideoAspect } from '~~/shared/video-project'
import { labelFor, renderStatusLabels } from '~~/shared/labels'

definePageMeta({ layout: 'admin' })

type ProjectSummary = {
  id: string
  name: string
  aspect: VideoAspect
  width: number
  height: number
  durationSeconds: number
  itemCount: number
  updatedAt: string
}

type RenderJob = {
  id: string
  projectId: string | null
  projectName: string | null
  status: VideoRenderStatus
  progress: number
  width: number
  height: number
  durationSeconds: number
  renderEngine: string | null
  videoUrl: string | null
  createdAt: string
}

const { data, refresh } = await useFetch<{ projects: ProjectSummary[] }>('/api/admin/video-projects')
const { data: queue, refresh: refreshQueue } = await useFetch<{ jobs: RenderJob[] }>('/api/admin/post-generator/video')
const name = ref('')
const aspect = ref<VideoAspect>('9:16')
const busy = ref('')
const message = ref('')

async function create() {
  busy.value = 'create'
  message.value = ''
  try {
    const result = await $fetch<{ project: { id: string } }>('/api/admin/video-projects', { method: 'POST', body: { name: name.value, aspect: aspect.value } })
    await navigateTo(`/admin/post-generator/video/${result.project.id}`)
  } catch (error) {
    message.value = apiErrorMessage(error, 'Project aanmaken is niet gelukt.')
  } finally {
    busy.value = ''
  }
}

async function duplicate(project: ProjectSummary) {
  busy.value = project.id
  try {
    await $fetch(`/api/admin/video-projects/${project.id}/duplicate`, { method: 'POST' })
    await refresh()
  } catch (error) {
    message.value = apiErrorMessage(error, 'Project dupliceren is niet gelukt.')
  } finally {
    busy.value = ''
  }
}

async function remove(project: ProjectSummary) {
  if (!confirm(`“${project.name}” verwijderen? Afgeronde exports blijven hieronder beschikbaar.`)) return
  busy.value = project.id
  try {
    await $fetch(`/api/admin/video-projects/${project.id}`, { method: 'DELETE' })
    await refresh()
  } catch (error) {
    message.value = apiErrorMessage(error, 'Project verwijderen is niet gelukt.')
  } finally {
    busy.value = ''
  }
}

async function cancelJob(job: RenderJob) {
  if (!confirm('Deze render annuleren?')) return
  busy.value = job.id
  message.value = ''
  try {
    await $fetch(`/api/admin/post-generator/video/${job.id}/cancel`, { method: 'POST' })
    await refreshQueue()
  } catch (error) {
    message.value = apiErrorMessage(error, 'Render annuleren is niet gelukt.')
  } finally {
    busy.value = ''
  }
}

let timer: ReturnType<typeof setInterval> | null = null
onMounted(() => {
  timer = setInterval(() => {
    if (queue.value?.jobs.some(job => job.status === 'queued' || job.status === 'rendering')) void refreshQueue()
  }, 4000)
})
onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
})

useSeoMeta({ title: 'Video-editor — DJ NightLight', robots: 'noindex, nofollow' })
</script>

<template>
  <div class="page">
    <header class="header">
      <div>
        <p class="crumb">Content / Video-editor</p>
        <h1>Videoprojecten</h1>
        <p class="subtitle">Reels, Stories en terugblikken op een timeline, met NightLight-motion graphics.</p>
      </div>
      <NuxtLink class="secondary" to="/admin/post-generator">Afbeeldingengenerator</NuxtLink>
    </header>

    <form class="create" @submit.prevent="create">
      <input v-model="name" type="text" maxlength="160" placeholder="Projectnaam, bijv. Weekend Vibes" aria-label="Projectnaam">
      <select v-model="aspect" aria-label="Formaat">
        <option v-for="key in VIDEO_ASPECT_KEYS" :key="key" :value="key">{{ VIDEO_ASPECTS[key].label }}</option>
      </select>
      <button class="primary" type="submit" :disabled="busy === 'create'">{{ busy === 'create' ? 'Aanmaken…' : '+ Nieuw project' }}</button>
    </form>
    <p v-if="message" class="message">{{ message }}</p>

    <section class="projects">
      <article v-for="project in data?.projects || []" :key="project.id" class="project">
        <NuxtLink :to="`/admin/post-generator/video/${project.id}`" class="frame" :style="{ aspectRatio: `${project.width} / ${project.height}` }">
          <span>{{ project.aspect }}</span>
        </NuxtLink>
        <div class="meta">
          <NuxtLink :to="`/admin/post-generator/video/${project.id}`"><strong>{{ project.name }}</strong></NuxtLink>
          <small>{{ project.durationSeconds }}s · {{ project.itemCount }} items · bewerkt {{ new Date(project.updatedAt).toLocaleString('nl-NL') }}</small>
        </div>
        <div class="actions">
          <NuxtLink :to="`/admin/post-generator/video/${project.id}`">Openen</NuxtLink>
          <button type="button" :disabled="busy === project.id" @click="duplicate(project)">Dupliceren</button>
          <button class="with-icon" type="button" :disabled="busy === project.id" @click="remove(project)"><Icon name="lucide:trash-2" aria-hidden="true" />Verwijderen</button>
        </div>
      </article>
      <p v-if="!data?.projects.length" class="empty">Nog geen videoprojecten. Maak er een aan om de editor te openen.</p>
    </section>

    <section class="exports">
      <h2>Rendergeschiedenis</h2>
      <ol>
        <li v-for="job in queue?.jobs || []" :key="job.id">
          <span class="status" :class="job.status">{{ labelFor(renderStatusLabels, job.status) }}{{ job.status === 'rendering' ? ` ${job.progress}%` : '' }}</span>
          <strong>{{ job.projectName || (job.projectId ? 'Videoproject' : 'Oude video') }}</strong>
          <small>{{ job.width }}<IconTimes />{{ job.height }} · {{ job.durationSeconds }}s<template v-if="job.renderEngine"> · {{ job.renderEngine === 'intel' ? 'Intel GPU' : 'CPU' }}</template> · {{ new Date(job.createdAt).toLocaleString('nl-NL') }}</small>
          <a v-if="job.videoUrl" class="with-icon" :href="job.videoUrl" target="_blank" rel="noopener"><Icon name="lucide:play" aria-hidden="true" />MP4 openen</a>
          <button v-if="canCancelRender(job.status)" class="cancel with-icon" type="button" :disabled="busy === job.id" @click="cancelJob(job)"><Icon name="lucide:circle-x" aria-hidden="true" />Annuleren</button>
        </li>
        <li v-if="!queue?.jobs.length" class="empty">Nog niets gerenderd.</li>
      </ol>
    </section>
  </div>
</template>

<style scoped>
.page {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 1280px;
  margin: 0 auto;
}

.header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.crumb, .subtitle, small {
  margin: 0;
  color: #918999;
}

h1 {
  margin: .2rem 0;
  font-size: clamp(2rem, 5vw, 3.4rem);
  letter-spacing: -.04em;
}

h2 { margin: 0 0 .8rem; }

.create {
  display: flex;
  flex-wrap: wrap;
  gap: .6rem;
}

.create input, .create select {
  padding: .7rem .9rem;
  border: 1px solid #2c2732;
  border-radius: .7rem;
  background: #121016;
  color: #f7f7fa;
}

.create input { flex: 1 1 260px; }

.primary, .secondary {
  padding: .7rem 1.1rem;
  border: 0;
  border-radius: .7rem;
  background: #7c3aed;
  color: #fff;
  font-weight: 700;
  text-decoration: none;
  cursor: pointer;
}

.secondary {
  border: 1px solid #2c2732;
  background: #121016;
}

.message { color: #fca5a5; }

.projects {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
  gap: 1rem;
}

.project {
  display: flex;
  flex-direction: column;
  gap: .6rem;
  padding: .8rem;
  border: 1px solid #2c2732;
  border-radius: 1rem;
  background: #121016;
}

.frame {
  display: grid;
  max-height: 260px;
  place-items: center;
  border-radius: .6rem;
  background: radial-gradient(circle at 30% 20%, rgba(124, 58, 237, .5), transparent 60%), #0c0a10;
  color: #d8b4fe;
  font-weight: 900;
  text-decoration: none;
}

.meta {
  display: flex;
  flex-direction: column;
  gap: .2rem;
}

.meta a {
  color: inherit;
  text-decoration: none;
}

.actions {
  display: flex;
  gap: .8rem;
  font-size: .85rem;
}

.actions a, .actions button {
  padding: 0;
  border: 0;
  background: none;
  color: #c4b5fd;
  cursor: pointer;
  text-decoration: none;
}

.empty { color: #918999; }

.exports ol {
  display: flex;
  flex-direction: column;
  gap: .4rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.exports li {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .8rem;
  padding: .7rem .9rem;
  border: 1px solid #2c2732;
  border-radius: .7rem;
  background: #121016;
}

.exports a { color: #c4b5fd; }

.exports .cancel {
  margin-left: auto;
  padding: 0;
  border: 0;
  background: none;
  color: #fca5a5;
  cursor: pointer;
}

.status {
  min-width: 90px;
  color: #918999;
  font-size: .8rem;
  text-transform: capitalize;
}

.status.completed { color: #4ade80; }
.status.failed { color: #f87171; }
</style>
