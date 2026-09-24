<script setup lang="ts">
import DesktopPostEditor from '~/components/post-editor/DesktopPostEditor.vue'
import MobilePostEditor from '~/components/post-editor/MobilePostEditor.vue'
import { createPostEditor, postEditorKey, type PostGeneratorData } from '~/composables/usePostEditor'

definePageMeta({ layout: 'admin' })

const { data, refresh } = await useFetch<PostGeneratorData>('/api/admin/post-generator')
const editor = createPostEditor({ data, refresh: () => refresh() })
provide(postEditorKey, editor)

// Both layouts are server-rendered and CSS picks one for the first paint; once
// the viewport is known only the matching editor stays mounted, so there is a
// single live canvas. Editor state is shared, so resizing across the
// breakpoint keeps every edit.
const layout = ref<'pending' | 'mobile' | 'desktop'>('pending')
let mobileQuery: MediaQueryList | null = null

function updateLayout() {
  layout.value = mobileQuery?.matches ? 'mobile' : 'desktop'
}

onMounted(() => {
  mobileQuery = window.matchMedia('(max-width: 720px)')
  updateLayout()
  mobileQuery.addEventListener('change', updateLayout)
})

onBeforeUnmount(() => {
  mobileQuery?.removeEventListener('change', updateLayout)
})
</script>

<template>
  <div class="post-generator">
    <DesktopPostEditor v-if="layout !== 'mobile'" class="desktop-layout" />
    <MobilePostEditor v-if="layout !== 'desktop'" class="mobile-layout" />
  </div>
</template>

<style scoped>
.post-generator {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  width: 100%;
  min-width: 0;
  min-height: 0;
}

.post-generator > * {
  flex: 1 1 auto;
  min-height: 0;
}

/* Scoped under the page class so these win over the editors' own display rules. */
.post-generator > .mobile-layout {
  display: none;
}

@media (max-width: 720px) {
  .post-generator > .desktop-layout {
    display: none;
  }

  .post-generator > .mobile-layout {
    display: flex;
  }
}
</style>
