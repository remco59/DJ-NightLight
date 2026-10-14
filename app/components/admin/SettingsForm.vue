<script setup lang="ts">
// A settings card: heading, a two-column form grid (use class "wide" for a full-width field) and a save row.
defineProps<{
  title: string
  description: string
  icon: string
  saving?: boolean
  message?: string
  failed?: boolean
}>()
defineEmits<{ save: [] }>()
</script>

<template>
  <form class="card" @submit.prevent="$emit('save')">
    <div class="heading">
      <span class="icon"><Icon :name="icon" aria-hidden="true" /></span>
      <div><h2>{{ title }}</h2><p>{{ description }}</p></div>
    </div>
    <div class="grid"><slot /></div>
    <slot name="extra" />
    <div class="actions">
      <span v-if="message" :class="{ error: failed }" role="status">{{ message }}</span>
      <slot name="actions" />
      <button type="submit" :disabled="saving">{{ saving ? 'Opslaan…' : 'Wijzigingen opslaan' }}</button>
    </div>
  </form>
</template>

<style scoped>
.card{padding:1.15rem;border:1px solid var(--border);border-radius:1rem;background:linear-gradient(180deg,#111016,#0f0d13)}
.heading{display:flex;align-items:flex-start;gap:.8rem;margin-bottom:1rem}
.heading h2{margin:0;font-size:1.25rem}
.heading p{margin:.25rem 0 0;color:var(--text-subtle);font-size:.8rem}
.icon{display:grid;place-items:center;flex:0 0 2.55rem;width:2.55rem;height:2.55rem;border-radius:.75rem;background:#28164a;color:#bd91ff}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.8rem}
.grid :deep(.wide){grid-column:1/-1}
.grid :deep(label){display:grid;gap:.35rem;color:var(--text-muted);font-size:.75rem}
.grid :deep(label small){color:var(--text-subtle)}
.grid :deep(input),.grid :deep(select),.grid :deep(textarea){width:100%;border:1px solid var(--border-strong);border-radius:.65rem;padding:.72rem;background:#09080b;color:var(--text)}
.grid :deep(input:focus),.grid :deep(select:focus),.grid :deep(textarea:focus){outline:none;border-color:#7144b5;box-shadow:0 0 0 3px rgba(113,68,181,.13)}
.actions{display:flex;align-items:center;justify-content:flex-end;gap:1rem;margin-top:1rem;min-height:2.4rem}
.actions>span{margin-right:auto;color:var(--text-muted);font-size:.78rem}
.actions>span.error{color:#ff9d9d}
.actions :slotted(button),button{display:inline-flex;align-items:center;justify-content:center;gap:.4rem;border:0;border-radius:.68rem;padding:.68rem .95rem;background:linear-gradient(135deg,#7737f2,#5c25d9);color:#fff;font-weight:800;cursor:pointer}
button:disabled,.actions :slotted(button:disabled){opacity:.55;cursor:not-allowed}
.actions :slotted(.outline){border:1px solid var(--border-strong);background:transparent;color:var(--text)}
@media(max-width:640px){.grid{grid-template-columns:1fr}.grid :deep(.wide){grid-column:auto}.actions{flex-wrap:wrap}}
</style>
