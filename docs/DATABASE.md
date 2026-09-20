# Database development

DJ NightLight uses PostgreSQL with Drizzle ORM for typed application queries and schema definitions.

## Start PostgreSQL

```bash
docker compose -f compose.db.yml up -d
```

Copy `.env.example` to `.env` so `DATABASE_URL` points at the development database.

## Migrations

Committed migrations live as ordered SQL files in `db/migrations`.

Apply them manually when running outside Docker Compose:

```bash
npm run db:migrate
```

Docker Compose runs the same command automatically through the one-shot `migrate` service before the web service starts.

The migration runner:

- executes `.sql` files in filename order;
- records each applied migration in `nightlight_schema_migrations`;
- stores a SHA-256 checksum for every applied file;
- skips migrations that were already applied;
- fails if an already-applied migration file was changed;
- wraps each new migration in a transaction.

This repository originally used hand-authored SQL migrations, so the runtime does **not** depend on Drizzle Kit's `meta/_journal.json` metadata.

Generate a migration after changing the schema:

```bash
npm run db:generate
```

Review generated SQL before committing it. Once a migration has been applied to a shared environment, do not edit that file; create a new migration instead.

## Development seed

```bash
npm run db:seed
```

The seed script refuses to run when `NODE_ENV=production`.

## Conventions

- Primary IDs are PostgreSQL UUIDs.
- Timestamps are timezone-aware.
- Monetary values use fixed-precision numeric columns, never floating point.
- Gig deletion can use `deleted_at` when history needs to be retained.
- Database ports are only exposed to localhost in the development-only compose file.
