# Database development

DJ NightLight uses PostgreSQL and Drizzle ORM.

## Start PostgreSQL

```bash
docker compose -f compose.db.yml up -d
```

Copy `.env.example` to `.env` so `DATABASE_URL` points at the development database.

## Migrations

Apply committed migrations:

```bash
npm run db:migrate
```

Generate a new migration after changing the schema:

```bash
npm run db:generate
```

Never make production-only schema changes manually. Schema changes must be represented by committed migrations.

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
