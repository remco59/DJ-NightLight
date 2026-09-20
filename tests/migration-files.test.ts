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
})
