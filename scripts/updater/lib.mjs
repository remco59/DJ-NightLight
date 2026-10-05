// Pure helpers for the self-update sidecar. Kept free of I/O so they can be
// unit-tested from the main test suite.

/** Converts an SSH or HTTPS git remote to an HTTPS URL the sidecar can fetch without SSH keys. */
export function toHttpsRemote(remote) {
  const value = String(remote || '').trim()
  if (!value) return null
  const scp = /^[\w.-]+@([\w.-]+):(.+)$/.exec(value)
  if (scp) return `https://${scp[1]}/${scp[2].replace(/^\/+/, '')}`
  try {
    const url = new URL(value)
    if (url.protocol === 'ssh:' || url.protocol === 'git:' || url.protocol === 'http:' || url.protocol === 'https:') {
      return `https://${url.hostname}${url.pathname}`
    }
  } catch {
    // Not a URL; fall through.
  }
  return null
}

/** Git config entries (for GIT_CONFIG_COUNT/KEY/VALUE) that authenticate HTTPS fetches without putting the token in argv. */
export function gitAuthConfig(httpsRemote, token) {
  if (!token || !httpsRemote) return []
  const origin = new URL(httpsRemote).origin
  const basic = Buffer.from(`x-access-token:${token}`).toString('base64')
  return [[`http.${origin}/.extraheader`, `AUTHORIZATION: basic ${basic}`]]
}

export const COMMIT_FORMAT = '%H%x1f%s%x1f%an%x1f%cI%x1e'

/** Parses `git log --format=${COMMIT_FORMAT}` output. */
export function parseCommits(output) {
  return String(output || '')
    .split('\x1e')
    .map(record => record.trim())
    .filter(Boolean)
    .map((record) => {
      const [sha = '', subject = '', author = '', date = ''] = record.split('\x1f')
      return { sha, shortSha: sha.slice(0, 7), subject, author, date }
    })
}

/** Services the sidecar recreates: everything in the Compose project except itself. */
export function servicesToUpdate(allServices, ownService) {
  return String(allServices || '')
    .split('\n')
    .map(name => name.trim())
    .filter(name => name && name !== ownService)
}

/** Removes a secret from text before it reaches logs or the API. */
export function redact(text, secrets) {
  let result = String(text)
  for (const secret of secrets) {
    if (secret && secret.length >= 4) result = result.split(secret).join('***')
  }
  return result
}

export const MAINTENANCE_PHASES = new Set(['updating'])
export const BUSY_PHASES = new Set(['preparing', 'updating'])
