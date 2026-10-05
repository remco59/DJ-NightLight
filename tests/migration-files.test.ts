import { readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { migrationChecksum, sortMigrationFiles } from '../scripts/migration-files'

describe('migration file runner', () => {
  it('runs only SQL files in deterministic filename order', () => {
    expect(sortMigrationFiles([
      '0004_landing_pages.sql',
      'meta',
      '0000_initial.sql',
      'README.md',
      '0002_gig_operations.sql',
    ])).toEqual([
      '0000_initial.sql',
      '0002_gig_operations.sql',
      '0004_landing_pages.sql',
    ])
  })

  it('changes the checksum when migration contents change', () => {
    expect(migrationChecksum('select 1;')).not.toBe(migrationChecksum('select 2;'))
    expect(migrationChecksum('select 1;')).toBe(migrationChecksum('select 1;'))
  })

  // The runner tracks applied migrations by filename, so already-applied files must
  // never be renamed. These two prefixes were duplicated historically; their relative
  // order is stable (alphabetical by full name). Do not add new duplicates.
  it('does not introduce new duplicate numeric prefixes', () => {
    const knownDuplicates = new Set(['0009', '0015'])
    const files = sortMigrationFiles(readdirSync(join(process.cwd(), 'db', 'migrations')))
    const byPrefix = new Map<string, string[]>()

    for (const file of files) {
      const prefix = file.split('_')[0]!
      byPrefix.set(prefix, [...(byPrefix.get(prefix) ?? []), file])
    }

    const unexpected = [...byPrefix].filter(([prefix, names]) => names.length > 1 && !knownDuplicates.has(prefix))
    expect(unexpected).toEqual([])
    expect(byPrefix.get('0009')).toEqual(['0009_google_calendar_sync.sql', '0009_stripe_settings.sql'])
    expect(byPrefix.get('0015')).toEqual(['0015_integration_settings.sql', '0015_stripe_bank_transfers.sql'])
  })
})
