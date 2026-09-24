<script setup lang="ts">
import PostRangeField from '~/components/post-editor/PostRangeField.vue'
import PostTemplateCard from '~/components/post-editor/PostTemplateCard.vue'
import { usePostEditor, POST_IMAGE_TYPES, type PostEditorTool } from '~/composables/usePostEditor'
import { postTemplateInfo, type PostFieldVisibility, type PostTextField } from '~~/shared/post-generator'

const props = defineProps<{
  thumbnails: Record<string, string>
  /** Tool the current canvas selection belongs to, hinted on its tab. */
  hint: PostEditorTool | null
}>()

const emit = defineEmits<{
  'browse-templates': []
  'browse-media': []
}>()

const tool = defineModel<PostEditorTool>('tool', { required: true })
const collapsed = defineModel<boolean>('collapsed', { default: false })

const editor = usePostEditor()
const { design, busy, templates, brands } = editor

const tabs: Array<{ key: PostEditorTool, label: string, icon: string }> = [
  { key: 'media', label: 'Media', icon: 'lucide:image' },
  { key: 'template', label: 'Template', icon: 'lucide:layout-template' },
  { key: 'text', label: 'Tekst', icon: 'lucide:type' },
  { key: 'design', label: 'Ontwerp', icon: 'lucide:palette' },
  { key: 'effects', label: 'Effecten', icon: 'lucide:sparkles' },
]

const QUICK_TEMPLATE_COUNT = 4
const MEDIA_GRID_COUNT = 8

const bodyRef = ref<HTMLElement | null>(null)
const tabRefs = ref<HTMLButtonElement[]>([])
const fileInput = ref<HTMLInputElement | null>(null)
const dropActive = ref(false)
const mediaView = ref<'library' | 'recent'>('library')

const template = computed(() => postTemplateInfo(design.templateKey))
const usesField = (field: PostTextField) => template.value.fields.includes(field)

/** The selected template plus the first others, so the quick list stays short. */
const quickTemplates = computed(() => {
  const others = templates.filter(item => item.key !== design.templateKey)
  return [template.value, ...others.slice(0, QUICK_TEMPLATE_COUNT - 1)]
    .sort((a, b) => templates.indexOf(a) - templates.indexOf(b))
})

const mediaItems = computed(() => {
  const source = mediaView.value === 'recent' ? editor.recentAssets.value : editor.assets.value
  const items = source.slice(0, MEDIA_GRID_COUNT)
  // Keep the selected photo visible even when it is further down the library.
  const selected = editor.selectedAsset.value
  if (mediaView.value === 'library' && selected && !items.some(item => item.id === selected.id)) {
    items.splice(items.length - 1, 1, selected)
  }
  return items
})

const textFields: Array<{
  field: Exclude<PostTextField, 'gigList'>
  key: 'headline' | 'subline' | 'dateText' | 'timeText' | 'locationText' | 'ctaText'
  label: string
  max: number
  placeholder: string
  multiline?: boolean
}> = [
  { field: 'headline', key: 'headline', label: 'Kop', max: 180, placeholder: 'JOUW AVOND. JOUW SOUND.', multiline: true },
  { field: 'subline', key: 'subline', label: 'Ondertitel', max: 260, placeholder: 'DJ NightLight · allround DJ', multiline: true },
  { field: 'date', key: 'dateText', label: 'Datum', max: 160, placeholder: '12 DEC' },
  { field: 'time', key: 'timeText', label: 'Tijd', max: 80, placeholder: '22:00 – 02:00' },
  { field: 'location', key: 'locationText', label: 'Locatie', max: 160, placeholder: 'Groningen' },
  { field: 'cta', key: 'ctaText', label: 'Call to action', max: 180, placeholder: 'TOT DAN!' },
]

const fieldLabels: Record<PostTextField, string> = {
  headline: 'Kop',
  subline: 'Ondertitel',
  date: 'Datum',
  time: 'Tijd',
  location: 'Locatie',
  cta: 'Call to action',
  gigList: 'Giglijst',
}

const alignOptions = [
  { key: 'left', label: 'Links uitlijnen', icon: 'lucide:align-left' },
  { key: 'center', label: 'Centreren', icon: 'lucide:align-center' },
  { key: 'right', label: 'Rechts uitlijnen', icon: 'lucide:align-right' },
] as const

const positionOptions = [
  { key: 'top', label: 'Boven' },
  { key: 'middle', label: 'Midden' },
  { key: 'bottom', label: 'Onder' },
] as const

function selectTool(key: PostEditorTool) {
  if (tool.value !== key) bodyRef.value?.scrollTo({ top: 0 })
  tool.value = key
  collapsed.value = false
}

// Arrow keys move between tabs, as in any tablist.
function onTabKey(event: KeyboardEvent, index: number) {
  const direction = event.key === 'ArrowRight' || event.key === 'ArrowDown' ? 1 : event.key === 'ArrowLeft' || event.key === 'ArrowUp' ? -1 : 0
  let next = direction ? (index + direction + tabs.length) % tabs.length : -1
  if (event.key === 'Home') next = 0
  if (event.key === 'End') next = tabs.length - 1
  if (next < 0) return
  event.preventDefault()
  selectTool(tabs[next]!.key)
  tabRefs.value[next]?.focus()
}

function visibilityKey(field: Exclude<PostTextField, 'gigList'>): keyof PostFieldVisibility {
  return field
}

async function uploadFile(file: File | null | undefined) {
  if (!file) return
  await editor.uploadSource(file)
  if (fileInput.value) fileInput.value.value = ''
}

function onDrop(event: DragEvent) {
  dropActive.value = false
  const file = event.dataTransfer?.files?.[0]
  if (file && !POST_IMAGE_TYPES.includes(file.type)) {
    editor.message.value = 'Kies een JPEG-, PNG- of WebP-afbeelding.'
    return
  }
  void uploadFile(file)
}
</script>

<template>
  <aside class="inspector" :class="{ collapsed }" aria-label="Inspector">
    <div class="tool-tabs" role="tablist" aria-label="Editorgereedschap" :aria-orientation="collapsed ? 'vertical' : 'horizontal'">
      <button
        v-for="(tab, index) in tabs"
        :id="'post-tool-tab-' + tab.key"
        :key="tab.key"
        ref="tabRefs"
        type="button"
        role="tab"
        class="tool-tab"
        :class="{ active: tool === tab.key, hinted: props.hint === tab.key && tool !== tab.key }"
        :aria-selected="tool === tab.key"
        aria-controls="post-tool-panel"
        :tabindex="tool === tab.key ? 0 : -1"
        :title="collapsed ? tab.label : undefined"
        @click="selectTool(tab.key)"
        @keydown="onTabKey($event, index)"
      >
        <Icon :name="tab.icon" aria-hidden="true" />
        <span class="tab-label">{{ tab.label }}</span>
      </button>
    </div>

    <div
      v-show="!collapsed"
      id="post-tool-panel"
      ref="bodyRef"
      class="inspector-body"
      role="tabpanel"
      :aria-labelledby="'post-tool-tab-' + tool"
    >
      <!-- Media -->
      <template v-if="tool === 'media'">
        <section class="group">
          <header class="group-head">
            <div>
              <h2>Bronfoto</h2>
              <p>Upload een clubfoto of kies er een uit je mediabibliotheek.</p>
            </div>
          </header>

          <input
            ref="fileInput"
            class="visually-hidden"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            tabindex="-1"
            aria-hidden="true"
            @change="uploadFile(($event.target as HTMLInputElement).files?.[0])"
          >
          <button
            type="button"
            class="upload-zone"
            :class="{ active: dropActive }"
            :disabled="busy === 'upload'"
            @click="fileInput?.click()"
            @dragenter.prevent="dropActive = true"
            @dragover.prevent="dropActive = true"
            @dragleave="dropActive = false"
            @drop.prevent="onDrop"
          >
            <span class="upload-icon"><Icon name="lucide:cloud-upload" aria-hidden="true" /></span>
            <span class="upload-copy">
              <strong>{{ busy === 'upload' ? 'Uploaden…' : 'Foto uploaden' }}</strong>
              <small>Klik om te bladeren of sleep een bestand hierheen · JPEG, PNG, WebP</small>
            </span>
          </button>

          <div class="media-head">
            <div class="sub-tabs" role="group" aria-label="Mediabron">
              <button type="button" :class="{ active: mediaView === 'library' }" :aria-pressed="mediaView === 'library'" @click="mediaView = 'library'">Bibliotheek</button>
              <button type="button" :class="{ active: mediaView === 'recent' }" :aria-pressed="mediaView === 'recent'" @click="mediaView = 'recent'">Recent gebruikt</button>
            </div>
            <button type="button" class="link-button" @click="emit('browse-media')">
              Alles bekijken <Icon name="lucide:arrow-right" aria-hidden="true" />
            </button>
          </div>

          <div v-if="mediaItems.length" class="media-grid">
            <button
              v-for="asset in mediaItems"
              :key="asset.id"
              type="button"
              class="media-option"
              :class="{ active: editor.sourceAssetId.value === asset.id }"
              :aria-pressed="editor.sourceAssetId.value === asset.id"
              :aria-label="asset.title || asset.originalFilename"
              :title="asset.title || asset.originalFilename"
              @click="editor.sourceAssetId.value = asset.id"
            >
              <img :src="asset.thumbnailUrl" alt="" loading="lazy" draggable="false">
              <span v-if="editor.sourceAssetId.value === asset.id" class="media-check" aria-hidden="true"><Icon name="lucide:check" /></span>
            </button>
          </div>
          <p v-else class="empty-note">
            {{ mediaView === 'recent' ? 'Foto’s die je in een export gebruikt, verschijnen hier.' : 'Nog geen foto’s in de mediabibliotheek.' }}
          </p>
        </section>

        <section class="group">
          <header class="group-head">
            <div>
              <h2>Positie foto</h2>
              <p>Sleep de foto op het canvas, of sleep een hoek om te schalen.</p>
            </div>
            <button type="button" class="link-button" @click="editor.resetImagePosition()">
              <Icon name="lucide:rotate-ccw" aria-hidden="true" /> Herstellen
            </button>
          </header>
          <div class="range-stack">
            <PostRangeField v-model="design.zoom" label="Schaal" :min="1" :max="3" :step=".01" />
            <PostRangeField v-model="design.imageX" label="Positie X" :min="-1" :max="1" :step=".01" />
            <PostRangeField v-model="design.imageY" label="Positie Y" :min="-1" :max="1" :step=".01" />
          </div>
        </section>
      </template>

      <!-- Template -->
      <template v-else-if="tool === 'template'">
        <section class="group">
          <header class="group-head">
            <div>
              <h2>Templates</h2>
              <p>Templates bepalen de layout. Je tekst blijft behouden als je wisselt.</p>
            </div>
            <button type="button" class="link-button" @click="emit('browse-templates')">
              Alles bekijken ({{ templates.length }}) <Icon name="lucide:arrow-right" aria-hidden="true" />
            </button>
          </header>

          <div class="template-grid">
            <PostTemplateCard
              v-for="item in quickTemplates"
              :key="item.key"
              :template="item"
              :thumbnail="thumbnails[item.key]"
              :selected="design.templateKey === item.key"
              @select="editor.applyTemplate(item.key)"
            />
          </div>
        </section>

        <section class="group">
          <header class="group-head">
            <div>
              <h2>{{ template.label }}</h2>
              <p>{{ template.description }}</p>
            </div>
            <span class="tag">{{ template.category }}</span>
          </header>
          <dl class="meta-list">
            <div>
              <dt>Tekstvelden</dt>
              <dd>{{ template.fields.map(field => fieldLabels[field]).join(', ') }}</dd>
            </div>
            <div>
              <dt>Tekstopmaak</dt>
              <dd>{{ template.flexibleText ? 'Uitlijning en positie instelbaar' : 'Gecentreerd, bepaald door het template' }}</dd>
            </div>
          </dl>
        </section>
      </template>

      <!-- Text -->
      <template v-else-if="tool === 'text'">
        <section class="group">
          <header class="group-head">
            <div>
              <h2>Tekst</h2>
              <p>Velden die het template {{ template.label }} gebruikt.</p>
            </div>
          </header>

          <div class="field-stack">
            <template v-for="item in textFields" :key="item.key">
              <div v-if="usesField(item.field)" class="text-field">
                <div class="field-head">
                  <label :for="'post-text-' + item.key">{{ item.label }}</label>
                  <span class="field-tools">
                    <small v-if="item.multiline" class="count">{{ design[item.key].length }}/{{ item.max }}</small>
                    <label class="switch">
                      <input v-model="design.visibility[visibilityKey(item.field)]" type="checkbox" role="switch" :aria-label="item.label + ' tonen'">
                      <span aria-hidden="true" />
                    </label>
                  </span>
                </div>
                <textarea
                  v-if="item.multiline"
                  :id="'post-text-' + item.key"
                  v-model="design[item.key]"
                  rows="2"
                  :maxlength="item.max"
                  :placeholder="item.placeholder"
                  :disabled="!design.visibility[visibilityKey(item.field)]"
                />
                <input
                  v-else
                  :id="'post-text-' + item.key"
                  v-model="design[item.key]"
                  :maxlength="item.max"
                  :placeholder="item.placeholder"
                  :disabled="!design.visibility[visibilityKey(item.field)]"
                >
              </div>
            </template>
          </div>
        </section>

        <section v-if="usesField('gigList')" class="group">
          <header class="group-head">
            <div>
              <h2>Aankomende gigs</h2>
              <p>Maximaal zes regels voor het planningstemplate.</p>
            </div>
            <label class="switch">
              <input v-model="design.visibility.gigList" type="checkbox" role="switch" aria-label="Giglijst tonen">
              <span aria-hidden="true" />
            </label>
          </header>

          <div class="gig-rows" :class="{ disabled: !design.visibility.gigList }">
            <div v-for="(item, index) in design.gigItems" :key="index" class="gig-row" role="group" :aria-label="`Gig ${index + 1}`">
              <label class="check-label">
                <input v-model="item.enabled" type="checkbox" :disabled="!design.visibility.gigList">
                Gig {{ index + 1 }}
              </label>
              <button
                type="button"
                class="icon-button small"
                :aria-label="`Gig ${index + 1} verwijderen`"
                title="Verwijderen"
                :disabled="design.gigItems.length <= 1"
                @click="editor.removeGigItem(index)"
              >
                <Icon name="lucide:trash-2" aria-hidden="true" />
              </button>
              <div class="gig-fields">
                <input v-model="item.dateText" maxlength="40" placeholder="06 DEC" :aria-label="`Datum gig ${index + 1}`" :disabled="!design.visibility.gigList || !item.enabled">
                <input v-model="item.title" maxlength="120" placeholder="Eredivisie Dames" :aria-label="`Titel gig ${index + 1}`" :disabled="!design.visibility.gigList || !item.enabled">
                <input v-model="item.locationText" maxlength="120" placeholder="VC Sneek" :aria-label="`Locatie gig ${index + 1}`" :disabled="!design.visibility.gigList || !item.enabled">
              </div>
            </div>
          </div>
          <button type="button" class="ghost-button" :disabled="design.gigItems.length >= 6" @click="editor.addGigItem()">
            <Icon name="lucide:plus" aria-hidden="true" /> Gig toevoegen
          </button>
        </section>

        <section class="group">
          <header class="group-head">
            <div>
              <h2>Tekstopmaak</h2>
              <p v-if="!template.flexibleText">{{ template.label }} centreert de tekst; de uitlijning wordt bepaald door het template.</p>
            </div>
          </header>
          <template v-if="template.flexibleText">
            <div class="option-row">
              <span id="post-align-label" class="option-label">Uitlijning</span>
              <div class="segmented" role="radiogroup" aria-labelledby="post-align-label">
                <button
                  v-for="option in alignOptions"
                  :key="option.key"
                  type="button"
                  role="radio"
                  :aria-checked="design.textAlign === option.key"
                  :aria-label="option.label"
                  :title="option.label"
                  :class="{ active: design.textAlign === option.key }"
                  @click="design.textAlign = option.key"
                >
                  <Icon :name="option.icon" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div class="option-row">
              <span id="post-position-label" class="option-label">Positie</span>
              <div class="segmented" role="radiogroup" aria-labelledby="post-position-label">
                <button
                  v-for="option in positionOptions"
                  :key="option.key"
                  type="button"
                  role="radio"
                  :aria-checked="design.textPosition === option.key"
                  :class="{ active: design.textPosition === option.key }"
                  @click="design.textPosition = option.key"
                >
                  {{ option.label }}
                </button>
              </div>
            </div>
          </template>
        </section>
      </template>

      <!-- Design -->
      <template v-else-if="tool === 'design'">
        <section class="group">
          <header class="group-head">
            <div>
              <h2>Huisstijl</h2>
              <p>Kleuren voor tekst, accenten en panelen.</p>
            </div>
          </header>
          <div class="brand-list" role="radiogroup" aria-label="Huisstijl">
            <button
              v-for="brand in brands"
              :key="brand.key"
              type="button"
              role="radio"
              class="brand-option"
              :class="{ active: design.brandPreset === brand.key }"
              :aria-checked="design.brandPreset === brand.key"
              @click="design.brandPreset = brand.key"
            >
              <span class="swatches" aria-hidden="true">
                <i v-for="color in brand.colors" :key="color" :style="{ background: color }" />
              </span>
              <span class="brand-copy">
                <strong>{{ brand.label }}</strong>
                <small>{{ brand.description }}</small>
              </span>
              <Icon v-if="design.brandPreset === brand.key" class="brand-check" name="lucide:check" aria-hidden="true" />
            </button>
          </div>
          <p v-if="!template.flexibleText && design.brandPreset !== 'night'" class="empty-note">
            De campagne-artwork van {{ template.label }} wordt alleen gebruikt met de NightLight-stijl.
          </p>
        </section>

        <section class="group">
          <header class="group-head">
            <div>
              <h2>Logo</h2>
              <p>Het merklabel bovenaan de post.</p>
            </div>
            <label class="switch">
              <input v-model="design.visibility.logo" type="checkbox" role="switch" aria-label="Logo tonen">
              <span aria-hidden="true" />
            </label>
          </header>
          <div class="text-field">
            <label for="post-logo-text">Merklabel</label>
            <input id="post-logo-text" v-model="design.logoText" maxlength="80" :disabled="!design.visibility.logo">
          </div>
        </section>
      </template>

      <!-- Effects -->
      <template v-else>
        <section class="group">
          <header class="group-head">
            <div>
              <h2>Overlay</h2>
              <p>{{ template.overlay }}</p>
            </div>
          </header>
          <div class="range-stack">
            <PostRangeField v-model="design.overlayOpacity" label="Sterkte" :min="0" :max=".9" :step=".01" />
          </div>
        </section>
        <section class="group">
          <header class="group-head">
            <div>
              <h2>Template-effecten</h2>
              <p>
                {{ template.flexibleText
                  ? 'Fades, kaders en panelen komen uit het template en volgen de sterkte van de overlay.'
                  : 'Campagnetextuur, gloed en penseelaccenten komen uit het template en volgen de sterkte van de overlay.' }}
              </p>
            </div>
          </header>
        </section>
      </template>
    </div>
  </aside>
</template>

<style scoped>
.inspector {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  border: 1px solid #221e27;
  border-radius: 1rem;
  background: #0f0d13;
}

.tool-tabs {
  flex: 0 0 auto;
  display: flex;
  border-bottom: 1px solid #221e27;
}

.tool-tab {
  position: relative;
  flex: 1 1 0;
  display: grid;
  justify-items: center;
  gap: .3rem;
  min-width: 0;
  padding: .8rem 0 .7rem;
  border: 0;
  background: transparent;
  color: #948c9e;
  font-size: .73rem;
  cursor: pointer;
  transition: color .15s ease, background .15s ease;
}

.tool-tab svg {
  font-size: 1.15rem;
}

.tool-tab:hover {
  color: #e6e0ec;
}

.tool-tab.active {
  background: linear-gradient(180deg, rgba(139, 92, 246, .14), transparent);
  color: #fff;
}

.tool-tab.active::after {
  position: absolute;
  right: 18%;
  bottom: -1px;
  left: 18%;
  height: 2px;
  border-radius: 2px;
  background: #9d5cff;
  content: '';
}

.tool-tab.hinted::before {
  position: absolute;
  top: .55rem;
  right: calc(50% - 1rem);
  width: .4rem;
  height: .4rem;
  border-radius: 50%;
  background: #b18cff;
  content: '';
}

.tool-tab:focus-visible {
  outline-offset: -3px;
}

.tab-label {
  overflow: hidden;
  max-width: 100%;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Collapsed: an icon rail that expands again when a tool is picked. */
.inspector.collapsed .tool-tabs {
  flex-direction: column;
  border-bottom: 0;
}

.inspector.collapsed .tool-tab {
  flex: 0 0 auto;
  padding: .85rem .25rem;
}

.inspector.collapsed .tab-label {
  display: none;
}

.inspector.collapsed .tool-tab.active::after {
  top: 20%;
  right: auto;
  bottom: 20%;
  left: 0;
  width: 2px;
  height: auto;
}

.inspector-body {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
  scrollbar-color: #2e2934 transparent;
  scrollbar-width: thin;
}

.group {
  display: grid;
  gap: .9rem;
  padding: 1.1rem 1.1rem 1.25rem;
}

.group + .group {
  border-top: 1px solid #1d1a22;
}

.group-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: .75rem;
}

.group-head h2 {
  margin: 0;
  color: #f4f0f8;
  font-size: .88rem;
  font-weight: 700;
}

.group-head p {
  margin: .2rem 0 0;
  color: #7f7888;
  font-size: .74rem;
  line-height: 1.45;
}

.link-button {
  display: inline-flex;
  flex: 0 0 auto;
  align-items: center;
  gap: .3rem;
  padding: .15rem 0;
  border: 0;
  background: transparent;
  color: #b18cff;
  font-size: .74rem;
  cursor: pointer;
}

.link-button:hover {
  color: #d4c0ff;
}

.tag {
  flex: 0 0 auto;
  padding: .2rem .5rem;
  border-radius: 999px;
  background: #1c1822;
  color: #a89fb2;
  font-size: .66rem;
}

.visually-hidden {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  white-space: nowrap;
}

/* Media */

.upload-zone {
  display: flex;
  align-items: center;
  gap: .85rem;
  width: 100%;
  padding: .9rem;
  border: 1px dashed #6d4bb0;
  border-radius: .8rem;
  background: rgba(124, 58, 237, .07);
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition: background .15s ease, border-color .15s ease;
}

.upload-zone:hover,
.upload-zone.active {
  border-color: #a47bff;
  background: rgba(124, 58, 237, .14);
}

.upload-zone:disabled {
  cursor: progress;
  opacity: .7;
}

.upload-icon {
  display: grid;
  flex: 0 0 2.6rem;
  height: 2.6rem;
  place-items: center;
  border-radius: .65rem;
  background: #7c3aed;
  color: #fff;
  font-size: 1.2rem;
}

.upload-copy {
  display: grid;
  gap: .15rem;
}

.upload-copy strong {
  font-size: .82rem;
}

.upload-copy small {
  color: #8f8798;
  font-size: .72rem;
}

.media-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
}

.sub-tabs {
  display: flex;
  gap: 1rem;
}

.sub-tabs button {
  padding: .3rem 0;
  border: 0;
  border-bottom: 2px solid transparent;
  background: transparent;
  color: #8f8798;
  font-size: .76rem;
  cursor: pointer;
}

.sub-tabs button.active {
  border-bottom-color: #9d5cff;
  color: #fff;
  font-weight: 650;
}

.media-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: .45rem;
}

.media-option {
  position: relative;
  overflow: hidden;
  aspect-ratio: 1;
  padding: 0;
  border: 1px solid #28232e;
  border-radius: .5rem;
  background: #0b0a0e;
  cursor: pointer;
}

.media-option img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transition: transform .2s ease;
}

.media-option:hover img {
  transform: scale(1.05);
}

.media-option.active {
  border-color: #9d5cff;
  box-shadow: 0 0 0 1px #9d5cff;
}

.media-check {
  position: absolute;
  right: .25rem;
  bottom: .25rem;
  display: grid;
  width: 1.1rem;
  height: 1.1rem;
  place-items: center;
  border-radius: 50%;
  background: #8b5cf6;
  color: #fff;
  font-size: .65rem;
}

.empty-note {
  margin: 0;
  color: #7f7888;
  font-size: .74rem;
  line-height: 1.45;
}

.range-stack {
  display: grid;
  gap: .7rem;
}

/* Template */

.template-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: .9rem .7rem;
}

.meta-list {
  display: grid;
  gap: .55rem;
  margin: 0;
}

.meta-list div {
  display: grid;
  grid-template-columns: 6rem minmax(0, 1fr);
  gap: .5rem;
}

.meta-list dt {
  color: #7f7888;
  font-size: .74rem;
}

.meta-list dd {
  margin: 0;
  color: #cfc8d6;
  font-size: .74rem;
}

/* Text */

.field-stack {
  display: grid;
  gap: .95rem;
}

.text-field {
  display: grid;
  gap: .4rem;
}

.text-field > label,
.field-head label:not(.switch) {
  color: #cfc8d6;
  font-size: .78rem;
  font-weight: 600;
}

.field-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: .5rem;
}

.field-tools {
  display: inline-flex;
  align-items: center;
  gap: .6rem;
}

.count {
  color: #6f6879;
  font-size: .68rem;
  font-variant-numeric: tabular-nums;
}

.text-field input,
.text-field textarea,
.gig-fields input {
  width: 100%;
  padding: .6rem .7rem;
  border: 1px solid #2a2530;
  border-radius: .55rem;
  background: #131018;
  color: #f5f1f9;
  font-size: .82rem;
  transition: border-color .15s ease;
}

.text-field textarea {
  resize: vertical;
  line-height: 1.4;
}

.text-field input:focus,
.text-field textarea:focus,
.gig-fields input:focus {
  border-color: #8b5cf6;
  outline: none;
}

.text-field input:disabled,
.text-field textarea:disabled,
.gig-fields input:disabled {
  color: #6f6879;
  opacity: .7;
}

.switch {
  position: relative;
  display: inline-flex;
  flex: 0 0 auto;
  cursor: pointer;
}

.switch input {
  position: absolute;
  inset: 0;
  margin: 0;
  opacity: 0;
  cursor: pointer;
}

.switch span {
  position: relative;
  width: 1.9rem;
  height: 1.1rem;
  border-radius: 999px;
  background: #2d2835;
  transition: background .15s ease;
}

.switch span::after {
  position: absolute;
  top: .15rem;
  left: .15rem;
  width: .8rem;
  height: .8rem;
  border-radius: 50%;
  background: #a39bab;
  content: '';
  transition: transform .15s ease, background .15s ease;
}

.switch input:checked + span {
  background: #7c3aed;
}

.switch input:checked + span::after {
  background: #fff;
  transform: translateX(.8rem);
}

.switch input:focus-visible + span {
  outline: 2px solid #d9cfff;
  outline-offset: 2px;
}

.gig-rows {
  display: grid;
  gap: .6rem;
}

.gig-rows.disabled {
  opacity: .55;
}

.gig-row {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: .45rem;
  padding: .65rem;
  border-radius: .65rem;
  background: #141119;
}

.check-label {
  display: inline-flex;
  align-items: center;
  gap: .45rem;
  color: #cfc8d6;
  font-size: .76rem;
  font-weight: 600;
}

.check-label input {
  accent-color: #8b5cf6;
}

.gig-fields {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: 4.5rem minmax(0, 1fr);
  gap: .4rem;
}

.gig-fields input:nth-child(3) {
  grid-column: 2;
}

.icon-button {
  display: grid;
  width: 2rem;
  height: 2rem;
  place-items: center;
  border: 0;
  border-radius: .5rem;
  background: transparent;
  color: #8f8798;
  cursor: pointer;
}

.icon-button.small {
  width: 1.7rem;
  height: 1.7rem;
}

.icon-button:hover:not(:disabled) {
  background: #1f1b25;
  color: #f0b7c1;
}

.icon-button:disabled {
  cursor: not-allowed;
  opacity: .35;
}

.ghost-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .35rem;
  padding: .6rem;
  border: 1px dashed #3a3342;
  border-radius: .6rem;
  background: transparent;
  color: #c9c1d2;
  font-size: .78rem;
  cursor: pointer;
}

.ghost-button:hover:not(:disabled) {
  border-color: #6d4bb0;
  color: #fff;
}

.ghost-button:disabled {
  cursor: not-allowed;
  opacity: .45;
}

.option-row {
  display: grid;
  grid-template-columns: 5.2rem minmax(0, 1fr);
  align-items: center;
  gap: .75rem;
}

.option-label {
  color: #bdb6c6;
  font-size: .8rem;
}

.segmented {
  display: flex;
  padding: .2rem;
  border-radius: .6rem;
  background: #131018;
}

.segmented button {
  flex: 1 1 0;
  display: grid;
  place-items: center;
  min-height: 2rem;
  padding: 0 .4rem;
  border: 0;
  border-radius: .45rem;
  background: transparent;
  color: #948c9e;
  font-size: .76rem;
  cursor: pointer;
}

.segmented button:hover {
  color: #fff;
}

.segmented button.active {
  background: #2a2140;
  color: #fff;
  box-shadow: inset 0 0 0 1px #6d4bb0;
}

/* Design */

.brand-list {
  display: grid;
  gap: .5rem;
}

.brand-option {
  display: flex;
  align-items: center;
  gap: .8rem;
  padding: .7rem .75rem;
  border: 1px solid #25212b;
  border-radius: .7rem;
  background: #131018;
  color: inherit;
  text-align: left;
  cursor: pointer;
}

.brand-option:hover {
  border-color: #3b3443;
}

.brand-option.active {
  border-color: #9d5cff;
  background: rgba(124, 58, 237, .1);
}

.swatches {
  display: flex;
}

.swatches i {
  width: 1.1rem;
  height: 1.1rem;
  border: 2px solid #131018;
  border-radius: 50%;
}

.swatches i + i {
  margin-left: -.35rem;
}

.brand-copy {
  display: grid;
  flex: 1 1 auto;
  gap: .1rem;
}

.brand-copy strong {
  font-size: .8rem;
}

.brand-copy small {
  color: #8f8798;
  font-size: .72rem;
}

.brand-check {
  color: #b18cff;
}
</style>
