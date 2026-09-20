import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { migrationChecksum, sortMigrationFiles } from './migration-files'
import { sql } from '../server/utils/db'

const migrationsFolder = join(process.cwd(), 'db', 'migrations')

async function runMigrations() {
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "nightlight_schema_migrations" (
      "name" text PRIMARY KEY NOT NULL,
      "checksum" text NOT NULL,
      "applied_at" timestamptz DEFAULT now() NOT NULL
    )
  `)

  const files = sortMigrationFiles(await readdir(migrationsFolder))

  for (const file of files) {
    const fullPath = join(migrationsFolder, file)
    const contents = await readFile(fullPath, 'utf8')
    const checksum = migrationChecksum(contents)

    const existing = await sql<[{ checksum: string }]>`
      SELECT "checksum"
      FROM "nightlight_schema_migrations"
      WHERE "name" = ${file}
      LIMIT 1
    `

    const applied = existing[0]

    if (applied) {
      if (applied.checksum !== checksum) {
        throw new Error(
          `Migration ${file} was already applied but its contents have changed. `
          + 'Create a new migration instead of editing an applied migration.',
        )
      }

      console.log(`Migration ${file} already applied; skipping.`)
      continue
    }

    console.log(`Applying migration ${file}…`)

    await sql.begin(async (transaction) => {
      await transaction.unsafe(contents)
      await transaction`
        INSERT INTO "nightlight_schema_migrations" ("name", "checksum")
        VALUES (${file}, ${checksum})
      `
    })

    console.log(`Applied migration ${file}.`)
  }

  console.log('Database migrations completed.')
}

try {
  await runMigrations()
} catch (error) {
  console.error('Database migration failed.')
  console.error(error)
  process.exitCode = 1
} finally {
  await sql.end()
}
