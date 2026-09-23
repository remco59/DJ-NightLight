<script setup lang="ts">
import {
  MAX_PROJECT_SECONDS,
  VIDEO_ASPECTS,
  VIDEO_ASPECT_KEYS,
  VIDEO_FPS_OPTIONS,
  defaultCrop,
  defaultTransform,
  mediaKind,
  type ItemCrop,
  type ItemTransform,
  type TimelineItem,
  type VideoAspect,
} from '~~/shared/video-project'
import {
  ENTRANCE_ANIMATIONS,
  EXIT_ANIMATIONS,
  MOTION_ACCENTS,
  MOTION_TEMPLATES,
  listProp,
  textProp,
  type TemplateField,
} from '~~/shared/video-templates'
import { useVideoEditor } from '~/composables/useVideoEditor'

const editor = useVideoEditor()
const { state } = editor
const item = computed(() => editor.selection.value?.item || null)
const template = computed(() => item.value?.type === 'graphic' ? MOTION_TEMPLATES[item.value.templateKey] : null)
const visualMedia = computed(() => state.media.filter(asset => mediaKind(asset.mimeType) !== 'audio'))
const fps = computed(() => state.project.fps)

function patch(mutator: (target: TimelineItem) => void, key = '') {
  if (!item.value) return
  editor.patchItem(item.value.id, mutator, key ? `${item.value.id}:${key}` : '')
}

function seconds(frames: number) {
  return Math.round(frames / fps.value * 100) / 100
}

function setTiming(key: 'start' | 'duration', value: number) {
  if (!Number.isFinite(value)) return
  if (!item.value) return
  const frames = Math.max(key === 'duration' ? 3 : 0, Math.round(value * fps.value))
  // Go through the timeline operations so clips never overlap or overrun their source.
  editor.commit(key === 'start'
    ? editor.move(item.value.id, frames)
    : editor.trim(state.project, item.value.id, 'end', frames - item.value.duration))
}

function setTransform(key: keyof ItemTransform, value: number) {
  if (!Number.isFinite(value)) return
  patch((target) => {
    if ('transform' in target) target.transform[key] = value
  }, `transform.${key}`)
}

function setCrop(key: keyof ItemCrop, value: number) {
  patch((target) => {
    if ('crop' in target) target.crop[key] = Math.min(0.45, Math.max(0, value / 100))
  }, `crop.${key}`)
}

function resetTransform() {
  patch((target) => {
    if ('transform' in target) target.transform = defaultTransform()
    if ('crop' in target) target.crop = defaultCrop()
  })
}

function setField(field: TemplateField, value: string | string[]) {
  patch((target) => {
    if (target.type === 'graphic') target.templateProps[field.key] = value
  }, `field.${field.key}`)
}

function listValue(field: TemplateField) {
  return item.value?.type === 'graphic' ? listProp(item.value.templateProps, field.key) : []
}

function textValue(field: TemplateField) {
  return item.value?.type === 'graphic' ? textProp(item.value.templateProps, field.key) : ''
}

function setListRow(field: TemplateField, index: number, value: string) {
  const rows = [...listValue(field)]
  rows[index] = value
  setField(field, rows)
}

function addListRow(field: TemplateField, value = '') {
  setField(field, [...listValue(field), value].slice(0, field.maxItems || 6))
}

function removeListRow(field: TemplateField, index: number) {
  setField(field, listValue(field).filter((_, row) => row !== index))
}

function setAspect(aspect: VideoAspect) {
  editor.patchProject((project) => {
    project.aspect = aspect
    project.width = VIDEO_ASPECTS[aspect].width
    project.height = VIDEO_ASPECTS[aspect].height
  })
}

function setProjectDuration(value: number) {
  if (!Number.isFinite(value)) return
  editor.patchProject((project) => {
    project.durationFrames = Math.min(MAX_PROJECT_SECONDS * project.fps, Math.max(project.fps, Math.round(value * project.fps)))
  }, 'project.duration')
}

// Changing fps rescales every frame-based value so timing stays the same in seconds.
function setFps(value: number) {
  editor.patchProject((project) => {
    const ratio = value / project.fps
    const scale = (frames: number) => Math.round(frames * ratio)
    project.fps = value
    project.durationFrames = scale(project.durationFrames)
    for (const track of project.tracks) {
      for (const entry of track.items) {
        entry.start = scale(entry.start)
        entry.duration = Math.max(3, scale(entry.duration))
        if (entry.type === 'video' || entry.type === 'audio') entry.trimStart = scale(entry.trimStart)
        if (entry.type === 'audio') {
          entry.fadeIn = scale(entry.fadeIn)
          entry.fadeOut = scale(entry.fadeOut)
        }
        if (entry.type === 'graphic') {
          entry.entranceFrames = Math.min(120, scale(entry.entranceFrames))
          entry.exitFrames = Math.min(120, scale(entry.exitFrames))
        }
      }
    }
  })
}

const assetTitle = computed(() => {
  if (!item.value || item.value.type === 'graphic') return ''
  const asset = editor.mediaById.value.get(item.value.assetId)
  return asset?.title || asset?.originalFilename || 'Missing media'
})
</script>

<template>
  <aside class="inspector">
    <!-- Project settings when nothing is selected -->
    <template v-if="!item">
      <header class="head">
        <div>
          <h2>Project</h2>
          <small>Select a clip or graphic to edit it</small>
        </div>
      </header>
      <section>
        <h3>Output</h3>
        <label class="row"><span>Format</span>
          <select :value="state.project.aspect" @change="setAspect(($event.target as HTMLSelectElement).value as VideoAspect)">
            <option v-for="key in VIDEO_ASPECT_KEYS" :key="key" :value="key">{{ VIDEO_ASPECTS[key].label }}</option>
          </select>
        </label>
        <label class="row"><span>FPS</span>
          <select :value="state.project.fps" @change="setFps(Number(($event.target as HTMLSelectElement).value))">
            <option v-for="value in VIDEO_FPS_OPTIONS" :key="value" :value="value">{{ value }} fps</option>
          </select>
        </label>
        <label class="row"><span>Background</span>
          <input type="color" :value="state.project.background" @input="editor.patchProject(project => { project.background = ($event.target as HTMLInputElement).value }, 'project.background')">
        </label>
        <label class="row check"><span>Duration follows timeline</span>
          <input type="checkbox" :checked="state.project.autoDuration" @change="editor.patchProject(project => { project.autoDuration = ($event.target as HTMLInputElement).checked })">
        </label>
        <label v-if="!state.project.autoDuration" class="row"><span>Duration (s)</span>
          <input type="number" min="1" :max="MAX_PROJECT_SECONDS" step="0.5" :value="seconds(state.project.durationFrames)" @change="setProjectDuration(Number(($event.target as HTMLInputElement).value))">
        </label>
        <p class="note">{{ state.project.width }}×{{ state.project.height }} · length {{ seconds(editor.duration.value) }}s</p>
        <label class="row check"><span>Show Reels / Stories safe zones</span>
          <input type="checkbox" :checked="state.project.showSafeZones" @change="editor.patchProject(project => { project.showSafeZones = ($event.target as HTMLInputElement).checked })">
        </label>
      </section>
      <section>
        <h3>Shortcuts</h3>
        <dl class="shortcuts">
          <dt>Space</dt><dd>Play / pause</dd>
          <dt>S</dt><dd>Split at playhead</dd>
          <dt>Delete</dt><dd>Delete selection</dd>
          <dt>Ctrl/⌘ D</dt><dd>Duplicate</dd>
          <dt>Ctrl/⌘ Z</dt><dd>Undo (⇧ to redo)</dd>
          <dt>← →</dt><dd>Step one frame (⇧ one second)</dd>
        </dl>
      </section>
    </template>

    <template v-else>
      <header class="head">
        <div>
          <h2>{{ template ? template.label : assetTitle }}</h2>
          <small>{{ template ? 'Motion Graphic Template' : item.type === 'audio' ? 'Audio clip' : item.type === 'video' ? 'Video clip' : 'Image' }}</small>
        </div>
        <button type="button" class="ghost" title="Deselect" aria-label="Deselect" @click="state.selectedId = null"><Icon name="lucide:x" aria-hidden="true" /></button>
      </header>

      <!-- Motion graphic content -->
      <section v-if="item.type === 'graphic' && template">
        <h3>Content</h3>
        <template v-for="field in template.fields" :key="field.key">
          <label v-if="field.kind === 'text'" class="row"><span>{{ field.label }}</span>
            <input type="text" :maxlength="field.maxLength" :value="textValue(field)" @input="setField(field, ($event.target as HTMLInputElement).value)">
          </label>
          <label v-else-if="field.kind === 'textarea'" class="stack"><span>{{ field.label }}</span>
            <textarea :maxlength="field.maxLength" :value="textValue(field)" @input="setField(field, ($event.target as HTMLTextAreaElement).value)" />
          </label>
          <div v-else-if="field.kind === 'list'" class="stack">
            <span>{{ field.label }}</span>
            <div v-for="(row, index) in listValue(field)" :key="index" class="list-row">
              <input type="text" :maxlength="field.maxLength" :placeholder="field.placeholder" :value="row" @input="setListRow(field, index, ($event.target as HTMLInputElement).value)">
              <button type="button" class="ghost" title="Remove" aria-label="Remove" @click="removeListRow(field, index)"><Icon name="lucide:x" aria-hidden="true" /></button>
            </div>
            <button v-if="listValue(field).length < (field.maxItems || 6)" type="button" class="ghost" @click="addListRow(field)"><Icon name="lucide:plus" aria-hidden="true" />Add row</button>
          </div>
          <label v-else-if="field.kind === 'asset'" class="row"><span>{{ field.label }}</span>
            <select :value="textValue(field)" @change="setField(field, ($event.target as HTMLSelectElement).value)">
              <option value="">Choose media…</option>
              <option v-for="asset in visualMedia" :key="asset.id" :value="asset.id">{{ asset.title || asset.originalFilename }}</option>
            </select>
          </label>
          <div v-else-if="field.kind === 'assets'" class="stack">
            <span>{{ field.label }}</span>
            <div v-for="(assetId, index) in listValue(field)" :key="index" class="list-row">
              <select :value="assetId" @change="setListRow(field, index, ($event.target as HTMLSelectElement).value)">
                <option v-for="asset in visualMedia" :key="asset.id" :value="asset.id">{{ asset.title || asset.originalFilename }}</option>
              </select>
              <button type="button" class="ghost" title="Remove" aria-label="Remove" @click="removeListRow(field, index)"><Icon name="lucide:x" aria-hidden="true" /></button>
            </div>
            <button v-if="listValue(field).length < (field.maxItems || 5) && visualMedia.length" type="button" class="ghost" @click="addListRow(field, visualMedia[0]!.id)"><Icon name="lucide:plus" aria-hidden="true" />Add media</button>
          </div>
        </template>
      </section>

      <section v-if="item.type === 'graphic'">
        <h3>Style</h3>
        <label class="row"><span>Accent style</span>
          <select :value="item.accent" @change="patch(target => { if (target.type === 'graphic') target.accent = ($event.target as HTMLSelectElement).value as typeof target.accent })">
            <option v-for="(accent, key) in MOTION_ACCENTS" :key="key" :value="key">{{ accent.label }}</option>
          </select>
        </label>
        <label class="row"><span>Entrance</span>
          <select :value="item.entrance" @change="patch(target => { if (target.type === 'graphic') target.entrance = ($event.target as HTMLSelectElement).value as typeof target.entrance })">
            <option v-for="(label, key) in ENTRANCE_ANIMATIONS" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <label class="row"><span>Entrance length</span>
          <input type="range" min="0" max="60" :value="item.entranceFrames" @input="patch(target => { if (target.type === 'graphic') target.entranceFrames = Number(($event.target as HTMLInputElement).value) }, 'entranceFrames')">
          <output>{{ seconds(item.entranceFrames) }}s</output>
        </label>
        <label class="row"><span>Exit</span>
          <select :value="item.exit" @change="patch(target => { if (target.type === 'graphic') target.exit = ($event.target as HTMLSelectElement).value as typeof target.exit })">
            <option v-for="(label, key) in EXIT_ANIMATIONS" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <label class="row"><span>Exit length</span>
          <input type="range" min="0" max="60" :value="item.exitFrames" @input="patch(target => { if (target.type === 'graphic') target.exitFrames = Number(($event.target as HTMLInputElement).value) }, 'exitFrames')">
          <output>{{ seconds(item.exitFrames) }}s</output>
        </label>
      </section>

      <!-- Transform for everything visual -->
      <section v-if="'transform' in item">
        <h3>Transform <button type="button" class="ghost small" @click="resetTransform">Reset</button></h3>
        <div class="row"><span>Position</span>
          <div class="pair">
            <label>X <input type="number" step="10" :value="item.transform.x" @input="setTransform('x', Number(($event.target as HTMLInputElement).value))"></label>
            <label>Y <input type="number" step="10" :value="item.transform.y" @input="setTransform('y', Number(($event.target as HTMLInputElement).value))"></label>
          </div>
        </div>
        <label class="row"><span>Scale</span>
          <input type="range" min="0.1" max="3" step="0.01" :value="item.transform.scale" @input="setTransform('scale', Number(($event.target as HTMLInputElement).value))">
          <output>{{ Math.round(item.transform.scale * 100) }}%</output>
        </label>
        <label class="row"><span>Rotation</span>
          <input type="range" min="-180" max="180" step="1" :value="item.transform.rotation" @input="setTransform('rotation', Number(($event.target as HTMLInputElement).value))">
          <output>{{ item.transform.rotation }}°</output>
        </label>
        <label class="row"><span>Opacity</span>
          <input type="range" min="0" max="1" step="0.01" :value="item.opacity" @input="patch(target => { target.opacity = Number(($event.target as HTMLInputElement).value) }, 'opacity')">
          <output>{{ Math.round(item.opacity * 100) }}%</output>
        </label>
      </section>

      <section v-if="'crop' in item">
        <h3>Crop</h3>
        <label v-for="side in (['top', 'right', 'bottom', 'left'] as const)" :key="side" class="row"><span>{{ side[0]!.toUpperCase() + side.slice(1) }}</span>
          <input type="range" min="0" max="45" step="1" :value="Math.round(item.crop[side] * 100)" @input="setCrop(side, Number(($event.target as HTMLInputElement).value))">
          <output>{{ Math.round(item.crop[side] * 100) }}%</output>
        </label>
      </section>

      <section v-if="item.type === 'image'">
        <h3>Motion</h3>
        <label class="row"><span>Ken Burns</span>
          <input type="range" min="0" max="1" step="0.05" :value="item.kenBurns" @input="patch(target => { if (target.type === 'image') target.kenBurns = Number(($event.target as HTMLInputElement).value) }, 'kenBurns')">
          <output>{{ Math.round(item.kenBurns * 100) }}%</output>
        </label>
      </section>

      <section v-if="item.type === 'video'">
        <h3>Playback</h3>
        <label class="row"><span>Speed</span>
          <select :value="item.speed" @change="patch(target => { if (target.type === 'video') target.speed = Number(($event.target as HTMLSelectElement).value) })">
            <option v-for="speed in [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3, 4]" :key="speed" :value="speed">{{ speed }}×</option>
          </select>
        </label>
        <label class="row"><span>Volume</span>
          <input type="range" min="0" max="1" step="0.01" :value="item.volume" @input="patch(target => { if (target.type === 'video') target.volume = Number(($event.target as HTMLInputElement).value) }, 'volume')">
          <output>{{ Math.round(item.volume * 100) }}%</output>
        </label>
        <label class="row check"><span>Mute clip audio</span>
          <input type="checkbox" :checked="item.muted" @change="patch(target => { if (target.type === 'video') target.muted = ($event.target as HTMLInputElement).checked })">
        </label>
      </section>

      <section v-if="item.type === 'audio'">
        <h3>Audio</h3>
        <label class="row"><span>Volume</span>
          <input type="range" min="0" max="1" step="0.01" :value="item.volume" @input="patch(target => { if (target.type === 'audio') target.volume = Number(($event.target as HTMLInputElement).value) }, 'volume')">
          <output>{{ Math.round(item.volume * 100) }}%</output>
        </label>
        <label class="row"><span>Fade in</span>
          <input type="range" min="0" :max="Math.min(item.duration, fps * 5)" :value="item.fadeIn" @input="patch(target => { if (target.type === 'audio') target.fadeIn = Number(($event.target as HTMLInputElement).value) }, 'fadeIn')">
          <output>{{ seconds(item.fadeIn) }}s</output>
        </label>
        <label class="row"><span>Fade out</span>
          <input type="range" min="0" :max="Math.min(item.duration, fps * 5)" :value="item.fadeOut" @input="patch(target => { if (target.type === 'audio') target.fadeOut = Number(($event.target as HTMLInputElement).value) }, 'fadeOut')">
          <output>{{ seconds(item.fadeOut) }}s</output>
        </label>
      </section>

      <section>
        <h3>Timing</h3>
        <label class="row"><span>Start (s)</span>
          <input type="number" min="0" step="0.1" :value="seconds(item.start)" @change="setTiming('start', Number(($event.target as HTMLInputElement).value))">
        </label>
        <label class="row"><span>Duration (s)</span>
          <input type="number" min="0.1" step="0.1" :value="seconds(item.duration)" @change="setTiming('duration', Number(($event.target as HTMLInputElement).value))">
        </label>
        <p v-if="item.type === 'video' || item.type === 'audio'" class="note">Trimmed {{ seconds(item.trimStart) }}s from the start of the source.</p>
      </section>
    </template>
  </aside>
</template>

<style scoped>
.inspector {
  display: flex;
  flex-direction: column;
  min-height: 0;
  overflow-y: auto;
  border-left: 1px solid var(--ve-border);
  background: var(--ve-panel);
}

.head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: .5rem;
  padding: 1rem;
  border-bottom: 1px solid var(--ve-border);
}

h2 {
  margin: 0;
  font-size: 1rem;
}

.head small {
  color: var(--ve-muted);
  font-size: .75rem;
}

section {
  display: flex;
  flex-direction: column;
  gap: .55rem;
  padding: 1rem;
  border-bottom: 1px solid var(--ve-border);
}

h3 {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin: 0 0 .15rem;
  font-size: .85rem;
}

.row {
  display: grid;
  grid-template-columns: 38% 1fr auto;
  align-items: center;
  gap: .5rem;
  font-size: .8rem;
}

.row > span, .stack > span {
  color: var(--ve-muted);
}

.row.check {
  grid-template-columns: 1fr auto;
}

.stack {
  display: flex;
  flex-direction: column;
  gap: .35rem;
  font-size: .8rem;
}

input[type="text"], input[type="number"], select, textarea {
  width: 100%;
  min-width: 0;
  padding: .45rem .55rem;
  border: 1px solid var(--ve-border);
  border-radius: 7px;
  background: var(--ve-bg);
  color: var(--ve-text);
  font-size: .8rem;
}

textarea { min-height: 70px; resize: vertical; }

input[type="range"], input[type="checkbox"] {
  accent-color: var(--ve-accent);
}

input[type="range"] { width: 100%; }

input[type="color"] {
  width: 44px;
  height: 28px;
  padding: 0;
  border: 1px solid var(--ve-border);
  border-radius: 6px;
  background: none;
}

output {
  min-width: 42px;
  color: var(--ve-muted);
  font-size: .75rem;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.pair {
  display: grid;
  grid-column: span 2;
  grid-template-columns: 1fr 1fr;
  gap: .4rem;
}

.pair label {
  display: flex;
  align-items: center;
  gap: .3rem;
  color: var(--ve-muted);
}

.list-row {
  display: flex;
  gap: .3rem;
}

.ghost {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: .3rem;
  padding: .3rem .55rem;
  border: 1px solid var(--ve-border);
  border-radius: 6px;
  background: none;
  color: var(--ve-text);
  font-size: .75rem;
  cursor: pointer;
}

.ghost.small {
  padding: .1rem .45rem;
  font-size: .7rem;
  font-weight: 400;
}

.note {
  margin: 0;
  color: var(--ve-muted);
  font-size: .75rem;
}

.shortcuts {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: .3rem .8rem;
  margin: 0;
  font-size: .78rem;
}

.shortcuts dt {
  color: var(--ve-text);
  font-weight: 700;
}

.shortcuts dd {
  margin: 0;
  color: var(--ve-muted);
}
</style>
