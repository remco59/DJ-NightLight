import { describe, expect, it } from 'vitest'
import { bypassesMaintenance } from '../shared/system-update'
import {
  gitAuthConfig,
  parseCommits,
  redact,
  servicesToUpdate,
  toHttpsRemote,
} from '../scripts/updater/lib.mjs'

describe('updater git remotes', () => {
  it('converts SSH and HTTPS remotes to token-free HTTPS URLs', () => {
    expect(toHttpsRemote('git@github.com:remco59/DJ-NightLight.git')).toBe('https://github.com/remco59/DJ-NightLight.git')
    expect(toHttpsRemote('ssh://git@github.com/remco59/DJ-NightLight.git')).toBe('https://github.com/remco59/DJ-NightLight.git')
    expect(toHttpsRemote('https://user:secret@github.com/remco59/DJ-NightLight.git')).toBe('https://github.com/remco59/DJ-NightLight.git')
    expect(toHttpsRemote('')).toBeNull()
    expect(toHttpsRemote('not a remote')).toBeNull()
  })

  it('only adds an auth header when a token is configured', () => {
    expect(gitAuthConfig('https://github.com/a/b.git', '')).toEqual([])
    const [[key, value]] = gitAuthConfig('https://github.com/a/b.git', 'ghp_token')
    expect(key).toBe('http.https://github.com/.extraheader')
    expect(value).toBe(`AUTHORIZATION: basic ${Buffer.from('x-access-token:ghp_token').toString('base64')}`)
  })
})

describe('updater helpers', () => {
  it('parses git log records', () => {
    const output = 'abcdef1234567\x1fFix things\x1fRemco\x1f2026-09-01T10:00:00+02:00\x1e\n'
      + '1234567abcdef\x1fAdd | pipes\x1fClaude\x1f2026-09-02T10:00:00+02:00\x1e\n'
    expect(parseCommits(output)).toEqual([
      { sha: 'abcdef1234567', shortSha: 'abcdef1', subject: 'Fix things', author: 'Remco', date: '2026-09-01T10:00:00+02:00' },
      { sha: '1234567abcdef', shortSha: '1234567', subject: 'Add | pipes', author: 'Claude', date: '2026-09-02T10:00:00+02:00' },
    ])
    expect(parseCommits('')).toEqual([])
  })

  it('never recreates the updater itself during an update', () => {
    expect(servicesToUpdate('db\nmigrate\nweb\nupdater\n', 'updater')).toEqual(['db', 'migrate', 'web'])
  })

  it('redacts secrets from logs', () => {
    expect(redact('fetch https://x-access-token:abcd1234@github.com', ['abcd1234', ''])).toBe('fetch https://x-access-token:***@github.com')
  })
})

describe('maintenance mode', () => {
  it('keeps health checks, the status poll and webhooks reachable', () => {
    for (const path of ['/api/health', '/api/ready', '/api/maintenance', '/api/webhooks/stripe', '/fonts/ArchivoBlack-Regular.woff2']) {
      expect(bypassesMaintenance(path)).toBe(true)
    }
  })

  it('blocks pages and other API routes', () => {
    for (const path of ['/', '/admin/settings', '/api/admin/system/update', '/api/public/agenda', '/_nuxt/entry.js']) {
      expect(bypassesMaintenance(path)).toBe(false)
    }
  })
})
