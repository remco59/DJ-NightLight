import { fileURLToPath } from 'node:url'
import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  // The Vue plugin lets component tests import .vue pages; Nuxt's `~`/`~~` aliases are mirrored here.
  plugins: [vue()],
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('.', import.meta.url)),
      '~': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
  test: {
    environment: 'happy-dom',
    include: ['tests/**/*.test.ts'],
  },
})
