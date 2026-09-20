export default defineEventHandler((event) => {
  setHeader(event, 'x-content-type-options', 'nosniff')
  setHeader(event, 'x-frame-options', 'DENY')
  setHeader(event, 'referrer-policy', 'strict-origin-when-cross-origin')
  setHeader(event, 'permissions-policy', 'camera=(), microphone=(), geolocation=(), payment=()')
  setHeader(event, 'content-security-policy', "frame-ancestors 'none'; object-src 'none'; base-uri 'self'")
  if (process.env.NODE_ENV === 'production') {
    setHeader(event, 'strict-transport-security', 'max-age=31536000; includeSubDomains')
  }
})
