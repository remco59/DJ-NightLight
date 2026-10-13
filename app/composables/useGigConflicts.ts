export type GigConflict = {
  id: string
  title: string
  status: 'lead' | 'booked'
  startsAt: string | null
  endsAt: string | null
}

type ConflictTimes = {
  startsAt: string | null
  endsAt?: string | null
  loadInAt?: string | null
  excludeId?: string
}

/**
 * Leads and booked gigs that overlap the times in `times`. Re-checks shortly after
 * the times change and quietly stays empty when offline or on an error: the warning
 * is a hint, never a blocker.
 */
export function useGigConflicts(times: () => ConflictTimes) {
  const conflicts = ref<GigConflict[]>([])
  let timer: ReturnType<typeof setTimeout> | undefined
  let latest = 0

  async function check() {
    const current = times()
    const request = ++latest
    if (!current.startsAt) {
      conflicts.value = []
      return
    }
    try {
      const result = await $fetch<{ conflicts: GigConflict[] }>('/api/admin/gigs/conflicts', {
        query: {
          startsAt: current.startsAt,
          endsAt: current.endsAt || undefined,
          loadInAt: current.loadInAt || undefined,
          excludeId: current.excludeId,
        },
      })
      if (request === latest) conflicts.value = result.conflicts
    }
    catch {
      if (request === latest) conflicts.value = []
    }
  }

  watch(times, () => {
    clearTimeout(timer)
    timer = setTimeout(check, 400)
  }, { deep: true })
  onMounted(check)
  onBeforeUnmount(() => clearTimeout(timer))

  return { conflicts }
}
