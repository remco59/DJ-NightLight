<script setup lang="ts">
import {
  MAX_BACKDROP,
  MAX_PROJECT_SECONDS,
  VIDEO_ASPECTS,
  VIDEO_ASPECT_KEYS,
  VIDEO_FPS_OPTIONS,
  defaultCrop,
  defaultTransform,
  graphicBackdrop,
  mediaFit,
  type ItemCrop,
  type MediaFit,
  type ItemTransform,
  type TimelineItem,
  type VideoAspect,
  type VideoProject,
} from '~~/shared/video-project'
import { LUCIDE_ICONS, LUCIDE_ICON_GROUPS } from '~~/shared/lucide-icons'
import { updateItem } from '~~/shared/video-timeline'
import {
  BACKDROP_STYLES,
  ENTRANCE_ANIMATIONS,
  EXIT_ANIMATIONS,
  MOTION_ACCENTS,
  MOTION_TEMPLATES,
  iconProp,
  joinListRow,
  listProp,
  splitListRow,
  textProp,
  type TemplateField,
} from '~~/shared/video-templates'
import ScrubLabel from '~/components/video/ScrubLabel.vue'
import { useWaveforms } from '~/composables/useWaveforms'
import { MAX_BPM, MIN_BPM, withDownbeatAt, type BeatGrid } from '~~/shared/beat-grid'
import { useVideoEditor } from '~/composables/useVideoEditor'

// `mobile` turns the inspector into the contextual Edit tab: touch-sized
// controls and collapsible sections instead of one long form.
const props = defineProps<{ mobile?: boolean }>()

const editor = useVideoEditor()
const { state } = editor
const sectionTag = computed(() => props.mobile ? 'details' : 'section')
const headingTag = computed(() => props.mobile ? 'summary' : 'h3')
const item = computed(() => editor.selection.value?.item || null)
const template = computed(() => item.value?.type === 'graphic' ? MOTION_TEMPLATES[item.value.templateKey] : null)
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

// Scrubbing a label is one undo step: the drag edits the project transiently
// from a snapshot taken when it starts.
let scrubBase: VideoProject | null = null

function scrubStart() {
  scrubBase = JSON.parse(JSON.stringify(toRaw(state.project))) as VideoProject
  editor.beginTransient()
}

function scrubTransform(key: keyof ItemTransform, value: number) {
  const id = item.value?.id
  if (!scrubBase || !id) return
  editor.transient(updateItem(scrubBase, id, (target) => {
    if ('transform' in target) target.transform[key] = value
  }))
}

function scrubEnd() {
  scrubBase = null
  editor.endTransient()
}

const currentFit = computed(() => {
  const selection = editor.selection.value
  return selection && 'crop' in selection.item ? mediaFit(selection.item, selection.track.kind) : 'cover'
})

function setFit(fit: MediaFit) {
  patch((target) => {
    if ('crop' in target) target.fit = fit
  })
}

// --- Beat grid (audio) ---------------------------------------------------------

const { waveforms, gridFor } = useWaveforms()
const beatGrid = computed(() => item.value?.type === 'audio' ? gridFor(item.value) : null)
const waveformState = computed(() => {
  if (item.value?.type !== 'audio') return 'none'
  return waveforms.has(item.value.assetId) ? 'ready' : 'loading'
})
/** Source time under the playhead for the selected audio clip. */
const playheadSourceTime = computed(() => {
  const clip = item.value
  if (clip?.type !== 'audio') return 0
  return (state.frame - clip.start + clip.trimStart) / fps.value
})
const gridNote = computed(() => {
  const clip = item.value
  if (clip?.type !== 'audio') return ''
  if (waveformState.value === 'loading') return 'Analysing the track…'
  const detected = waveforms.get(clip.assetId)?.grid
  if (clip.beatGrid) return detected ? `Adjusted by hand (detected ${detected.bpm.toFixed(2)} BPM).` : 'Set by hand.'
  return detected ? 'Detected from the kicks. Clips snap to these beats.' : 'No clear beat found in this track.'
})

function setGrid(grid: BeatGrid | undefined) {
  if (grid && (!Number.isFinite(grid.bpm) || grid.bpm < MIN_BPM / 2 || grid.bpm > MAX_BPM * 2)) return
  patch((target) => {
    if (target.type !== 'audio') return
    if (grid) target.beatGrid = { bpm: Math.round(grid.bpm * 100) / 100, offset: withDownbeatAt(grid, grid.offset).offset }
    else delete target.beatGrid
  })
}

function downbeatAtPlayhead() {
  if (beatGrid.value) setGrid(withDownbeatAt(beatGrid.value, playheadSourceTime.value))
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

function iconValue(field: TemplateField) {
  return item.value?.type === 'graphic' ? iconProp(item.value.templateKey, item.value.templateProps, field.key) : null
}

function assetUrl(assetId: string) {
  return editor.mediaById.value.get(assetId)?.url || null
}

function clearAssetField(field: TemplateField, value: string | null) {
  if (!value) setField(field, '')
}

function clearListAssetField(field: TemplateField, index: number, value: string | null) {
  if (!value) setListRow(field, index, '')
}

function setListRow(field: TemplateField, index: number, value: string) {
  const rows = [...listValue(field)]
  rows[index] = value
  setField(field, rows)
}

/** Updates one column of a structured list row. */
function setListColumn(field: TemplateField, index: number, key: string, value: string) {
  if (!field.columns) return
  const columns = splitListRow(listValue(field)[index] || '', field.columns)
  setListRow(field, index, joinListRow({ ...columns, [key]: value }, field.columns))
}

function addListRow(field: TemplateField, value = '') {
  setField(field, [...listValue(field), value].slice(0, field.maxItems || 6))
}

function removeListRow(field: TemplateField, index: number) {
  setField(field, listValue(field).filter((_, row) => row !== index))
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
  <aside class="inspector" :class="{ mobile: props.mobile }">
    <!-- Project settings when nothing is selected -->
    <template v-if="!item">
      <div v-if="props.mobile" class="empty-state">
        <Icon name="lucide:mouse-pointer-click" aria-hidden="true" />
        <p>Select a clip, image, text or audio item in the timeline to edit it.</p>
      </div>
      <header v-else class="head">
        <div>
          <h2>Project</h2>
          <small>Select a clip or graphic to edit it</small>
        </div>
      </header>
      <component :is="sectionTag" class="block">
        <component :is="headingTag">{{ props.mobile ? 'Project settings' : 'Output' }}</component>
        <label class="row"><span>Format</span>
          <select :value="state.project.aspect" @change="editor.setAspect(($event.target as HTMLSelectElement).value as VideoAspect)">
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
        <p class="note">{{ state.project.width }}<IconTimes />{{ state.project.height }} · length {{ seconds(editor.duration.value) }}s</p>
        <label class="row check"><span>Show Reels / Stories safe zones</span>
          <input type="checkbox" :checked="state.project.showSafeZones" @change="editor.patchProject(project => { project.showSafeZones = ($event.target as HTMLInputElement).checked })">
        </label>
      </component>
      <section v-if="!props.mobile">
        <h3>Shortcuts</h3>
        <dl class="shortcuts">
          <dt>Space</dt><dd>Play / pause</dd>
          <dt>S</dt><dd>Split at playhead</dd>
          <dt>Delete</dt><dd>Delete selection</dd>
          <dt>Ctrl/<Icon name="lucide:command" role="img" aria-label="Cmd" /> D</dt><dd>Duplicate</dd>
          <dt>Ctrl/<Icon name="lucide:command" role="img" aria-label="Cmd" /> Z</dt><dd>Undo (<Icon name="lucide:arrow-big-up" role="img" aria-label="Shift" /> to redo)</dd>
          <dt><Icon name="lucide:arrow-left" role="img" aria-label="Left" /> <Icon name="lucide:arrow-right" role="img" aria-label="Right" /></dt><dd>Step one frame (<Icon name="lucide:arrow-big-up" role="img" aria-label="Shift" /> one second)</dd>
          <dt><Icon name="lucide:arrow-big-up" role="img" aria-label="Shift" /> Delete</dt><dd>Ripple delete (close the hole)</dd>
          <dt>M</dt><dd>Add marker at playhead</dd>
          <dt>[ ]</dt><dd>Previous / next marker</dd>
          <dt>\</dt><dd>Zoom timeline to fit (<Icon name="lucide:arrow-big-up" role="img" aria-label="Shift" /> selected clip)</dd>
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
      <component :is="sectionTag" v-if="item.type === 'graphic' && template" class="block" :open="props.mobile || undefined">
        <component :is="headingTag">Content</component>
        <template v-for="field in template.fields" :key="field.key">
          <label v-if="field.kind === 'text'" class="row"><span>{{ field.label }}</span>
            <input type="text" :maxlength="field.maxLength" :value="textValue(field)" @input="setField(field, ($event.target as HTMLInputElement).value)">
          </label>
          <label v-else-if="field.kind === 'textarea'" class="stack"><span>{{ field.label }}</span>
            <textarea :maxlength="field.maxLength" :value="textValue(field)" @input="setField(field, ($event.target as HTMLTextAreaElement).value)" />
          </label>
          <label v-else-if="field.kind === 'icon'" class="row"><span>{{ field.label }}</span>
            <select :value="iconValue(field) || ''" @change="setField(field, ($event.target as HTMLSelectElement).value)">
              <option value="">None</option>
              <optgroup v-for="(names, group) in LUCIDE_ICON_GROUPS" :key="group" :label="group">
                <option v-for="name in names" :key="name" :value="name">{{ LUCIDE_ICONS[name].label }}</option>
              </optgroup>
            </select>
            <span class="icon-preview" aria-hidden="true"><Icon v-if="iconValue(field)" :name="`lucide:${iconValue(field)}`" /></span>
          </label>
          <div v-else-if="field.kind === 'list' && field.columns" class="stack column-list">
            <span>{{ field.label }}</span>
            <div v-for="(row, index) in listValue(field)" :key="index" class="column-row">
              <label v-for="column in field.columns" :key="column.key" :class="{ wide: column.wide }">
                <span>{{ column.label }}</span>
                <input type="text" :maxlength="column.maxLength" :placeholder="column.placeholder" :value="splitListRow(row, field.columns)[column.key]" @input="setListColumn(field, index, column.key, ($event.target as HTMLInputElement).value)">
              </label>
              <button type="button" class="ghost remove-row" @click="removeListRow(field, index)"><Icon name="lucide:x" aria-hidden="true" /> Remove</button>
            </div>
            <button v-if="listValue(field).length < (field.maxItems || 6)" type="button" class="ghost" @click="addListRow(field)"><Icon name="lucide:plus" aria-hidden="true" />Add row</button>
          </div>
          <div v-else-if="field.kind === 'list'" class="stack">
            <span>{{ field.label }}</span>
            <div v-for="(row, index) in listValue(field)" :key="index" class="list-row">
              <input type="text" :maxlength="field.maxLength" :placeholder="field.placeholder" :value="row" @input="setListRow(field, index, ($event.target as HTMLInputElement).value)">
              <button type="button" class="ghost" title="Remove" aria-label="Remove" @click="removeListRow(field, index)"><Icon name="lucide:x" aria-hidden="true" /></button>
            </div>
            <button v-if="listValue(field).length < (field.maxItems || 6)" type="button" class="ghost" @click="addListRow(field)"><Icon name="lucide:plus" aria-hidden="true" />Add row</button>
          </div>
          <AdminMediaPicker
            v-else-if="field.kind === 'asset'"
            :model-value="assetUrl(textValue(field))"
            :label="field.label"
            :allow-external="false"
            @selected="setField(field, $event.id)"
            @update:model-value="clearAssetField(field, $event)"
          />
          <div v-else-if="field.kind === 'assets'" class="stack media-list">
            <span>{{ field.label }}</span>
            <div v-for="(assetId, index) in listValue(field)" :key="index" class="media-list-row">
              <AdminMediaPicker
                :model-value="assetUrl(assetId)"
                :label="`Media ${index + 1}`"
                kind="all"
                :allow-external="false"
                @selected="setListRow(field, index, $event.id)"
                @update:model-value="clearListAssetField(field, index, $event)"
              />
              <button type="button" class="ghost remove-media" title="Remove" aria-label="Remove" @click="removeListRow(field, index)"><Icon name="lucide:x" aria-hidden="true" /> Remove</button>
            </div>
            <button v-if="listValue(field).length < (field.maxItems || 5)" type="button" class="ghost" @click="addListRow(field)"><Icon name="lucide:plus" aria-hidden="true" />Add media</button>
          </div>
        </template>
      </component>

      <component :is="sectionTag" v-if="item.type === 'graphic'" class="block">
        <component :is="headingTag">{{ props.mobile ? 'Style & animation' : 'Style' }}</component>
        <label class="row"><span>Accent style</span>
          <select :value="item.accent" @change="patch(target => { if (target.type === 'graphic') target.accent = ($event.target as HTMLSelectElement).value as typeof target.accent })">
            <option v-for="(accent, key) in MOTION_ACCENTS" :key="key" :value="key">{{ accent.label }}</option>
          </select>
        </label>
        <label class="row"><span>Background</span>
          <select :value="item.backdropStyle || 'dim'" @change="patch(target => { if (target.type === 'graphic') target.backdropStyle = ($event.target as HTMLSelectElement).value as typeof target.backdropStyle })">
            <option v-for="(label, key) in BACKDROP_STYLES" :key="key" :value="key">{{ label }}</option>
          </select>
        </label>
        <label class="row"><span>Background strength</span>
          <input type="range" min="0" :max="MAX_BACKDROP" step="0.05" :value="graphicBackdrop(item)" @input="patch(target => { if (target.type === 'graphic') target.backdrop = Number(($event.target as HTMLInputElement).value) }, 'backdrop')">
          <output>{{ Math.round(graphicBackdrop(item) * 100) }}%</output>
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
      </component>

      <!-- Transform for everything visual -->
      <component :is="sectionTag" v-if="'transform' in item" class="block">
        <component :is="headingTag">Transform <button type="button" class="ghost small" @click.prevent="resetTransform">Reset</button></component>
        <label v-if="'crop' in item" class="row"><span>Frame</span>
          <select :value="currentFit" @change="setFit(($event.target as HTMLSelectElement).value as MediaFit)">
            <option value="cover">Fill (crop to frame)</option>
            <option value="contain">Fit (show whole clip)</option>
          </select>
        </label>
        <div class="row"><span>Position</span>
          <div class="pair">
            <label><ScrubLabel :value="item.transform.x" :step="1" :min="-5000" :max="5000" :precision="1" @start="scrubStart" @scrub="scrubTransform('x', $event)" @end="scrubEnd">X</ScrubLabel> <input type="number" step="10" :value="item.transform.x" @input="setTransform('x', Number(($event.target as HTMLInputElement).value))"></label>
            <label><ScrubLabel :value="item.transform.y" :step="1" :min="-5000" :max="5000" :precision="1" @start="scrubStart" @scrub="scrubTransform('y', $event)" @end="scrubEnd">Y</ScrubLabel> <input type="number" step="10" :value="item.transform.y" @input="setTransform('y', Number(($event.target as HTMLInputElement).value))"></label>
          </div>
        </div>
        <label class="row"><ScrubLabel :value="item.transform.scale" :step="0.005" :min="0.1" :max="3" :precision="3" @start="scrubStart" @scrub="scrubTransform('scale', $event)" @end="scrubEnd">Scale</ScrubLabel>
          <input type="range" min="0.1" max="3" step="0.01" :value="item.transform.scale" @input="setTransform('scale', Number(($event.target as HTMLInputElement).value))">
          <output>{{ Math.round(item.transform.scale * 100) }}%</output>
        </label>
        <label class="row"><ScrubLabel :value="item.transform.rotation" :step="0.5" :min="-180" :max="180" :precision="1" @start="scrubStart" @scrub="scrubTransform('rotation', $event)" @end="scrubEnd">Rotation</ScrubLabel>
          <input type="range" min="-180" max="180" step="1" :value="item.transform.rotation" @input="setTransform('rotation', Number(($event.target as HTMLInputElement).value))">
          <output>{{ item.transform.rotation }}°</output>
        </label>
        <label class="row"><span>Opacity</span>
          <input type="range" min="0" max="1" step="0.01" :value="item.opacity" @input="patch(target => { target.opacity = Number(($event.target as HTMLInputElement).value) }, 'opacity')">
          <output>{{ Math.round(item.opacity * 100) }}%</output>
        </label>
      </component>

      <component :is="sectionTag" v-if="'crop' in item" class="block">
        <component :is="headingTag">Crop</component>
        <label v-for="side in (['top', 'right', 'bottom', 'left'] as const)" :key="side" class="row"><span>{{ side[0]!.toUpperCase() + side.slice(1) }}</span>
          <input type="range" min="0" max="45" step="1" :value="Math.round(item.crop[side] * 100)" @input="setCrop(side, Number(($event.target as HTMLInputElement).value))">
          <output>{{ Math.round(item.crop[side] * 100) }}%</output>
        </label>
      </component>

      <component :is="sectionTag" v-if="item.type === 'image'" class="block" :open="props.mobile || undefined">
        <component :is="headingTag">Motion</component>
        <label class="row"><span>Ken Burns</span>
          <input type="range" min="0" max="1" step="0.05" :value="item.kenBurns" @input="patch(target => { if (target.type === 'image') target.kenBurns = Number(($event.target as HTMLInputElement).value) }, 'kenBurns')">
          <output>{{ Math.round(item.kenBurns * 100) }}%</output>
        </label>
      </component>

      <component :is="sectionTag" v-if="item.type === 'video'" class="block" :open="props.mobile || undefined">
        <component :is="headingTag">Playback</component>
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
      </component>

      <component :is="sectionTag" v-if="item.type === 'audio'" class="block" :open="props.mobile || undefined">
        <component :is="headingTag">Audio</component>
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
      </component>

      <component :is="sectionTag" v-if="item.type === 'audio'" class="block" :open="props.mobile || undefined">
        <component :is="headingTag">
          Beat grid
          <button v-if="item.beatGrid" type="button" class="ghost small" title="Use the detected tempo and downbeat again" @click.prevent="setGrid(undefined)">Use detected</button>
        </component>
        <template v-if="beatGrid">
          <label class="row"><span>Tempo (BPM)</span>
            <input type="number" :min="MIN_BPM / 2" :max="MAX_BPM * 2" step="0.01" :value="beatGrid.bpm" @change="setGrid({ ...beatGrid, bpm: Number(($event.target as HTMLInputElement).value) })">
          </label>
          <div class="row"><span>Adjust</span>
            <div class="pair">
              <button type="button" class="ghost small" title="Half the tempo" @click="setGrid({ ...beatGrid, bpm: beatGrid.bpm / 2 })">½×</button>
              <button type="button" class="ghost small" title="Double the tempo" @click="setGrid({ ...beatGrid, bpm: beatGrid.bpm * 2 })">2×</button>
            </div>
          </div>
          <button type="button" class="ghost small wide" title="Make the beat under the playhead the first beat of a bar" @click="downbeatAtPlayhead">Set downbeat at playhead</button>
        </template>
        <button v-else-if="waveformState !== 'loading'" type="button" class="ghost small wide" @click="setGrid(withDownbeatAt({ bpm: 125, offset: 0 }, playheadSourceTime))">Add a 125 BPM grid from the playhead</button>
        <p class="note">{{ gridNote }}</p>
      </component>

      <component :is="sectionTag" class="block">
        <component :is="headingTag">Timing</component>
        <label class="row"><span>Start (s)</span>
          <input type="number" min="0" step="0.1" :value="seconds(item.start)" @change="setTiming('start', Number(($event.target as HTMLInputElement).value))">
        </label>
        <label class="row"><span>Duration (s)</span>
          <input type="number" min="0.1" step="0.1" :value="seconds(item.duration)" @change="setTiming('duration', Number(($event.target as HTMLInputElement).value))">
        </label>
        <p v-if="item.type === 'video' || item.type === 'audio'" class="note">Trimmed {{ seconds(item.trimStart) }}s from the start of the source.</p>
      </component>
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

/* Same width as `output` so icon selects line up with the sliders. */
.row > .icon-preview {
  display: grid;
  place-items: center;
  min-width: 42px;
  color: var(--ve-text);
  font-size: 1.05rem;
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

.media-list, .column-list {
  gap: .7rem;
}

/* One card per structured row: short columns share a line, wide ones span it. */
.column-row {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: .4rem;
  padding: .55rem;
  border: 1px solid var(--ve-border);
  border-radius: 10px;
  background: var(--ve-bg);
}

.column-row label {
  display: flex;
  flex-direction: column;
  gap: .2rem;
  min-width: 0;
}

.column-row label > span {
  color: var(--ve-muted);
  font-size: .72rem;
}

.column-row .wide {
  grid-column: 1 / -1;
}

.column-row .remove-row {
  color: var(--ve-muted);
  grid-column: 1 / -1;
  justify-self: end;
}

.media-list-row {
  display: grid;
  gap: .4rem;
  padding: .55rem;
  border: 1px solid var(--ve-border);
  border-radius: 10px;
  background: var(--ve-bg);
}

.media-list-row .remove-media {
  justify-self: end;
  color: var(--ve-muted);
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

.ghost.small.wide {
  width: 100%;
  padding: .35rem .5rem;
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
/* --- Mobile Edit tab ------------------------------------------------------------ */

.inspector.mobile {
  gap: .6rem;
  padding: .75rem 1rem 1rem;
  border-left: 0;
  overscroll-behavior: contain;
}

.mobile .head {
  align-items: center;
  padding: 0;
  border-bottom: 0;
}

.mobile .head .ghost { width: 40px; height: 40px; }

.empty-state {
  display: flex;
  align-items: center;
  gap: .8rem;
  padding: 1rem;
  border: 1px dashed rgba(167, 139, 250, .35);
  border-radius: 12px;
  color: var(--ve-muted);
  font-size: .85rem;
  line-height: 1.4;
}

.empty-state svg { flex: none; width: 24px; height: 24px; color: #a78bfa; }
.empty-state p { margin: 0; }

details.block {
  border: 1px solid var(--ve-border);
  border-radius: 12px;
  background: var(--ve-raised);
}

details.block > summary {
  display: flex;
  align-items: center;
  gap: .5rem;
  min-height: 48px;
  padding: 0 .9rem;
  font-size: .88rem;
  font-weight: 700;
  list-style: none;
  cursor: pointer;
}

details.block > summary::-webkit-details-marker { display: none; }

details.block > summary::after {
  width: 8px;
  height: 8px;
  margin-left: auto;
  border-right: 2px solid var(--ve-muted);
  border-bottom: 2px solid var(--ve-muted);
  transform: rotate(45deg);
  transition: transform .15s;
  content: "";
}

details.block[open] > summary::after { transform: rotate(-135deg); }

details.block > summary .ghost { min-height: 32px; margin-left: auto; }
details.block > summary:has(.ghost)::after { margin-left: .4rem; }

details.block > :not(summary) { margin: 0 .9rem; }
details.block > :last-child { margin-bottom: .9rem; }
details.block[open] > summary { margin-bottom: .2rem; }
details.block > * + :not(summary) { margin-top: .7rem; }

.mobile .row {
  grid-template-columns: minmax(0, 1fr) auto;
  gap: .35rem .6rem;
  font-size: .85rem;
}

/* Sliders get their own full-width line under the label. */
.mobile .row:has(input[type="range"]) > input[type="range"] {
  grid-column: 1 / -1;
  grid-row: 2;
}

.mobile .row:has(input[type="range"]) > output,
.mobile .row > .icon-preview { grid-column: 2; grid-row: 1; }

.mobile .row > select,
.mobile .row > input[type="text"],
.mobile .row > input[type="number"] {
  grid-column: 1 / -1;
}

.mobile .row.check { grid-template-columns: minmax(0, 1fr) auto; min-height: 44px; }

.mobile .pair { grid-column: 1 / -1; }

.mobile input[type="text"], .mobile input[type="number"], .mobile select, .mobile textarea {
  min-height: 44px;
  padding: .55rem .7rem;
  border-radius: 9px;
  font-size: 16px;
}

.mobile input[type="range"] {
  height: 32px;
  margin: 0;
}

/* Switch-style checkboxes for touch. */
.mobile input[type="checkbox"] {
  position: relative;
  width: 46px;
  height: 28px;
  margin: 0;
  border-radius: 999px;
  background: #3f3a4d;
  transition: background .15s;
  appearance: none;
  cursor: pointer;
}

.mobile input[type="checkbox"]::after {
  position: absolute;
  top: 3px;
  left: 3px;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #fff;
  transition: transform .15s;
  content: "";
}

.mobile input[type="checkbox"]:checked { background: var(--ve-accent); }
.mobile input[type="checkbox"]:checked::after { transform: translateX(18px); }

.mobile input[type="color"] { width: 56px; height: 40px; }

.mobile .list-row .ghost { flex: none; width: 44px; min-height: 44px; }
.mobile .stack > .ghost { min-height: 40px; align-self: flex-start; }

.mobile summary:focus-visible, .mobile input:focus-visible, .mobile select:focus-visible, .mobile button:focus-visible, .mobile textarea:focus-visible {
  outline: 2px solid #c4b5fd;
  outline-offset: 2px;
}
</style>
