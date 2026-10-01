<script setup lang="ts">
const state = useConfirmState()
const dialog = ref<HTMLDialogElement | null>(null)
const confirmButton = ref<HTMLButtonElement | null>(null)
const cancelButton = ref<HTMLButtonElement | null>(null)

watch(() => state.open, async (open) => {
  await nextTick()
  if (!dialog.value) return
  if (open && !dialog.value.open) {
    dialog.value.showModal()
    // Destructive actions start on "Annuleren" so Enter never deletes by accident.
    ;(state.tone === 'danger' ? cancelButton.value : confirmButton.value)?.focus()
  } else if (!open && dialog.value.open) {
    dialog.value.close()
  }
})

function settle(value: 'confirm' | 'secondary' | null) {
  const resolve = state.resolve
  state.open = false
  state.resolve = null
  resolve?.(value)
}
</script>

<template>
  <dialog ref="dialog" class="confirm-dialog" aria-labelledby="confirm-title" :aria-describedby="state.body ? 'confirm-body' : undefined" @cancel.prevent="settle(null)">
    <h2 id="confirm-title">{{ state.title }}</h2>
    <p v-if="state.body" id="confirm-body">{{ state.body }}</p>
    <div class="confirm-actions">
      <button ref="cancelButton" type="button" class="confirm-cancel" @click="settle(null)">{{ state.cancelLabel || 'Annuleren' }}</button>
      <button v-if="state.secondaryLabel" type="button" class="confirm-cancel" @click="settle('secondary')">{{ state.secondaryLabel }}</button>
      <button ref="confirmButton" type="button" class="confirm-ok" :class="{ danger: state.tone === 'danger' }" @click="settle('confirm')">{{ state.confirmLabel || 'Doorgaan' }}</button>
    </div>
  </dialog>
</template>

<style scoped>
.confirm-dialog{width:min(34rem,calc(100% - 2rem));padding:1.4rem;border:1px solid var(--border-strong);border-radius:1rem;background:#141119;color:var(--text)}
.confirm-dialog::backdrop{background:rgba(5,4,7,.72)}
.confirm-dialog h2{margin:0 0 .5rem;font-size:1.25rem;line-height:1.25}
.confirm-dialog p{margin:0;color:var(--text-muted);line-height:1.55}
.confirm-actions{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:.5rem;margin-top:1.4rem}
.confirm-actions button{min-height:2.75rem;border:0;border-radius:.65rem;padding:.7rem 1rem;font-weight:800;cursor:pointer}
.confirm-cancel{background:var(--button-secondary-bg);color:var(--button-secondary-fg)}
.confirm-ok{background:var(--button-primary-bg);color:var(--button-primary-fg)}
.confirm-ok.danger{background:var(--button-danger-bg);color:var(--button-danger-fg)}
@media(max-width:520px){.confirm-actions{flex-direction:column-reverse}}
</style>
