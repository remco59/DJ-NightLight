import { describe, expect, it, vi } from 'vitest'

let params: Record<string, string | undefined> = {}
vi.stubGlobal('getRouterParam', (_event: unknown, name: string) => params[name])
vi.stubGlobal('createError', (input: { statusCode: number, statusMessage: string }) => Object.assign(new Error(input.statusMessage), input))

const { isUuid, requireUuidParam } = await import('../server/utils/route-params')
const event = {} as never

describe('route params', () => {
  it('accepts UUIDs', () => {
    params = { id: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' }
    expect(requireUuidParam(event, 'id')).toBe('3f2504e0-4f89-41d3-9a0c-0305e82c3301')
    expect(isUuid('00000000-0000-0000-0000-000000000000')).toBe(true)
  })

  it.each(['abc', '', '../etc', '3f2504e0-4f89-41d3-9a0c-0305e82c330', "1' or '1'='1", '3f2504e0-4f89-41d3-9a0c-0305e82c3301/x'])(
    'answers a non-UUID (%j) with 404 instead of reaching the database',
    (value) => {
      params = { id: value }
      expect(() => requireUuidParam(event, 'id')).toThrowError(expect.objectContaining({ statusCode: 404 }))
    },
  )

  it('answers a missing param with 404', () => {
    params = {}
    expect(() => requireUuidParam(event, 'id')).toThrowError(expect.objectContaining({ statusCode: 404 }))
  })
})
