<script setup lang="ts">
import PostTemplateCard from '~/components/post-editor/PostTemplateCard.vue'
import { usePostEditor } from '~/composables/usePostEditor'
import type { PostTemplateKey } from '~~/shared/post-generator'

defineProps<{ thumbnails: Record<string, string> }>()

const open = defineModel<boolean>('open', { required: true })

const editor = usePostEditor()
const { design, templates } = editor

const category = ref('all')
const closeRef = ref<HTMLButtonElement | null>(null)
const categories = computed(() => [...new Set(templates.map(template => template.category))])
const visibleTemplates = computed(() => category.value === 'all'
  ? templates
  : templates.filter(template => template.category === category.value))

function choose(key: PostTemplateKey) {
  editor.applyTemplate(key)
  open.value = false
}

watch(open, (value) => {
  if (value) void nextTick(() => closeRef.value?.focus())
})
</script>

<template>
  <Teleport to="body">
    <div v-if="open" class="backdrop" @click.self="open = false" @keydown.esc="open = false">
      <section class="dialog" role="dialog" aria-modal="true" aria-labelledby="post-template-browser-title">
        <header class="dialog-head">
          <div>
            <h2 id="post-template-browser-title">Templates</h2>
            <p>Templates bepalen de layout en huisstijl; je tekst en foto blijven behouden.</p>
          </div>
          <button ref="closeRef" type="button" class="close" aria-label="Sluiten" @click="open = false">
            <Icon name="lucide:x" aria-hidden="true" />
          </button>
        </header>

        <div class="filters" role="group" aria-label="Templatecategorie">
          <button type="button" :class="{ active: category === 'all' }" :aria-pressed="category === 'all'" @click="category = 'all'">
            Alle <span>{{ templates.length }}</span>
          </button>
          <button
            v-for="item in categories"
            :key="item"
            type="button"
            :class="{ active: category === item }"
            :aria-pressed="category === item"
            @click="category = item"
          >
            {{ item }} <span>{{ templates.filter(template => template.category === item).length }}</span>
          </button>
        </div>

        <div class="grid">
          <PostTemplateCard
            v-for="template in visibleTemplates"
            :key="template.key"
            :template="template"
            :thumbnail="thumbnails[template.key]"
            :selected="design.templateKey === template.key"
            detailed
            @select="choose(template.key)"
          />
        </div>
      </section>
    </div>
  </Teleport>
</template>

<style scoped>
.backdrop {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: grid;
  place-items: center;
  padding: 1.5rem;
  background: rgba(4, 3, 6, .74);
  backdrop-filter: blur(10px);
}

.dialog {
  display: flex;
  flex-direction: column;
  width: min(980px, 100%);
  max-height: calc(100dvh - 3rem);
  overflow: hidden;
  border: 1px solid #2d2833;
  border-radius: 1.1rem;
  background: #0f0d13;
  box-shadow: 0 30px 100px rgba(0, 0, 0, .6);
}

.dialog-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  padding: 1.2rem 1.3rem .9rem;
}

.dialog-head h2 {
  margin: 0;
  font-size: 1.3rem;
  letter-spacing: -.02em;
}

.dialog-head p {
  margin: .3rem 0 0;
  color: #8f8798;
  font-size: .8rem;
}

.close {
  display: grid;
  width: 2.2rem;
  height: 2.2rem;
  place-items: center;
  border: 1px solid #2d2833;
  border-radius: .6rem;
  background: #151119;
  color: #d4ced9;
  cursor: pointer;
}

.filters {
  display: flex;
  flex-wrap: wrap;
  gap: .45rem;
  padding: 0 1.3rem 1rem;
  border-bottom: 1px solid #1f1b24;
}

.filters button {
  display: inline-flex;
  align-items: center;
  gap: .4rem;
  padding: .4rem .75rem;
  border: 1px solid #2a2530;
  border-radius: 999px;
  background: transparent;
  color: #bdb6c6;
  font-size: .76rem;
  cursor: pointer;
}

.filters button span {
  color: #6f6879;
  font-size: .68rem;
}

.filters button.active {
  border-color: #7c3aed;
  background: rgba(124, 58, 237, .16);
  color: #fff;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(170px, 1fr));
  gap: 1.3rem 1rem;
  overflow: auto;
  padding: 1.2rem 1.3rem 1.5rem;
}
</style>
