const defaultStorageRoot = process.env.NODE_ENV === 'production' ? '/app/storage' : '.data'

export default defineNuxtConfig({
  compatibilityDate: '2026-09-19',
  devtools: { enabled: false },
  modules: ['@nuxt/eslint', '@nuxt/icon', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css', '~/assets/css/media-hub.css'],
  icon: {
    // Lucide ships with the app: icons used in components are bundled into the
    // client, anything else is served by our own server. Never call the Iconify CDN.
    mode: 'svg',
    serverBundle: { collections: ['lucide'] },
    clientBundle: { scan: true },
    fallbackToApi: false,
  },
  nitro: {
    // Pre-compress /_nuxt JS/CSS (gzip + brotli) at build time; the live proxy
    // served them uncompressed (~325 KB extra per first visit).
    compressPublicAssets: true,
  },
  routeRules: {
    // Fonts and brand images are not content-hashed, so a month rather than "immutable".
    '/fonts/**': { headers: { 'cache-control': 'public, max-age=2592000' } },
    '/brand/**': { headers: { 'cache-control': 'public, max-age=2592000' } },
    // The admin service worker lives at the root but controls only /admin; it
    // must always be revalidated so updates roll out.
    '/admin-sw.js': { headers: { 'cache-control': 'no-cache', 'service-worker-allowed': '/admin' } },
    '/admin.webmanifest': { headers: { 'content-type': 'application/manifest+json', 'cache-control': 'public, max-age=86400' } },
  },
  vite: {
    // The video editor preview imports these lazily; pre-bundle them so the
    // dev server does not re-optimize (and break the in-flight import) on first use.
    optimizeDeps: { include: ['react', 'react-dom/client', 'remotion', '@remotion/player'] },
  },
  runtimeConfig: {
    appVersion: process.env.NUXT_APP_VERSION || 'development',
    ownerBootstrapToken: process.env.OWNER_BOOTSTRAP_TOKEN || '',
    stripeSecretKey: process.env.STRIPE_RESTRICTED_KEY || '',
    stripeWebhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
    googleCalendar: {
      clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID || '',
      clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET || '',
      refreshToken: process.env.GOOGLE_CALENDAR_REFRESH_TOKEN || '',
    },
    email: {
      apiKey: process.env.RESEND_API_KEY || '',
      from: process.env.EMAIL_FROM || '',
      reviewUrl: process.env.REVIEW_URL || '',
    },
    storageUploads: process.env.NUXT_STORAGE_UPLOADS || `${defaultStorageRoot}/uploads`,
    storageGenerated: process.env.NUXT_STORAGE_GENERATED || `${defaultStorageRoot}/generated`,
    // Optional read-only folder whose files are linked into the media library without copying. Empty disables it.
    storageLibrary: process.env.NUXT_STORAGE_LIBRARY || '',
    storageBackups: process.env.NUXT_STORAGE_BACKUPS || `${defaultStorageRoot}/backups`,
    // Self-update sidecar (docker-compose.unraid.yml → updater). Empty disables updates.
    updater: {
      url: process.env.NUXT_UPDATER_URL || '',
      token: process.env.NUXT_UPDATER_TOKEN || '',
    },
    session: {
      password: process.env.NUXT_SESSION_PASSWORD || '',
      cookie: {
        secure: process.env.NUXT_SESSION_COOKIE_SECURE !== undefined
          ? process.env.NUXT_SESSION_COOKIE_SECURE === 'true'
          : process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      },
    },
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    },
  },
  app: {
    head: {
      htmlAttrs: { lang: 'nl' },
      title: 'DJ NightLight',
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
        { rel: 'icon', href: '/favicon.ico', sizes: 'any' },
        { rel: 'icon', type: 'image/png', sizes: '32x32', href: '/favicon-32.png' },
        { rel: 'preload', href: '/fonts/Archivo-Variable.woff2', as: 'font', type: 'font/woff2', crossorigin: '' },
      ],
      meta: [
        { name: 'description', content: 'DJ NightLight — DJ, events and nightlife.' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
})
