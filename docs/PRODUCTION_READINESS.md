# Production readiness

This document is the operational runbook for issue #19. It complements the launch checklist in the end-to-end phase.

## Backups

NightLight backs up all non-reproducible business data:

- PostgreSQL, via a custom-format `pg_dump`;
- uploaded media;
- generated social posts/documents;
- the persistent config directory.

The Unraid `backup` service runs `scripts/backup.sh` every 24 hours by default. Backups are written atomically beneath `${APP_DATA_ROOT}/backups` and retained for 14 days by default.

A second copy is written to `BACKUP_SECONDARY_ROOT`. Production should point this at storage that does **not** share the primary appdata failure domain—for example a separate Unraid share backed up to another machine/cloud target.

### Restore

Stop write traffic before restoring production.

1. Identify the desired `nightlight-YYYYMMDDTHHMMSSZ` backup.
2. Keep a copy of the current data before replacing anything.
3. Run the restore from a container/host with PostgreSQL client tools:
   `DATABASE_URL=... sh scripts/restore.sh /backups/nightlight-...`
4. Start the application and verify `/api/ready`.
5. Verify a recent gig, invoice, media asset and generated post.
6. Record the restore exercise date.

CI executes the exact backup and restore scripts against **two separate PostgreSQL 17 instances** on every change and weekly. The smoke test also verifies upload/generated/config file restoration.

## Monitoring / Uptime Kuma

Create these Uptime Kuma monitors:

- `GET https://djnightlight.nl/api/health` — process availability.
- `GET https://djnightlight.nl/api/ready` — process + database readiness.
- Staging equivalents for `dev.djnightlight.nl`.

Recommended interval: 60 seconds, 3 retries, notification after the retry threshold.

Admin → **Production status** surfaces:
- failed email jobs;
- failed Google Calendar sync jobs;
- failed payment records;
- pending/stale transactional outbox events;
- the most recent accepted Stripe webhook;
- Calendar/email credential state;
- the latest detected local backup.

Invalid Stripe webhook signatures and unexpected HTTP 5xx responses are emitted as structured JSON logs and remain visible through the container log stack (for example Dozzle).

## Structured logs

Every request gets an `x-request-id`. Access logs are JSON and include:
- request ID;
- method;
- path (never query strings);
- status;
- duration.

Do not log authorization headers, magic-link tokens, email bodies, payment secrets or request bodies.

## Security hardening

Implemented controls:

- centralized server-side staff/role checks on admin APIs;
- sealed secure session cookies in production;
- strict login, client portal and public-inquiry limits plus a broad public/auth/client API limit;
- portal tokens stored hashed, revocable and expiring;
- Stripe webhook signature validation and event deduplication;
- upload signature/dimension/size checks with random storage keys;
- security response headers: no-sniff, DENY framing, restrictive referrer/permissions policies;
- credentials remain server-only runtime configuration or encrypted settings;
- audit logs for business/security-sensitive mutations;
- production dependency audit in CI;
- backup/restore test in CI.

### Authorization review

When adding an admin endpoint, it must call `requireStaff` before reading or mutating private data. Owner-only system/security functions use `requireStaff(event, ['owner'])`. Public routes must expose only explicitly public fields. Client portal routes must resolve access through the hashed magic-link token and must never accept a gig ID as authorization.

### Secret rotation

If a secret is suspected exposed:
1. rotate it at the provider;
2. update the private Unraid environment/settings;
3. restart only the affected service;
4. verify the integration from Production status;
5. review structured/audit logs around the exposure window.

Do not place production secrets in GitHub issues, PR text, logs or committed `.env` files.

## Pre-launch readiness gate

Before production launch, all of the following must be true:

- CI quality, Docker, restore-test and security jobs are green.
- The latest backup is visible and a second-copy destination is configured.
- Uptime Kuma health/readiness monitors are active.
- Admin → Production status shows no unexplained failed jobs.
- Production email, Calendar and Stripe configuration has been verified.
- Production secrets are unique and not copied from staging.
- The launch/rollback checklist in the E2E phase is completed.
