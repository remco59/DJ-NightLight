import type { Ref } from 'vue'

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * Keeps keyboard focus inside a custom modal while it is open: focus moves in
 * on open, Tab cycles within it, and focus returns to the opener on close.
 */
export function useFocusTrap(container: Ref<HTMLElement | null>, active: Ref<boolean>) {
  let opener: HTMLElement | null = null

  function focusables() {
    return Array.from(container.value?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? [])
      .filter(element => element.offsetParent !== null || element === document.activeElement)
  }

  function onKeydown(event: KeyboardEvent) {
    if (event.key !== 'Tab' || !container.value) return
    const items = focusables()
    if (!items.length) return
    const first = items[0]!
    const last = items[items.length - 1]!
    if (event.shiftKey && (document.activeElement === first || !container.value.contains(document.activeElement))) {
      event.preventDefault()
      last.focus()
    } else if (!event.shiftKey && (document.activeElement === last || !container.value.contains(document.activeElement))) {
      event.preventDefault()
      first.focus()
    }
  }

  watch(active, async (open) => {
    if (!import.meta.client) return
    if (open) {
      opener = document.activeElement as HTMLElement | null
      await nextTick()
      const preferred = container.value?.querySelector<HTMLElement>('[autofocus]') ?? focusables()[0]
      preferred?.focus()
      document.addEventListener('keydown', onKeydown)
    } else {
      document.removeEventListener('keydown', onKeydown)
      opener?.focus?.()
      opener = null
    }
  }, { immediate: true })

  onBeforeUnmount(() => document.removeEventListener('keydown', onKeydown))
}
