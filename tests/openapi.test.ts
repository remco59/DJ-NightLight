import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { stringify } from 'yaml'
import { describe, expect, it } from 'vitest'
import { buildOpenApiDocument, listRoutes } from '../scripts/openapi'

const specPath = join(import.meta.dirname, '..', 'docs', 'openapi.yaml')
const regenerate = 'Run `npm run docs:openapi` and commit docs/openapi.yaml.'

describe('OpenAPI spec', () => {
  it('has an entry for every route file, and none for removed routes', async () => {
    const document = await buildOpenApiDocument()
    const expected = listRoutes().map(route => `${route.method.toUpperCase()} ${route.path}`).sort()
    const documented = Object.entries(document.paths)
      .flatMap(([path, operations]) => Object.keys(operations).map(method => `${method.toUpperCase()} ${path}`))
      .sort()

    expect(documented).toEqual(expected)
  })

  it('is up to date with the routes', async () => {
    const generated = stringify(await buildOpenApiDocument(), { lineWidth: 0 })
    expect(readFileSync(specPath, 'utf8'), `docs/openapi.yaml is out of date. ${regenerate}`).toBe(generated)
  })

  it('gives every operation a unique id and a documented access rule', async () => {
    const document = await buildOpenApiDocument()
    const operations = Object.values(document.paths).flatMap(path => Object.values(path)) as Array<Record<string, unknown>>
    const ids = operations.map(operation => operation.operationId)

    expect(new Set(ids).size).toBe(ids.length)
    for (const operation of operations) {
      expect(Array.isArray(operation.security), String(operation.operationId)).toBe(true)
    }
  })

  it('requires a staff session, with roles, for every admin route', async () => {
    const document = await buildOpenApiDocument()
    for (const [path, operations] of Object.entries(document.paths)) {
      if (!path.startsWith('/api/admin/')) continue
      for (const [method, operation] of Object.entries(operations) as Array<[string, Record<string, unknown>]>) {
        expect(operation.security, `${method.toUpperCase()} ${path}`).toEqual([{ staffSession: [] }])
        expect(operation['x-roles'], `${method.toUpperCase()} ${path}`).toBeTruthy()
      }
    }
  })

  it('describes request bodies from the zod schemas', async () => {
    const document = await buildOpenApiDocument()
    const login = (document.paths['/api/auth/login']!.post as { requestBody: { content: { 'application/json': { schema: { properties: Record<string, unknown>, required: string[] } } } } })
    const schema = login.requestBody.content['application/json'].schema

    expect(Object.keys(schema.properties)).toEqual(expect.arrayContaining(['email', 'password']))
    expect(schema.required).toEqual(expect.arrayContaining(['email', 'password']))
  })
})
