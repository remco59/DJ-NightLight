export default defineEventHandler(() => ({
  status: 'ok',
  service: 'dj-nightlight',
  timestamp: new Date().toISOString(),
}))
