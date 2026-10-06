<script setup lang="ts">
import type { PopoverGig } from '~~/shared/calendar'
import { gigStatusLabels, labelFor } from '~~/shared/labels'

const props = defineProps<{ gigs: PopoverGig[], anchor: DOMRect | null }>()
const emit = defineEmits<{ enter: [], leave: [], close: [] }>()

const panel = ref<HTMLElement | null>(null)
const position = ref({ left: 0, top: 0 })
const compact = computed(() => props.gigs.length > 1)

const timeFormat = new Intl.DateTimeFormat('nl-NL', { hour: '2-digit', minute: '2-digit' })
const dateFormat = new Intl.DateTimeFormat('nl-NL', { weekday: 'long', day: 'numeric', month: 'long' })

function time(item: PopoverGig) {
  if (!item.startsAt) return 'Tijd onbekend'
  const start = timeFormat.format(new Date(item.startsAt))
  return item.endsAt ? `${start} – ${timeFormat.format(new Date(item.endsAt))}` : start
}
function date(item: PopoverGig) {
  return item.startsAt ? dateFormat.format(new Date(item.startsAt)) : ''
}
function location(item: PopoverGig) {
  return [item.venueName, item.venueCity].filter(Boolean).join(' · ')
}

async function place() {
  await nextTick()
  const rect = props.anchor
  const el = panel.value
  if (!rect || !el) return
  const gap = 8
  const { width, height } = el.getBoundingClientRect()
  const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8)
  const below = rect.bottom + gap
  const top = below + height > window.innerHeight - 8 && rect.top - gap - height > 8 ? rect.top - gap - height : below
  position.value = { left, top: Math.max(8, top) }
}

watch(() => [props.anchor, props.gigs], place, { flush: 'post' })

function onPointerDown(event: PointerEvent) {
  const target = event.target as Element | null
  if (!target || panel.value?.contains(target) || target.closest('[data-gig-trigger]')) return
  emit('close')
}
function onKey(event: KeyboardEvent) {
  if (event.key === 'Escape') emit('close')
}
onMounted(() => {
  document.addEventListener('pointerdown', onPointerDown)
  document.addEventListener('keydown', onKey)
})
onBeforeUnmount(() => {
  document.removeEventListener('pointerdown', onPointerDown)
  document.removeEventListener('keydown', onKey)
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="anchor && gigs.length"
      ref="panel"
      class="gig-popover"
      :class="{ compact }"
      role="dialog"
      aria-label="Gig-info"
      :style="{ left: position.left + 'px', top: position.top + 'px' }"
      @mouseenter="emit('enter')"
      @mouseleave="emit('leave')"
    >
      <p v-if="compact" class="pop-date">{{ date(gigs[0]!) }} · {{ gigs.length }} gigs</p>
      <NuxtLink v-for="item in gigs" :key="item.id" :to="`/admin/gigs/${item.id}`" class="pop-gig" :data-status="item.status">
        <template v-if="compact">
          <span class="pop-time">{{ time(item) }}</span>
          <strong class="pop-title">{{ item.title }}</strong>
          <span v-if="location(item)" class="pop-meta">{{ location(item) }}</span>
        </template>
        <template v-else>
          <span class="pop-date">{{ date(item) }}</span>
          <strong class="pop-title">{{ item.title }}</strong>
          <span class="pop-row"><Icon name="lucide:clock" aria-hidden="true" />{{ time(item) }}</span>
          <span class="pop-row"><Icon name="lucide:map-pin" aria-hidden="true" />{{ location(item) || 'Locatie nog niet ingevuld' }}</span>
          <span v-if="item.eventType" class="pop-row"><Icon name="lucide:tag" aria-hidden="true" />{{ item.eventType }}</span>
          <span v-if="item.assignedUserName" class="pop-row"><Icon name="lucide:user" aria-hidden="true" />{{ item.assignedUserName }}</span>
          <span class="pop-status">{{ labelFor(gigStatusLabels, item.status) }}</span>
          <span class="pop-open">Gig openen <Icon name="lucide:arrow-right" aria-hidden="true" /></span>
        </template>
      </NuxtLink>
    </div>
  </Teleport>
</template>

<style scoped>
.gig-popover { position: fixed; z-index: var(--z-overlay); display: grid; gap: .35rem; width: min(280px, calc(100vw - 16px)); padding: .7rem .8rem; border: 1px solid #3a3242; border-radius: .8rem; background: #17131c; box-shadow: 0 18px 44px rgba(0,0,0,.55); color: #fff; }
.gig-popover.compact { width: min(240px, calc(100vw - 16px)); gap: .15rem; padding: .5rem .55rem; }
.pop-gig { display: grid; gap: .25rem; padding: .15rem; border-radius: .5rem; color: inherit; text-decoration: none; }
.compact .pop-gig { gap: .05rem; padding: .3rem .4rem; border-left: 2px solid #8e3de0; border-radius: .35rem; }
.compact .pop-gig[data-status="lead"] { border-left-color: #5bb9ff; border-left-style: dashed; }
.compact .pop-gig:hover, .compact .pop-gig:focus-visible { background: #221b2a; }
.pop-date { margin: 0; color: #c9b2df; font-size: .7rem; font-weight: 700; letter-spacing: .04em; text-transform: capitalize; }
.compact > .pop-date { padding: 0 .4rem .15rem; text-transform: none; }
.pop-title { font-size: .9rem; line-height: 1.25; }
.compact .pop-title { overflow: hidden; font-size: .75rem; text-overflow: ellipsis; white-space: nowrap; }
.pop-time { color: #aaa2b2; font-size: .68rem; }
.pop-meta { overflow: hidden; color: #8f879c; font-size: .68rem; text-overflow: ellipsis; white-space: nowrap; }
.pop-row { display: flex; align-items: center; gap: .4rem; color: #cfc7da; font-size: .78rem; }
.pop-row :deep(svg) { flex: 0 0 auto; width: .85rem; height: .85rem; color: #8f879c; }
.pop-status { width: fit-content; padding: .1rem .45rem; border: 1px solid #453c4f; border-radius: 999px; color: #a69eae; font-size: .68rem; text-transform: uppercase; letter-spacing: .06em; }
.pop-open { display: flex; align-items: center; gap: .3rem; margin-top: .15rem; color: #c9b2df; font-size: .76rem; font-weight: 700; }
.pop-open :deep(svg) { width: .85rem; height: .85rem; }
</style>
