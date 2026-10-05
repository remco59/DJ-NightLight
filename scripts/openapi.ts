import { readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'
import { z } from 'zod'

/**
 * Builds the OpenAPI document for `server/api` from the route files themselves:
 * - path and method come from the Nitro file name (`gigs/[id]/duplicate.post.ts`);
 * - access comes from `requireStaff(event, [...roles])` or the kind of public/token route;
 * - request bodies and query parameters come from the zod schemas the route uses
 *   (converted with `z.toJSONSchema`), falling back to a plain object when a schema
 *   cannot be evaluated outside the route;
 * - standard error responses follow from what the route does (auth, validation,
 *   rate limiting, a path parameter).
 *
 * `npm run docs:openapi` writes the result to `docs/openapi.yaml`; a test fails when the
 * committed file is out of date, so the spec follows the routes.
 */

const root = resolve(import.meta.dirname, '..')
const apiRoot = join(root, 'server', 'api')

const METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const
type Method = typeof METHODS[number]

type Json = Record<string, unknown>

export type RouteFile = { file: string, method: Method, path: string, source: string }

const UUID_PARAMS = new Set(['id', 'linkId'])

function walk(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name)
    return statSync(full).isDirectory() ? walk(full) : [full]
  })
}

export function listRoutes(): RouteFile[] {
  const routes: RouteFile[] = []
  for (const file of walk(apiRoot).sort()) {
    const match = /^(.*)\.(get|post|put|patch|delete)\.ts$/.exec(relative(apiRoot, file).replaceAll('\\', '/'))
    if (!match) continue
    const segments = match[1]!.split('/').filter(segment => segment !== 'index')
    const path = `/api/${segments.map(segment => segment.replace(/^\[(.+)\]$/, '{$1}')).join('/')}`.replace(/\/$/, '')
    routes.push({ file, method: match[2] as Method, path, source: readFileSync(file, 'utf8') })
  }
  return routes.sort((a, b) => a.path.localeCompare(b.path) || METHODS.indexOf(a.method) - METHODS.indexOf(b.method))
}

// ---------------------------------------------------------------- schema evaluation

type FileInfo = {
  sourceFile: ts.SourceFile
  imports: Map<string, { module: string, imported: string }>
  consts: Map<string, ts.Expression>
}

const fileInfoCache = new Map<string, FileInfo>()
const moduleCache = new Map<string, Promise<Record<string, unknown> | null>>()

function fileInfo(file: string, source: string): FileInfo {
  const cached = fileInfoCache.get(file)
  if (cached) return cached
  const sourceFile = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  const imports = new Map<string, { module: string, imported: string }>()
  const consts = new Map<string, ts.Expression>()

  for (const statement of sourceFile.statements) {
    if (ts.isImportDeclaration(statement) && ts.isStringLiteral(statement.moduleSpecifier)) {
      const bindings = statement.importClause?.namedBindings
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) {
          imports.set(element.name.text, { module: statement.moduleSpecifier.text, imported: (element.propertyName ?? element.name).text })
        }
      }
    }
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations) {
        if (ts.isIdentifier(declaration.name) && declaration.initializer) consts.set(declaration.name.text, declaration.initializer)
      }
    }
  }

  const info = { sourceFile, imports, consts }
  fileInfoCache.set(file, info)
  return info
}

/** Only modules under shared/ are evaluated: they are pure and do not depend on Nitro globals. */
function loadSharedModule(fromFile: string, specifier: string) {
  if (!specifier.startsWith('.')) return Promise.resolve(null)
  const base = resolve(dirname(fromFile), specifier)
  if (!relative(join(root, 'shared'), base).split('\\').join('/').split('/').every(part => part !== '..')) return Promise.resolve(null)
  let cached = moduleCache.get(base)
  if (!cached) {
    cached = import(pathToFileURL(`${base}.ts`).href).catch(() => import(pathToFileURL(join(base, 'index.ts')).href)).catch(() => null) as Promise<Record<string, unknown> | null>
    moduleCache.set(base, cached)
  }
  return cached
}

function freeIdentifiers(node: ts.Node) {
  const names = new Set<string>()
  const visit = (child: ts.Node) => {
    const parent = child.parent
    const isPropertyName = parent && (
      (ts.isPropertyAccessExpression(parent) && parent.name === child)
      || (ts.isPropertyAssignment(parent) && parent.name === child)
    )
    if (ts.isIdentifier(child) && !isPropertyName) names.add(child.text)
    ts.forEachChild(child, visit)
  }
  visit(node)
  return names
}

/** Resolves a top-level name of a route file to a value (imported from shared/, or a local const). */
async function resolveName(file: string, source: string, name: string, seen = new Set<string>()): Promise<unknown> {
  if (seen.has(name)) throw new Error(`cycle on ${name}`)
  seen.add(name)
  const info = fileInfo(file, source)

  const imported = info.imports.get(name)
  if (imported) {
    const mod = await loadSharedModule(file, imported.module)
    if (mod && imported.imported in mod) return mod[imported.imported]
    throw new Error(`cannot import ${name}`)
  }

  const expression = info.consts.get(name)
  if (!expression) throw new Error(`unknown ${name}`)

  const scope: Record<string, unknown> = { z }
  for (const identifier of freeIdentifiers(expression)) {
    if (identifier === name || identifier === 'z' || scope[identifier] !== undefined) continue
    if (info.imports.has(identifier) || info.consts.has(identifier)) {
      try {
        scope[identifier] = await resolveName(file, source, identifier, new Set(seen))
      } catch {
        // not needed to build the schema, or a ReferenceError below says it was
      }
    }
  }
  const text = expression.getText(info.sourceFile)
  const javascript = ts.transpileModule(`const __value = (${text})`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText.replace(/^.*const __value = /s, '').replace(/;\s*$/, '')
  return new Function(...Object.keys(scope), `return (${javascript})`)(...Object.values(scope))
}

async function toJsonSchema(file: string, source: string, name: string): Promise<Json | null> {
  try {
    const schema = await resolveName(file, source, name)
    if (!(schema instanceof z.ZodType)) return null
    const json = z.toJSONSchema(schema, { unrepresentable: 'any', io: 'input', target: 'draft-2020-12' }) as Json
    delete json.$schema
    return json
  } catch {
    return null
  }
}

async function arrayConstant(file: string, source: string, name: string): Promise<string[] | null> {
  try {
    const value = await resolveName(file, source, name)
    if (Array.isArray(value) && value.every(item => typeof item === 'string')) return value as string[]
  } catch {
    // fall through to a text lookup for server-side constants
  }
  const imported = fileInfo(file, source).imports.get(name)
  if (!imported?.module.startsWith('.')) return null
  const target = resolve(dirname(file), imported.module)
  for (const candidate of [`${target}.ts`, join(target, 'index.ts')]) {
    try {
      const match = new RegExp(`export const ${imported.imported}\\b[^=]*=\\s*\\[([^\\]]*)\\]`).exec(readFileSync(candidate, 'utf8'))
      if (match) return [...match[1]!.matchAll(/'([^']+)'/g)].map(item => item[1]!)
    } catch {
      // try the next candidate
    }
  }
  return null
}

// ---------------------------------------------------------------- per-route analysis

const ERRORS: Record<string, string> = {
  400: 'Ongeldig verzoek',
  401: 'Niet ingelogd',
  403: 'Geen toegang voor deze rol',
  404: 'Niet gevonden',
  409: 'Conflict met de huidige status',
  422: 'De ingestuurde gegevens zijn ongeldig',
  429: 'Te veel verzoeken (zie Retry-After)',
}

const ERROR_NAMES: Record<string, string> = {
  400: 'BadRequest',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'NotFound',
  409: 'Conflict',
  422: 'Unprocessable',
  429: 'TooManyRequests',
}

function errorResponse(code: string) {
  return { $ref: `#/components/responses/${ERROR_NAMES[code]}` }
}

function operationId(method: string, path: string) {
  const words = path.replace('/api/', '').split('/').map(part => part.startsWith('{') ? `by-${part.slice(1, -1)}` : part).filter(Boolean)
  return method + words.map(word => word.replace(/(^|[-_])(\w)/g, (_m, _s, char: string) => char.toUpperCase())).map(word => word.charAt(0).toUpperCase() + word.slice(1)).join('')
}

function tagFor(path: string) {
  const [first, second] = path.replace('/api/', '').split('/')
  if (first === 'admin') return `admin/${second}`
  return first!
}

function jsDoc(source: string) {
  const match = /\/\*\*\s*([\s\S]*?)\*\//.exec(source)
  if (!match) return null
  const text = match[1]!.split('\n').map(line => line.replace(/^\s*\*\s?/, '').trim()).filter(Boolean).join(' ')
  return text || null
}

async function buildOperation(route: RouteFile) {
  const { source, file, method, path } = route
  const parameters: Json[] = []
  const responses: Record<string, unknown> = {}
  const operation: Json = { operationId: operationId(method, path), tags: [tagFor(path)] }

  const description = jsDoc(source)
  if (description) operation.description = description

  // Access
  const staff = /requireStaff\(\s*event\s*(?:,\s*([^)]+?))?\s*\)/.exec(source)
  if (staff) {
    let roles: string[] | null = null
    const argument = staff[1]?.trim()
    if (argument?.startsWith('[')) roles = [...argument.matchAll(/'([^']+)'/g)].map(item => item[1]!)
    else if (argument) roles = await arrayConstant(file, source, argument)
    operation.security = [{ staffSession: [] }]
    operation['x-roles'] = roles ?? 'any signed-in staff member'
    responses[401] = errorResponse('401')
    responses[403] = errorResponse('403')
  } else if (path.startsWith('/api/client/portal/')) {
    operation.security = []
    operation['x-access'] = 'Het geheime token in het pad ({token}) is de toegang tot het klantportaal'
  } else if (path === '/api/calendar/feed/{token}') {
    operation.security = []
    operation['x-access'] = 'Het geheime token in het pad ({token}) is de toegang tot de agenda-feed'
  } else if (path === '/api/webhooks/stripe') {
    operation.security = [{ stripeSignature: [] }]
  } else if (path === '/api/auth/bootstrap') {
    operation.security = [{ bootstrapToken: [] }]
  } else {
    operation.security = []
  }

  // Path parameters
  for (const name of [...path.matchAll(/\{(\w+)\}/g)].map(item => item[1]!)) {
    parameters.push({
      name,
      in: 'path',
      required: true,
      schema: UUID_PARAMS.has(name) && /requireUuidParam/.test(source) ? { type: 'string', format: 'uuid' } : { type: 'string' },
    })
  }
  if (parameters.length) responses[404] = errorResponse('404')

  // Query parameters
  const queryName = /(\w+)\.safeParse\(getQuery\(event\)\)/.exec(source)?.[1]
  if (queryName) {
    const schema = await toJsonSchema(file, source, queryName)
    const properties = (schema?.properties ?? {}) as Record<string, Json>
    const required = new Set((schema?.required ?? []) as string[])
    for (const [name, property] of Object.entries(properties)) parameters.push({ name, in: 'query', required: required.has(name), schema: property })
    responses[400] = errorResponse('400')
  } else if (/getQuery\(event\)/.test(source)) {
    const names = new Set<string>()
    for (const match of source.matchAll(/\bquery\.(\w+)|\bquery\['(\w+)'\]/g)) names.add(match[1] ?? match[2]!)
    for (const name of [...names].sort()) parameters.push({ name, in: 'query', required: false, schema: { type: 'string' } })
  }

  // Request body
  if (/readMultipartFormData/.test(source)) {
    operation.requestBody = { required: true, content: { 'multipart/form-data': { schema: { type: 'object' } } } }
    responses[422] = errorResponse('422')
  } else if (/readRawBody/.test(source)) {
    operation.requestBody = { required: true, content: { 'application/json': { schema: { type: 'string', description: 'Raw request body (signed payload)' } } } }
  } else if (/readValidatedBody|readBody/.test(source)) {
    const candidates = [
      /readValidatedBody\(\s*event\s*,\s*(\w+)\.parse\s*\)/.exec(source)?.[1],
      /(\w+)\.safeParse\(\s*await readBody\(event\)\s*\)/.exec(source)?.[1],
      ...[...source.matchAll(/\b(\w+)\.(?:safeParse|parse)\(/g)].map(match => match[1]),
    ].filter((name): name is string => Boolean(name) && !['JSON', 'Number', 'Date'].includes(name!))
    let schemaName: string | undefined
    let schema: Json | null = null
    for (const candidate of [...new Set(candidates)]) {
      schemaName ??= candidate
      schema = await toJsonSchema(file, source, candidate)
      if (schema) {
        schemaName = candidate
        break
      }
    }
    operation.requestBody = { required: true, content: { 'application/json': { schema: schema ?? { type: 'object' } } } }
    if (schemaName && !schema) operation['x-body-schema'] = `${schemaName} (defined in the route, not exported)`
    if (schemaName) responses[422] = errorResponse('422')
  }

  if (/assertRateLimit/.test(source)) responses[429] = errorResponse('429')

  // Success response
  const contentType = /setHeader\(\s*event\s*,\s*'content-type'\s*,\s*'([^']+)'/.exec(source)?.[1]?.split(';')[0]
  const binary = /createReadStream|sendStream|setHeader\(\s*event\s*,\s*'content-type'/.test(source)
  responses[200] = {
    description: 'Gelukt',
    content: binary
      ? { [contentType ?? 'application/octet-stream']: { schema: { type: 'string', format: 'binary' } } }
      : { 'application/json': { schema: { type: 'object' } } },
  }

  if (parameters.length) operation.parameters = parameters
  operation.responses = Object.fromEntries(Object.entries(responses).sort(([a], [b]) => Number(a) - Number(b)))
  return operation
}

const TAG_DESCRIPTIONS: Record<string, string> = {
  admin: 'Back office (ingelogde medewerkers)',
  auth: 'Inloggen, uitloggen en de eerste eigenaar aanmaken',
  public: 'Publieke website-inhoud en het contactformulier',
  client: 'Klantportaal via een persoonlijke link',
  calendar: 'Agenda-feed (ICS)',
  webhooks: 'Inkomende webhooks van externe diensten',
}

export async function buildOpenApiDocument() {
  const routes = listRoutes()
  const paths: Record<string, Record<string, unknown>> = {}
  const tags = new Set<string>()

  for (const route of routes) {
    const operation = await buildOperation(route)
    paths[route.path] ??= {}
    paths[route.path]![route.method] = operation
    for (const tag of operation.tags as string[]) tags.add(tag)
  }

  return {
    openapi: '3.1.0',
    info: {
      title: 'DJ NightLight API',
      version: '1.0.0',
      description: [
        'Gegenereerd uit `server/api` met `npm run docs:openapi`. Niet met de hand bewerken.',
        '',
        'Admin-routes vragen een ingelogde sessie (cookie `nuxt-session`) met een van de genoemde rollen (`x-roles`).',
        'Klantportaal- en agenda-feed-routes hebben een geheim token in het pad (`x-access`); alle andere routes zonder beveiliging zijn publiek.',
        'Foutresponses hebben de vorm `{ statusCode, statusMessage }`.',
        'De antwoord-bodies zijn niet per route beschreven; zie de route-broncode voor de precieze velden.',
      ].join('\n'),
    },
    tags: [...tags].sort().map((name) => {
      const group = name.split('/')[0]!
      return { name, ...(TAG_DESCRIPTIONS[group] ? { description: TAG_DESCRIPTIONS[group] } : {}) }
    }),
    paths,
    components: {
      responses: Object.fromEntries(Object.entries(ERROR_NAMES).map(([code, name]) => [name, {
        description: ERRORS[code],
        content: { 'application/json': { schema: { $ref: '#/components/schemas/Error' } } },
      }])),
      securitySchemes: {
        staffSession: { type: 'apiKey', in: 'cookie', name: 'nuxt-session', description: 'Sessiecookie na `POST /api/auth/login`' },
        stripeSignature: { type: 'apiKey', in: 'header', name: 'stripe-signature', description: 'Handtekening van Stripe over de ruwe body' },
        bootstrapToken: { type: 'apiKey', in: 'header', name: 'x-bootstrap-token', description: 'Eenmalige `OWNER_BOOTSTRAP_TOKEN` om de eerste eigenaar aan te maken' },
      },
      schemas: {
        Error: {
          type: 'object',
          required: ['statusCode', 'statusMessage'],
          properties: {
            statusCode: { type: 'integer' },
            statusMessage: { type: 'string', description: 'Korte foutmelding (Nederlands)' },
          },
        },
      },
    },
  }
}
