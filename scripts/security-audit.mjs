import { spawnSync } from 'node:child_process'

const ALLOWED_ADVISORIES = new Set([
  // node-forge is pulled in by Nuxt's development listener (listhen) for
  // self-signed local HTTPS certificates. The production Docker image copies
  // only Nuxt's built .output directory, so node-forge is not present at
  // runtime. There is currently no patched release for this advisory.
  'https://github.com/advisories/GHSA-86w9-cpqp-85rv',
])

const result = spawnSync(
  'npm',
  ['audit', '--omit=dev', '--audit-level=high', '--json'],
  { encoding: 'utf8', shell: process.platform === 'win32' },
)

let report
try {
  report = JSON.parse(result.stdout || '{}')
} catch {
  process.stderr.write(result.stderr || result.stdout || 'npm audit returned invalid JSON\n')
  process.exit(1)
}

const vulnerabilities = report.vulnerabilities ?? {}

function terminalAdvisories(name, seen = new Set()) {
  if (seen.has(name)) return []
  seen.add(name)

  const vulnerability = vulnerabilities[name]
  if (!vulnerability) return []

  const terminals = []
  for (const via of vulnerability.via ?? []) {
    if (typeof via === 'string') {
      terminals.push(...terminalAdvisories(via, seen))
      continue
    }

    if (via?.url) terminals.push(via.url)
  }
  return terminals
}

const severe = Object.entries(vulnerabilities).filter(([, vulnerability]) =>
  vulnerability.severity === 'high' || vulnerability.severity === 'critical'
)

const blocked = severe.filter(([name]) => {
  const advisories = terminalAdvisories(name)
  return advisories.length === 0 || advisories.some(url => !ALLOWED_ADVISORIES.has(url))
})

const allowed = severe.filter(([name]) => !blocked.some(([blockedName]) => blockedName === name))

if (allowed.length) {
  console.warn(
    'Ignoring known build-only advisory chain: ' +
    allowed.map(([name]) => name).join(', '),
  )
}

if (blocked.length) {
  console.error('High/critical production dependency vulnerabilities found:')
  for (const [name, vulnerability] of blocked) {
    console.error(`- ${name} (${vulnerability.severity})`)
  }
  process.exit(1)
}

console.log('No unapproved high/critical production dependency vulnerabilities found.')
