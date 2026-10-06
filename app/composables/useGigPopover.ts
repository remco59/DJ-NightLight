import type { PopoverGig } from '~~/shared/calendar'

/**
 * Hover/pin state for the agenda gig panel. Hovering shows it briefly; clicking pins it
 * so touch users (and multi-gig days) can reach the links inside.
 */
export function useGigPopover() {
  const gigs = ref<PopoverGig[]>([])
  const anchor = ref<DOMRect | null>(null)
  const pinned = ref(false)
  let timer: ReturnType<typeof setTimeout> | undefined

  function clear() {
    if (timer) clearTimeout(timer)
    timer = undefined
  }
  function open(event: Event, list: PopoverGig[], pin = false) {
    const element = event.currentTarget as Element | null
    if (!element || !list.length) return
    clear()
    gigs.value = list
    anchor.value = element.getBoundingClientRect()
    pinned.value = pin
  }
  function show(event: Event, list: PopoverGig[]) {
    if (pinned.value) return
    open(event, list)
  }
  function pin(event: Event, list: PopoverGig[]) {
    open(event, list, true)
  }
  function close() {
    clear()
    anchor.value = null
    pinned.value = false
  }
  function scheduleClose() {
    if (pinned.value) return
    clear()
    timer = setTimeout(close, 140)
  }
  onBeforeUnmount(clear)

  return { gigs, anchor, pinned, show, pin, close, scheduleClose, cancelClose: clear }
}
