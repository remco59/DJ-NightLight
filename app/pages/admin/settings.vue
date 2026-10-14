<script setup lang="ts">
import type { StaffRole } from '~~/shared/auth'

definePageMeta({ layout: 'admin', middleware: 'settings-access' })

const route = useRoute()
const { user } = useUserSession()
const groups = computed(() => settingsGroupsFor(user.value?.role as StaffRole | undefined))
const current = computed(() => route.path.replace(/\/+$/, ''))
const activeGroup = computed(() => groups.value.find(group => group.sections.some(section => section.to === current.value)) ?? groups.value[0])
const sectionCount = computed(() => groups.value.reduce((total, group) => total + group.sections.length, 0))

// Phone: the two levels become one picker.
const picked = computed({
  get: () => current.value,
  set: (to: string) => { void navigateTo(to) },
})
</script>

<template>
  <div class="settings-shell">
    <header class="settings-head">
      <h1>Instellingen</h1>

      <template v-if="sectionCount > 1">
        <label class="settings-picker">
          <span class="sr-only">Ga naar instelling</span>
          <select v-model="picked">
            <optgroup v-for="group in groups" :key="group.label" :label="group.label">
              <option v-for="section in group.sections" :key="section.to" :value="section.to">{{ section.label }}</option>
            </optgroup>
          </select>
        </label>

        <nav class="settings-groups" aria-label="Instellingen categorieën">
          <NuxtLink
            v-for="group in groups"
            :key="group.label"
            :to="group.sections[0]!.to"
            :class="{ active: group === activeGroup }"
            :aria-current="group === activeGroup ? 'true' : undefined"
          >{{ group.label }}</NuxtLink>
        </nav>

        <nav v-if="activeGroup && activeGroup.sections.length > 1" class="settings-sections" :aria-label="activeGroup.label">
          <NuxtLink
            v-for="section in activeGroup.sections"
            :key="section.to"
            :to="section.to"
            :class="{ active: current === section.to }"
            :aria-current="current === section.to ? 'page' : undefined"
          >
            <Icon :name="section.icon" aria-hidden="true" />
            {{ section.label }}
          </NuxtLink>
        </nav>
      </template>
    </header>

    <div class="settings-content">
      <NuxtPage />
    </div>
  </div>
</template>

<style scoped>
.settings-shell{max-width:1180px;margin-inline:auto;padding-bottom:4rem}
.settings-head{margin-bottom:1.4rem}
.settings-head h1{margin:0 0 .9rem;font-size:clamp(1.9rem,4vw,2.6rem);letter-spacing:-.04em}
.settings-picker{display:none}
.settings-picker select{width:100%;min-height:2.75rem;padding:.65rem .8rem;border:1px solid var(--border-strong);border-radius:.7rem;background:#09080b;color:var(--text);font-size:.9rem}
.settings-groups{display:flex;gap:.5rem;flex-wrap:wrap}
.settings-groups a{display:inline-flex;align-items:center;min-height:2.65rem;padding:.6rem 1rem;border:1px solid var(--border-strong);border-radius:.72rem;background:#0d0b10;color:#cfc6d6;font-size:.82rem;font-weight:760;text-decoration:none}
.settings-groups a:hover{border-color:#583c78;color:#fff}
.settings-groups a.active{border-color:#6f42c1;background:linear-gradient(135deg,#5526aa,#6f35df);color:#fff;box-shadow:0 8px 26px rgba(84,38,170,.18)}
.settings-sections{display:flex;gap:.25rem;flex-wrap:wrap;margin-top:.9rem;padding-bottom:.9rem;border-bottom:1px solid var(--border)}
.settings-sections a{display:inline-flex;align-items:center;gap:.45rem;min-height:2.5rem;padding:.5rem .8rem;border-radius:.6rem;color:#b8b2c1;font-size:.84rem;text-decoration:none}
.settings-sections a svg{width:1rem;height:1rem;flex:0 0 auto;color:var(--text-subtle)}
.settings-sections a:hover{background:#17141c;color:#fff}
.settings-sections a.active{background:#201b29;color:#fff}
.settings-sections a:hover svg,.settings-sections a.active svg{color:#c7b5de}
.settings-content{min-width:0}
@media(max-width:700px){
  .settings-picker{display:block}
  .settings-groups,.settings-sections{display:none}
}
</style>
