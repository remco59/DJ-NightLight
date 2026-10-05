import { writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { stringify } from 'yaml'
import { buildOpenApiDocument } from './openapi'

const target = join(import.meta.dirname, '..', 'docs', 'openapi.yaml')
const document = await buildOpenApiDocument()

await writeFile(target, stringify(document, { lineWidth: 0 }))
console.log(`Wrote ${target} (${Object.keys(document.paths).length} paths)`)
