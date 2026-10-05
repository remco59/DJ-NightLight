// Self-update sidecar. Runs next to the Compose stack with the Docker socket and
// the server checkout mounted, and exposes a small token-protected HTTP API on
// the private backend network. The web app calls it from Admin → Settings to
// check GitHub for new commits and to pull + rebuild + restart the stack; while
// an update runs the web app shows a maintenance page.
import { spawn } from 'node:child_process'
import { timingSafeEqual } from 'node:crypto'
import { existsSync, statSync } from 'node:fs'
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises'
import { createServer } from 'node:http'
import { hostname } from 'node:os'
import { join } from 'node:path'
import {
  BUSY_PHASES,
  COMMIT_FORMAT,
  MAINTENANCE_PHASES,
  gitAuthConfig,
  parseCommits,
  redact,
  servicesToUpdate,
  toHttpsRemote,
} from './lib.mjs'

const PORT = Number(process.env.PORT || 8080)
const TOKEN = process.env.UPDATER_TOKEN || ''
const BRANCH = process.env.UPDATER_BRANCH || 'main'
const GIT_TOKEN = process.env.UPDATER_GIT_TOKEN || ''
// Optional override of where to fetch from; defaults to the checkout's origin
// remote, rewritten to HTTPS so no SSH keys are needed.
const REMOTE_URL = process.env.UPDATER_REMOTE_URL || ''
const STATE_DIR = process.env.UPDATER_STATE_DIR || '/state'
const ENV_FILE = process.env.UPDATER_COMPOSE_ENV_FILE || '/run/nightlight/compose.env'
const WEB_HEALTH_URL = process.env.UPDATER_WEB_HEALTH_URL || 'http://web:3000/api/health'
const HEALTH_TIMEOUT_MS = Number(process.env.UPDATER_HEALTH_TIMEOUT_SECONDS || 300) * 1000
const LOG_LIMIT = 400
const SECRETS = [TOKEN, GIT_TOKEN, GIT_TOKEN && Buffer.from(`x-access-token:${GIT_TOKEN}`).toString('base64')]

// Commands get a minimal environment so the sidecar's own variables never leak
// into Compose interpolation of the stack's compose file.
const BASE_ENV = { PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin', HOME: '/root' }

let context = null
let configError = null
let lastCheck = null
let state = {
  phase: 'idle',
  step: null,
  message: null,
  startedAt: null,
  finishedAt: null,
  fromSha: null,
  toSha: null,
  log: [],
}

function log(line) {
  const text = redact(line, SECRETS).replace(/\s+$/, '')
  if (!text) return
  state.log.push(text)
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT)
  console.log(text)
  schedulePersist()
}

let persistTimer = null
function schedulePersist() {
  if (persistTimer) return
  persistTimer = setTimeout(() => {
    persistTimer = null
    void persist()
  }, 1000)
}

async function persist() {
  try {
    await mkdir(STATE_DIR, { recursive: true })
    const file = join(STATE_DIR, 'state.json')
    await writeFile(`${file}.tmp`, JSON.stringify(state))
    await rename(`${file}.tmp`, file)
  } catch (error) {
    console.error('Could not persist updater state', error)
  }
}

async function setState(patch) {
  state = { ...state, ...patch }
  if (patch.step) log(`==> ${patch.step}`)
  await persist()
}

async function loadState() {
  try {
    const saved = JSON.parse(await readFile(join(STATE_DIR, 'state.json'), 'utf8'))
    state = { ...state, ...saved, log: Array.isArray(saved.log) ? saved.log : [] }
    if (BUSY_PHASES.has(state.phase)) {
      state.phase = 'failed'
      state.step = null
      state.message = 'Onderbroken: de updater is herstart terwijl er een update liep.'
      state.finishedAt = new Date().toISOString()
      await persist()
    }
  } catch {
    // No previous state.
  }
}

function run(command, args, { cwd, env = {}, stream = false, check = true } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env: { ...BASE_ENV, ...env }, stdio: ['ignore', 'pipe', 'pipe'] })
    let stdout = ''
    let stderr = ''
    const collect = (target) => {
      let pending = ''
      return (chunk) => {
        const text = chunk.toString()
        if (target === 'out') stdout += text
        else stderr += text
        if (!stream) return
        pending += text
        const lines = pending.split(/\r?\n/)
        pending = lines.pop() || ''
        lines.forEach(log)
      }
    }
    child.stdout.on('data', collect('out'))
    child.stderr.on('data', collect('err'))
    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0 || !check) return resolve({ code, stdout, stderr })
      const lines = stderr.split('\n').map(line => line.trim()).filter(line => line && !/^[-=]+$/.test(line))
      const detail = redact(lines.slice(-3).join('\n'), SECRETS)
      reject(new Error(`${command} ${args[0]} is mislukt (exitcode ${code})${detail ? `: ${detail}` : ''}`))
    })
  })
}

function gitEnv(extra = []) {
  const entries = [['safe.directory', '*'], ...extra]
  const env = { GIT_TERMINAL_PROMPT: '0', GIT_CONFIG_COUNT: String(entries.length) }
  entries.forEach(([key, value], index) => {
    env[`GIT_CONFIG_KEY_${index}`] = key
    env[`GIT_CONFIG_VALUE_${index}`] = value
  })
  return env
}

function git(args, options = {}) {
  return run('git', args, { cwd: context.workingDir, env: gitEnv(options.auth), stream: options.stream })
}

function composeArgs() {
  return [
    'compose',
    '-p', context.project,
    '--project-directory', context.workingDir,
    ...context.configFiles.flatMap(file => ['-f', file]),
    '--env-file', ENV_FILE,
  ]
}

function compose(args, options = {}) {
  return run('docker', [...composeArgs(), ...args], { cwd: context.workingDir, stream: options.stream })
}

async function discover() {
  const { stdout } = await run('docker', ['inspect', hostname()])
  const [info] = JSON.parse(stdout)
  const labels = info?.Config?.Labels || {}
  const project = labels['com.docker.compose.project']
  const workingDir = labels['com.docker.compose.project.working_dir']
  const configFiles = (labels['com.docker.compose.project.config_files'] || '').split(',').filter(Boolean)
  if (!project || !workingDir || !configFiles.length) {
    throw new Error('De updater is niet via Docker Compose gestart.')
  }
  context = {
    project,
    workingDir,
    configFiles,
    service: labels['com.docker.compose.service'] || 'updater',
    containerId: info.Id,
    imageId: info.Image,
  }
}

function validate() {
  if (!TOKEN) return 'UPDATER_TOKEN is niet ingesteld.'
  if (!existsSync(join(context.workingDir, '.git'))) {
    return `De repository is niet gekoppeld op ${context.workingDir}. Zet NIGHTLIGHT_REPO_PATH=${context.workingDir} in het env-bestand en start de stack opnieuw.`
  }
  const missing = context.configFiles.find(file => !existsSync(file))
  if (missing) return `Compose-bestand ${missing} is niet leesbaar in de updater.`
  try {
    if (!statSync(ENV_FILE).size) throw new Error('empty')
  } catch {
    return 'Het env-bestand van de stack is niet gekoppeld. Zet NIGHTLIGHT_ENV_FILE op het absolute pad van het env-bestand.'
  }
  return null
}

async function commitInfo(ref) {
  const { stdout } = await git(['log', '-1', `--format=${COMMIT_FORMAT}`, ref])
  return parseCommits(stdout)[0] || null
}

async function fetchRemote(stream) {
  const origin = REMOTE_URL || (await git(['remote', 'get-url', 'origin'])).stdout.trim()
  const url = REMOTE_URL || toHttpsRemote(origin)
  if (!url) throw new Error(`Onbekende git-remote: ${origin}`)
  await git(
    ['fetch', '--no-tags', url, `+refs/heads/${BRANCH}:refs/remotes/origin/${BRANCH}`],
    { stream, auth: url.startsWith('https://') ? gitAuthConfig(url, GIT_TOKEN) : [] },
  )
}

async function check() {
  await fetchRemote(false)
  const remoteRef = `refs/remotes/origin/${BRANCH}`
  const [current, latest, log, count] = await Promise.all([
    commitInfo('HEAD'),
    commitInfo(remoteRef),
    git(['log', `--format=${COMMIT_FORMAT}`, '-n', '50', `HEAD..${remoteRef}`]),
    git(['rev-list', '--count', `HEAD..${remoteRef}`]),
  ])
  lastCheck = {
    checkedAt: new Date().toISOString(),
    current,
    latest,
    behind: Number(count.stdout.trim()) || 0,
    commits: parseCommits(log.stdout),
    updateAvailable: Boolean(current && latest && current.sha !== latest.sha),
  }
  return lastCheck
}

async function waitForWeb() {
  const deadline = Date.now() + HEALTH_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const response = await fetch(WEB_HEALTH_URL, { signal: AbortSignal.timeout(5000) })
      if (response.ok) return
    } catch {
      // Still starting.
    }
    await new Promise(resolve => setTimeout(resolve, 3000))
  }
  throw new Error(`De website reageerde niet binnen ${Math.round(HEALTH_TIMEOUT_MS / 60000)} minuten na het herstarten.`)
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`
}

// The sidecar never recreates itself mid-update (that would kill the process
// driving the update). Afterwards a short-lived helper container, outside the
// Compose project, rebuilds it; Compose only recreates it when it changed.
async function refreshSelf() {
  const command = ['docker', ...composeArgs(), 'up', '-d', '--build', '--no-deps', context.service].map(shellQuote).join(' ')
  await run('docker', [
    'run', '-d', '--rm',
    '--name', `${context.project}-updater-refresh-${Date.now()}`,
    '--volumes-from', context.containerId,
    '--entrypoint', 'sh',
    context.imageId,
    '-c', `sleep 3; exec ${command}`,
  ])
  log('Updater wordt op de achtergrond bijgewerkt.')
}

async function finish(phase, message) {
  await setState({ phase, step: null, message, finishedAt: new Date().toISOString() })
  log(message)
  await persist()
}

async function runUpdate() {
  state = {
    phase: 'preparing',
    step: null,
    message: null,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    fromSha: null,
    toSha: null,
    log: [],
  }
  let from = null
  let checkedOut = false
  try {
    await setState({ step: 'Controleren op updates' })
    await fetchRemote(true)
    from = (await git(['rev-parse', 'HEAD'])).stdout.trim()
    const to = (await git(['rev-parse', `refs/remotes/origin/${BRANCH}`])).stdout.trim()
    await setState({ fromSha: from, toSha: to })
    if (from === to) {
      await finish('idle', 'Al up-to-date; er was niets bij te werken.')
      return
    }

    await setState({ phase: 'updating', step: 'Nieuwe code ophalen' })
    await git(['checkout', '--force', '-B', BRANCH, to], { stream: true })
    checkedOut = true

    const config = JSON.parse((await compose(['config', '--format', 'json'])).stdout)
    const services = servicesToUpdate(Object.keys(config.services || {}).join('\n'), context.service)
    const buildable = services.filter(name => config.services[name]?.build)

    await setState({ step: 'Containers bouwen' })
    await compose(['build', ...buildable], { stream: true })

    await setState({ step: 'Containers herstarten' })
    checkedOut = false // Past this point the new code is live; do not reset the checkout.
    await compose(['up', '-d', ...services], { stream: true })

    await setState({ step: 'Wachten tot de website reageert' })
    await waitForWeb()

    lastCheck = null
    await finish('succeeded', `Bijgewerkt naar ${to.slice(0, 7)}.`)
    try {
      await refreshSelf()
    } catch (error) {
      log(`Updater zelf bijwerken is niet gelukt: ${error.message}`)
    }
  } catch (error) {
    if (checkedOut && from) {
      log('Bouwen is mislukt; de vorige versie blijft actief en de code wordt teruggezet.')
      try {
        await git(['checkout', '--force', '-B', BRANCH, from], { stream: true })
      } catch (resetError) {
        log(`Terugzetten is mislukt: ${resetError.message}`)
      }
    }
    await finish('failed', error instanceof Error ? error.message : String(error))
  }
}

function authorized(request) {
  if (!TOKEN) return false
  const header = request.headers.authorization || ''
  const given = Buffer.from(header.replace(/^Bearer\s+/i, ''))
  const expected = Buffer.from(TOKEN)
  return given.length === expected.length && timingSafeEqual(given, expected)
}

function send(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json', 'cache-control': 'no-store' })
  response.end(JSON.stringify(body))
}

async function status() {
  let current = null
  if (!configError) {
    try {
      current = await commitInfo('HEAD')
    } catch {
      // Reported through configError on the next request if it persists.
    }
  }
  return {
    configured: !configError,
    configError,
    branch: BRANCH,
    project: context?.project || null,
    current,
    state,
    lastCheck,
  }
}

const server = createServer(async (request, response) => {
  const path = new URL(request.url || '/', 'http://updater').pathname
  try {
    if (path === '/healthz') return send(response, 200, { ok: true })
    if (!authorized(request)) return send(response, 401, { error: 'Niet geautoriseerd' })

    if (request.method === 'GET' && path === '/maintenance') {
      return send(response, 200, { maintenance: MAINTENANCE_PHASES.has(state.phase), step: state.step })
    }
    if (request.method === 'GET' && path === '/status') return send(response, 200, await status())

    if (request.method === 'POST' && path === '/check') {
      if (configError) return send(response, 409, { error: configError })
      if (BUSY_PHASES.has(state.phase)) return send(response, 409, { error: 'Er loopt al een update.' })
      return send(response, 200, await check())
    }

    if (request.method === 'POST' && path === '/update') {
      if (configError) return send(response, 409, { error: configError })
      if (BUSY_PHASES.has(state.phase)) return send(response, 409, { error: 'Er loopt al een update.' })
      void runUpdate()
      return send(response, 202, { state })
    }

    return send(response, 404, { error: 'Niet gevonden' })
  } catch (error) {
    return send(response, 500, { error: redact(error instanceof Error ? error.message : String(error), SECRETS) })
  }
})

await loadState()
try {
  await discover()
  configError = validate()
} catch (error) {
  configError = error instanceof Error ? error.message : String(error)
}
if (configError) console.error(`Updater not configured: ${configError}`)
else console.log(`Updater ready for project ${context.project} (${context.workingDir}, branch ${BRANCH})`)

server.listen(PORT, () => console.log(`Updater listening on :${PORT}`))

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    server.close()
    void persist().finally(() => process.exit(0))
  })
}
