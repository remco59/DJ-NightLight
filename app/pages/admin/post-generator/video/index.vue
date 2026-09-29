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
  createdAt: string
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

type ProjectSort = 'updated' | 'newest' | 'oldest' | 'name'

const { data, refresh } = await useFetch<{ projects: ProjectSummary[] }>('/api/admin/video-projects')
const { data: queue, refresh: refreshQueue } = await useFetch<{ jobs: RenderJob[] }>('/api/admin/post-generator/video')

const name = ref('')
const aspect = ref<VideoAspect>('9:16')
const busy = ref('')
const message = ref('')
const search = ref('')
const aspectFilter = ref<'all' | VideoAspect>('all')
const sort = ref<ProjectSort>('updated')
const showCreate = ref(false)
const showAllRenders = ref(false)

const filteredProjects = computed(() => {
  const query = search.value.trim().toLocaleLowerCase('nl-NL')
  const projects = [...(data.value?.projects || [])].filter((project) => {
    if (aspectFilter.value !== 'all' && project.aspect !== aspectFilter.value) return false
    if (query && !project.name.toLocaleLowerCase('nl-NL').includes(query)) return false
    return true
  })

  return projects.sort((a, b) => {
    if (sort.value === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    if (sort.value === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    if (sort.value === 'name') return a.name.localeCompare(b.name, 'nl-NL', { sensitivity: 'base' })
    return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  })
})

const latestJobs = computed(() => {
  const latest = new Map<string, RenderJob>()
  for (const job of queue.value?.jobs || []) {
    if (!job.projectId || latest.has(job.projectId)) continue
    latest.set(job.projectId, job)
  }
  return latest
})

const visibleRenders = computed(() => {
  const jobs = queue.value?.jobs || []
  return showAllRenders.value ? jobs : jobs.slice(0, 4)
})

function latestJob(project: ProjectSummary) {
  return latestJobs.value.get(project.id)
}

function projectStatus(job: RenderJob | undefined) {
  if (!job) return null
  if (job.status === 'completed') return { label: 'Klaar', className: 'completed' }
  if (job.status === 'rendering') return { label: `Rendering ${job.progress}%`, className: 'rendering' }
  if (job.status === 'queued') return { label: 'In wachtrij', className: 'queued' }
  if (job.status === 'failed') return { label: 'Render mislukt', className: 'failed' }
  return { label: 'Geannuleerd', className: 'cancelled' }
}

function formatDate(value: string) {
  return new Date(value).toLocaleString('nl-NL', {
    day: 'numeric',
    month: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function openCreate() {
  message.value = ''
  showCreate.value = true
  nextTick(() => document.querySelector<HTMLInputElement>('#video-project-name')?.focus())
}

function closeCreate() {
  if (busy.value === 'create') return
  showCreate.value = false
}

async function create() {
  busy.value = 'create'
  message.value = ''
  try {
    const result = await $fetch<{ project: { id: string } }>('/api/admin/video-projects', {
      method: 'POST',
      body: { name: name.value, aspect: aspect.value },
    })
    showCreate.value = false
    await navigateTo(`/admin/post-generator/video/${result.project.id}`)
  } catch (error) {
    message.value = apiErrorMessage(error, 'Project aanmaken is niet gelukt.')
  } finally {
    busy.value = ''
  }
}

async function duplicate(project: ProjectSummary) {
  busy.value = project.id
  message.value = ''
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
  message.value = ''
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
        <p class="subtitle">Reels, Stories en terugblikken op een timeline, met NightLight motion graphics.</p>
      </div>

      <nav class="mode-switch" aria-label="Generator kiezen">
        <NuxtLink to="/admin/post-generator" class="mode-option">
          <Icon name="lucide:image" aria-hidden="true" />
          Afbeeldingen
        </NuxtLink>
        <span class="mode-option active" aria-current="page">
          <Icon name="lucide:video" aria-hidden="true" />
          Video
        </span>
      </nav>
    </header>

    <section class="toolbar" aria-label="Videoprojecten filteren">
      <label class="search-control">
        <Icon name="lucide:search" aria-hidden="true" />
        <input
          v-model="search"
          type="search"
          placeholder="Zoek projecten, bijvoorbeeld 'Weekend Vibes'..."
          aria-label="Zoek projecten"
        >
      </label>

      <label class="select-control">
        <span class="sr-only">Formaat</span>
        <select v-model="aspectFilter" aria-label="Filter op formaat">
          <option value="all">Alle formaten</option>
          <option v-for="key in VIDEO_ASPECT_KEYS" :key="key" :value="key">{{ VIDEO_ASPECTS[key].label }}</option>
        </select>
      </label>

      <label class="select-control sort-control">
        <Icon name="lucide:arrow-up-down" aria-hidden="true" />
        <span class="sr-only">Sortering</span>
        <select v-model="sort" aria-label="Sorteer projecten">
          <option value="updated">Laatst bewerkt</option>
          <option value="newest">Nieuwste</option>
          <option value="oldest">Oudste</option>
          <option value="name">Naam A-Z</option>
        </select>
      </label>

      <button class="primary new-project-button" type="button" @click="openCreate">
        <Icon name="lucide:plus" aria-hidden="true" />
        Nieuw project
      </button>
    </section>

    <p v-if="message" class="message" role="status">{{ message }}</p>

    <section class="projects" aria-label="Videoprojecten">
      <article v-for="project in filteredProjects" :key="project.id" class="project">
        <NuxtLink
          :to="`/admin/post-generator/video/${project.id}`"
          class="frame"
          :aria-label="`${project.name} openen`"
        >
          <span class="frame-glow" aria-hidden="true" />
          <span class="aspect-badge">{{ project.aspect }}</span>
          <span
            v-if="projectStatus(latestJob(project))"
            class="project-status"
            :class="projectStatus(latestJob(project))?.className"
          >
            <span class="status-dot" aria-hidden="true" />
            {{ projectStatus(latestJob(project))?.label }}
          </span>
          <span class="preview-mark" aria-hidden="true">
            <Icon name="lucide:clapperboard" />
          </span>
        </NuxtLink>

        <div class="project-body">
          <NuxtLink :to="`/admin/post-generator/video/${project.id}`" class="project-title">
            {{ project.name }}
          </NuxtLink>

          <div class="project-meta">
            <span><Icon name="lucide:layers-3" aria-hidden="true" />{{ project.itemCount }} items</span>
            <span>{{ project.durationSeconds }}s</span>
            <span>{{ project.width }} × {{ project.height }}</span>
          </div>

          <p class="edited">
            <Icon name="lucide:calendar-days" aria-hidden="true" />
            Laatst bewerkt {{ formatDate(project.updatedAt) }}
          </p>

          <div class="card-actions">
            <NuxtLink class="open-project" :to="`/admin/post-generator/video/${project.id}`">
              <Icon name="lucide:play" aria-hidden="true" />
              Open project
            </NuxtLink>

            <details class="more-menu">
              <summary aria-label="Meer acties" title="Meer acties">
                <Icon name="lucide:ellipsis" aria-hidden="true" />
              </summary>
              <div class="menu-popover">
                <button type="button" :disabled="busy === project.id" @click="duplicate(project)">
                  <Icon name="lucide:copy" aria-hidden="true" />
                  Dupliceren
                </button>
                <button class="danger" type="button" :disabled="busy === project.id" @click="remove(project)">
                  <Icon name="lucide:trash-2" aria-hidden="true" />
                  Verwijderen
                </button>
              </div>
            </details>
          </div>
        </div>
      </article>

      <button class="new-project-card" type="button" @click="openCreate">
        <span class="new-project-inner">
          <span class="new-project-icon"><Icon name="lucide:plus" aria-hidden="true" /></span>
          <strong>Nieuw project</strong>
          <span>Maak een nieuw videoproject met onze templates en motion graphics.</span>
        </span>
      </button>
    </section>

    <div v-if="!filteredProjects.length && (search || aspectFilter !== 'all')" class="empty filtered-empty">
      <Icon name="lucide:search-x" aria-hidden="true" />
      <strong>Geen projecten gevonden</strong>
      <span>Pas je zoekterm of formaatfilter aan.</span>
    </div>

    <section class="exports">
      <div class="exports-header">
        <h2>Recente renders</h2>
        <button
          v-if="(queue?.jobs.length || 0) > 4"
          class="all-renders"
          type="button"
          @click="showAllRenders = !showAllRenders"
        >
          {{ showAllRenders ? 'Minder renders tonen' : 'Alle renders bekijken' }}
          <Icon :name="showAllRenders ? 'lucide:chevron-up' : 'lucide:arrow-right'" aria-hidden="true" />
        </button>
      </div>

      <ol class="render-list">
        <li v-for="job in visibleRenders" :key="job.id" class="render-row" :class="{ failed: job.status === 'failed' }">
          <span class="render-status status" :class="job.status">
            <span class="status-dot" aria-hidden="true" />
            {{ job.status === 'completed' ? 'Klaar' : labelFor(renderStatusLabels, job.status) }}{{ job.status === 'rendering' ? ` ${job.progress}%` : '' }}
          </span>

          <strong class="render-name">{{ job.projectName || (job.projectId ? 'Videoproject' : 'Oude video') }}</strong>

          <small class="render-specs">
            {{ job.width }} × {{ job.height }} · {{ job.durationSeconds }}s
            <template v-if="job.renderEngine"> · {{ job.renderEngine === 'intel' ? 'Intel GPU' : 'CPU' }}</template>
          </small>

          <time class="render-time" :datetime="job.createdAt">{{ formatDate(job.createdAt) }}</time>

          <a v-if="job.videoUrl" class="render-open" :href="job.videoUrl" target="_blank" rel="noopener">
            <Icon name="lucide:play" aria-hidden="true" />
            MP4 openen
          </a>

          <button
            v-if="canCancelRender(job.status)"
            class="render-cancel"
            type="button"
            :disabled="busy === job.id"
            @click="cancelJob(job)"
          >
            <Icon name="lucide:circle-x" aria-hidden="true" />
            Annuleren
          </button>
        </li>

        <li v-if="!queue?.jobs.length" class="empty render-empty">Nog niets gerenderd.</li>
      </ol>
    </section>

    <div v-if="showCreate" class="modal-backdrop" role="presentation" @click.self="closeCreate">
      <section class="create-modal" role="dialog" aria-modal="true" aria-labelledby="create-title">
        <header>
          <div>
            <p class="crumb">Video-editor</p>
            <h2 id="create-title">Nieuw videoproject</h2>
          </div>
          <button type="button" class="modal-close" aria-label="Sluiten" @click="closeCreate">
            <Icon name="lucide:x" aria-hidden="true" />
          </button>
        </header>

        <form class="create-form" @submit.prevent="create">
          <label>
            <span>Projectnaam</span>
            <input
              id="video-project-name"
              v-model="name"
              type="text"
              maxlength="160"
              placeholder="Bijv. Weekend Vibes"
              required
            >
          </label>

          <label>
            <span>Formaat</span>
            <select v-model="aspect">
              <option v-for="key in VIDEO_ASPECT_KEYS" :key="key" :value="key">{{ VIDEO_ASPECTS[key].label }}</option>
            </select>
          </label>

          <div class="modal-actions">
            <button type="button" class="secondary-button" :disabled="busy === 'create'" @click="closeCreate">Annuleren</button>
            <button class="primary" type="submit" :disabled="busy === 'create'">
              <Icon name="lucide:plus" aria-hidden="true" />
              {{ busy === 'create' ? 'Aanmaken…' : 'Project aanmaken' }}
            </button>
          </div>
        </form>
      </section>
    </div>
  </div>
</template>

<style scoped>
.page {
  width: min(100%, 1600px);
  margin: 0 auto;
  display: flex;
  flex-direction: column;
  gap: 1.4rem;
}

.header {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1.25rem;
}

.crumb,
.subtitle,
small {
  margin: 0;
  color: #918999;
}

.crumb {
  font-size: .85rem;
}

h1 {
  margin: .25rem 0 .15rem;
  font-size: clamp(2.15rem, 4vw, 3.35rem);
  letter-spacing: -.045em;
  line-height: 1;
}

h2 {
  margin: 0;
}

.mode-switch {
  display: inline-flex;
  padding: .25rem;
  border: 1px solid #332d3b;
  border-radius: .8rem;
  background: #121016;
}

.mode-option {
  display: inline-flex;
  align-items: center;
  gap: .5rem;
  padding: .65rem 1rem;
  border-radius: .6rem;
  color: #aaa2b2;
  text-decoration: none;
  font-size: .9rem;
  font-weight: 700;
}

.mode-option.active {
  background: linear-gradient(135deg, #6d28d9, #7c3aed);
  color: #fff;
  box-shadow: 0 6px 24px rgba(124, 58, 237, .2);
}

.toolbar {
  display: grid;
  grid-template-columns: minmax(260px, 1fr) minmax(150px, 185px) minmax(160px, 210px) auto;
  gap: .7rem;
  align-items: stretch;
}

.search-control,
.select-control {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: .65rem;
  padding: 0 .9rem;
  border: 1px solid #2c2732;
  border-radius: .8rem;
  background: #121016;
  color: #9f97a7;
}

.search-control:focus-within,
.select-control:focus-within {
  border-color: #6d4aa8;
  box-shadow: 0 0 0 3px rgba(124, 58, 237, .1);
}

.search-control input,
.select-control select {
  width: 100%;
  min-width: 0;
  border: 0;
  outline: 0;
  background: transparent;
  color: #f7f7fa;
  font: inherit;
}

.search-control input::placeholder {
  color: #746d7c;
}

.select-control select {
  cursor: pointer;
}

.select-control select option {
  background: #151219;
  color: #fff;
}

.primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .5rem;
  padding: .75rem 1.1rem;
  border: 0;
  border-radius: .75rem;
  background: linear-gradient(135deg, #6d28d9, #8b3cf2);
  color: #fff;
  font-weight: 800;
  text-decoration: none;
  cursor: pointer;
  box-shadow: 0 8px 28px rgba(124, 58, 237, .16);
}

.primary:hover:not(:disabled) {
  filter: brightness(1.08);
}

.primary:disabled,
button:disabled {
  cursor: not-allowed;
  opacity: .55;
}

.new-project-button {
  min-width: 175px;
}

.message {
  margin: -.5rem 0 0;
  color: #fca5a5;
}

.projects {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: .85rem;
}

.project {
  min-width: 0;
  overflow: visible;
  border: 1px solid #2d2833;
  border-radius: 1rem;
  background: linear-gradient(180deg, #151219 0%, #121016 100%);
  transition: transform .18s ease, border-color .18s ease, box-shadow .18s ease;
}

.project:hover {
  transform: translateY(-2px);
  border-color: #43374f;
  box-shadow: 0 16px 36px rgba(0, 0, 0, .2);
}

.frame {
  position: relative;
  isolation: isolate;
  min-height: 280px;
  display: grid;
  place-items: center;
  overflow: hidden;
  border-radius: calc(1rem - 1px) calc(1rem - 1px) 0 0;
  background:
    linear-gradient(180deg, transparent 48%, rgba(8, 6, 11, .86) 100%),
    radial-gradient(circle at 75% 20%, rgba(220, 80, 255, .35), transparent 34%),
    radial-gradient(circle at 22% 25%, rgba(255, 120, 35, .26), transparent 30%),
    linear-gradient(145deg, #23152e 0%, #110d16 58%, #1c0d29 100%);
  color: #fff;
  text-decoration: none;
}

.frame::before,
.frame::after {
  content: "";
  position: absolute;
  z-index: -1;
  width: 55%;
  height: 145%;
  top: -20%;
  border-radius: 50%;
  filter: blur(24px);
  opacity: .5;
}

.frame::before {
  left: -22%;
  background: linear-gradient(180deg, rgba(250, 115, 45, .35), transparent);
  transform: rotate(19deg);
}

.frame::after {
  right: -24%;
  background: linear-gradient(180deg, rgba(124, 58, 237, .5), transparent);
  transform: rotate(-18deg);
}

.frame-glow {
  position: absolute;
  inset: 0;
  background:
    repeating-linear-gradient(105deg, transparent 0 52px, rgba(255,255,255,.018) 54px 55px),
    linear-gradient(90deg, transparent, rgba(255,255,255,.025), transparent);
}

.aspect-badge,
.project-status {
  position: absolute;
  top: .8rem;
  z-index: 2;
  display: inline-flex;
  align-items: center;
  gap: .35rem;
  padding: .33rem .55rem;
  border: 1px solid rgba(255,255,255,.14);
  border-radius: .55rem;
  background: rgba(9, 7, 12, .72);
  backdrop-filter: blur(10px);
  font-size: .74rem;
  font-weight: 800;
}

.aspect-badge {
  left: .8rem;
}

.project-status {
  right: .8rem;
}

.status-dot {
  width: .45rem;
  height: .45rem;
  flex: 0 0 .45rem;
  border-radius: 50%;
  background: currentColor;
  box-shadow: 0 0 10px currentColor;
}

.project-status.completed,
.status.completed {
  color: #4ade80;
}

.project-status.rendering,
.status.rendering {
  color: #c4b5fd;
}

.project-status.queued,
.status.queued {
  color: #fbbf24;
}

.project-status.failed,
.status.failed {
  color: #f87171;
}

.project-status.cancelled,
.status.cancelled {
  color: #8d8792;
}

.preview-mark {
  display: grid;
  place-items: center;
  width: 4.6rem;
  height: 4.6rem;
  border: 1px solid rgba(255,255,255,.08);
  border-radius: 1.1rem;
  background: rgba(10, 8, 13, .28);
  color: rgba(255,255,255,.22);
  font-size: 2.15rem;
  backdrop-filter: blur(5px);
}

.project-body {
  display: flex;
  flex-direction: column;
  gap: .62rem;
  padding: .9rem;
}

.project-title {
  overflow: hidden;
  color: #f7f7fa;
  font-size: 1.02rem;
  font-weight: 800;
  text-decoration: none;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.project-title:hover {
  color: #d8c8ff;
}

.project-meta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: .35rem .6rem;
  color: #aaa2b2;
  font-size: .78rem;
}

.project-meta span {
  display: inline-flex;
  align-items: center;
  gap: .3rem;
}

.project-meta span + span::before {
  content: "·";
  margin-right: .25rem;
  color: #5e5865;
}

.edited {
  display: flex;
  align-items: center;
  gap: .45rem;
  margin: 0;
  color: #8f8796;
  font-size: .78rem;
}

.card-actions {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: .55rem;
  padding-top: .1rem;
}

.open-project {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .45rem;
  min-height: 42px;
  border-radius: .65rem;
  background: linear-gradient(135deg, #6d28d9, #8b3cf2);
  color: #fff;
  font-size: .85rem;
  font-weight: 800;
  text-decoration: none;
}

.more-menu {
  position: relative;
}

.more-menu summary {
  min-width: 42px;
  height: 42px;
  display: grid;
  place-items: center;
  border: 1px solid #302a37;
  border-radius: .65rem;
  background: #18141d;
  color: #b8afc0;
  cursor: pointer;
  list-style: none;
}

.more-menu summary::-webkit-details-marker {
  display: none;
}

.more-menu[open] summary {
  border-color: #604786;
  color: #fff;
}

.menu-popover {
  position: absolute;
  z-index: 10;
  right: 0;
  bottom: calc(100% + .45rem);
  min-width: 165px;
  padding: .35rem;
  border: 1px solid #332d3b;
  border-radius: .75rem;
  background: #17131b;
  box-shadow: 0 18px 42px rgba(0,0,0,.35);
}

.menu-popover button {
  width: 100%;
  display: flex;
  align-items: center;
  gap: .55rem;
  padding: .65rem .7rem;
  border: 0;
  border-radius: .5rem;
  background: transparent;
  color: #ddd7e2;
  font: inherit;
  font-size: .85rem;
  text-align: left;
  cursor: pointer;
}

.menu-popover button:hover:not(:disabled) {
  background: #211b28;
}

.menu-popover .danger {
  color: #fca5a5;
}

.new-project-card {
  min-height: 100%;
  padding: .7rem;
  border: 1px solid #332d3b;
  border-radius: 1rem;
  background:
    radial-gradient(circle at 80% 16%, rgba(124,58,237,.16), transparent 42%),
    #121016;
  color: inherit;
  cursor: pointer;
}

.new-project-inner {
  min-height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: .8rem;
  padding: 2rem 1.3rem;
  border: 1px dashed #7448b4;
  border-radius: .75rem;
  color: #a9a0b2;
  text-align: center;
}

.new-project-card:hover .new-project-inner {
  border-color: #9b65eb;
  background: rgba(124,58,237,.045);
}

.new-project-inner strong {
  color: #f7f7fa;
  font-size: 1.05rem;
}

.new-project-inner > span:last-child {
  max-width: 220px;
  font-size: .86rem;
  line-height: 1.5;
}

.new-project-icon {
  width: 4.5rem;
  height: 4.5rem;
  display: grid;
  place-items: center;
  border: 1px solid #7c3aed;
  border-radius: 50%;
  color: #c4b5fd;
  font-size: 1.6rem;
  box-shadow: inset 0 0 24px rgba(124,58,237,.1);
}

.empty {
  color: #918999;
}

.filtered-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: .35rem;
  padding: 2rem;
  border: 1px dashed #312b36;
  border-radius: .9rem;
  text-align: center;
}

.filtered-empty strong {
  color: #d8d1dd;
}

.exports {
  display: flex;
  flex-direction: column;
  gap: .7rem;
  padding-top: .2rem;
}

.exports-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
}

.exports-header h2 {
  font-size: 1.25rem;
}

.all-renders {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: #a78bfa;
  font: inherit;
  font-size: .82rem;
  font-weight: 700;
  cursor: pointer;
}

.render-list {
  display: flex;
  flex-direction: column;
  gap: .35rem;
  margin: 0;
  padding: 0;
  list-style: none;
}

.render-row {
  display: grid;
  grid-template-columns: minmax(95px, 120px) minmax(170px, 1fr) minmax(210px, 1fr) minmax(145px, auto) auto;
  align-items: center;
  gap: .8rem;
  min-height: 48px;
  padding: .65rem .8rem;
  border: 1px solid #29242f;
  border-radius: .7rem;
  background: #111015;
}

.render-row.failed {
  border-color: rgba(248,113,113,.3);
  background: linear-gradient(90deg, rgba(127,29,29,.08), #111015 28%);
}

.render-status {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  font-size: .75rem;
  font-weight: 800;
}

.render-name {
  min-width: 0;
  overflow: hidden;
  color: #e9e4ec;
  font-size: .83rem;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.render-specs,
.render-time {
  color: #827b89;
  font-size: .75rem;
}

.render-time {
  white-space: nowrap;
}

.render-open,
.render-cancel {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  padding: 0;
  border: 0;
  background: transparent;
  color: #b9a4ff;
  font: inherit;
  font-size: .78rem;
  font-weight: 700;
  text-decoration: none;
  white-space: nowrap;
  cursor: pointer;
}

.render-cancel {
  color: #fca5a5;
}

.render-empty {
  padding: 1rem;
  border: 1px dashed #2a2530;
  border-radius: .7rem;
}

.modal-backdrop {
  position: fixed;
  z-index: 100;
  inset: 0;
  display: grid;
  place-items: center;
  padding: 1.25rem;
  background: rgba(5, 4, 7, .74);
  backdrop-filter: blur(8px);
}

.create-modal {
  width: min(100%, 480px);
  border: 1px solid #3a3142;
  border-radius: 1rem;
  background: #151219;
  box-shadow: 0 28px 80px rgba(0,0,0,.55);
}

.create-modal > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.15rem 1.2rem;
  border-bottom: 1px solid #2a2530;
}

.create-modal h2 {
  margin-top: .15rem;
  font-size: 1.25rem;
}

.modal-close {
  width: 38px;
  height: 38px;
  display: grid;
  place-items: center;
  border: 1px solid #302a37;
  border-radius: .6rem;
  background: #18141d;
  color: #bbb2c3;
  cursor: pointer;
}

.create-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  padding: 1.2rem;
}

.create-form label {
  display: flex;
  flex-direction: column;
  gap: .45rem;
  color: #b8b0bf;
  font-size: .86rem;
  font-weight: 700;
}

.create-form input,
.create-form select {
  min-height: 46px;
  padding: .7rem .85rem;
  border: 1px solid #332d3b;
  border-radius: .7rem;
  outline: 0;
  background: #0f0d12;
  color: #fff;
  font: inherit;
}

.create-form input:focus,
.create-form select:focus {
  border-color: #7654a8;
  box-shadow: 0 0 0 3px rgba(124,58,237,.1);
}

.modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: .6rem;
  padding-top: .2rem;
}

.secondary-button {
  padding: .75rem 1rem;
  border: 1px solid #332d3b;
  border-radius: .7rem;
  background: #18141d;
  color: #d5ceda;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

.sr-only {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
}

@media (max-width: 1280px) {
  .projects {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }

  .toolbar {
    grid-template-columns: minmax(240px, 1fr) minmax(150px, 190px) minmax(160px, 200px);
  }

  .new-project-button {
    grid-column: 3;
  }
}

@media (max-width: 980px) {
  .projects {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .toolbar {
    grid-template-columns: minmax(0, 1fr) minmax(150px, 190px);
  }

  .search-control {
    grid-column: 1 / -1;
  }

  .new-project-button {
    grid-column: auto;
  }

  .render-row {
    grid-template-columns: 110px 1fr auto;
  }

  .render-specs {
    grid-column: 2;
  }

  .render-time {
    grid-column: 2;
  }

  .render-open,
  .render-cancel {
    grid-column: 3;
    grid-row: 1 / span 3;
  }
}

@media (max-width: 680px) {
  .header {
    align-items: stretch;
  }

  .mode-switch {
    width: 100%;
  }

  .mode-option {
    flex: 1;
    justify-content: center;
  }

  .toolbar {
    grid-template-columns: 1fr;
  }

  .search-control,
  .new-project-button {
    grid-column: auto;
  }

  .projects {
    grid-template-columns: 1fr;
  }

  .frame {
    min-height: 250px;
  }

  .render-row {
    grid-template-columns: 1fr auto;
    gap: .45rem .7rem;
  }

  .render-status,
  .render-name,
  .render-specs,
  .render-time {
    grid-column: 1;
  }

  .render-open,
  .render-cancel {
    grid-column: 2;
    grid-row: 1 / span 4;
  }

  .exports-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .modal-actions {
    flex-direction: column-reverse;
  }

  .modal-actions > * {
    width: 100%;
  }
}
</style>
