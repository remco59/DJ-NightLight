import type { WatchSource } from 'vue'

/**
 * Tracks whether an editor's state differs from what was last saved, and asks
 * before navigating away or closing the tab while it does. Call `markSaved()`
 * after a successful save (or a reload of the saved state).
 */
export function useUnsavedChanges(source: WatchSource<unknown>, message = 'Je hebt niet-opgeslagen wijzigingen. Toch weggaan?') {
  const read = () => JSON.stringify(typeof source === 'function' ? source() : unref(source as Ref<unknown>))
  const saved = ref(read())
  const current = ref(saved.value)
  watch(source, () => { current.value = read() }, { deep: true })

  const isDirty = computed(() => current.value !== saved.value)
  function markSaved() {
    saved.value = read()
    current.value = saved.value
  }

  onBeforeRouteLeave(() => {
    if (isDirty.value && !window.confirm(message)) return false
  })
  function warnBeforeUnload(event: BeforeUnloadEvent) {
    if (isDirty.value) event.preventDefault()
  }
  onMounted(() => window.addEventListener('beforeunload', warnBeforeUnload))
  onBeforeUnmount(() => window.removeEventListener('beforeunload', warnBeforeUnload))

  return { isDirty, markSaved }
}
