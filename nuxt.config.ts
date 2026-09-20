export default defineNuxtConfig({
  compatibilityDate: '2026-09-19',
  devtools: { enabled: true },
  modules: ['@nuxt/eslint', 'nuxt-auth-utils'],
  css: ['~/assets/css/main.css'],
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
    session: {
      password: process.env.NUXT_SESSION_PASSWORD || '',
      cookie: {
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
      },
    },
    public: {
      siteUrl: process.env.NUXT_PUBLIC_SITE_URL || 'http://localhost:3000',
    },
  },
  app: {
    head: {
      title: 'DJ NightLight',
      meta: [
        { name: 'description', content: 'DJ NightLight — DJ, events and nightlife.' },
        { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      ],
    },
  },
})
