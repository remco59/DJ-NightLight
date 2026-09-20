# DJ NightLight production runbook

This runbook is for the single NightLight organization running on Unraid behind Nginx Proxy Manager / Cloudflare.

## Monitoring

Configure Uptime Kuma with two HTTP monitors:

- `https://<production-host>/api/health` — process/liveness target.
- `https://<production-host>/api/ready` — database/readiness target. Alert on any non-2xx response.

Use **Admin → Operations** for application-level failure states:
- latest backup;
- latest automated restore test;
- failed email jobs;
- Google Calendar sync failures;
- failed payments;
- pending outbox events;
- recent Stripe webhook activity.

Container logs are JSON for worker failures so Dozzle or another log collector can filter by the `event` field.

## Backup policy

The `backup` service starts after migrations complete and runs `ops/backup.sh`.

Each backup contains:
- PostgreSQL custom-format dump;
- uploads/media archive;
- generated documents/posts archive;
- non-secret manifest and SHA-256 checksums.

Defaults:
- every 24 hours;
- keep 14 days locally;
- weekly restore verification.

Secrets are intentionally **not** copied into the backup archive. Keep deployment secrets in a separate password manager / secrets backup.

### Off-machine copy

Set:

```env
BACKUP_SECONDARY_ENABLED=true
BACKUP_SECONDARY_ROOT=/mnt/remotes/nightlight-backups
```

`BACKUP_SECONDARY_ROOT` must point to an actually off-machine mounted share (NAS, remote server, encrypted cloud mount, etc.). A second folder on the same Unraid array is not an off-machine backup.

## Automated restore verification

The `restore-test` service takes the newest backup, verifies checksums, creates a temporary PostgreSQL database, restores the dump, performs basic schema/table queries, records the result in `operations_events`, and removes the temporary database.

The service runs weekly by default. A green backup without a recent green restore test is not considered a verified backup.

## Manual restore

A production restore is destructive. Do not run it while the application is serving traffic.

1. Put the public route into maintenance mode or point NPM/Cloudflare away from NightLight.
2. Stop state-changing services:
   ```sh
   docker compose -f docker-compose.unraid.yml stop web backup restore-test
   ```
3. Inspect available backups:
   ```sh
   ls -lah "${APP_DATA_ROOT}/backups"
   ```
4. Choose the exact backup directory.
5. Run the guarded manual restore profile:
   ```sh
   CONFIRM_RESTORE=YES RESTORE_MEDIA=true \
   docker compose -f docker-compose.unraid.yml --profile manual run --rm \
     restore /backups/nightlight_YYYYMMDD_HHMMSS
   ```
6. Start migrations/web again:
   ```sh
   docker compose -f docker-compose.unraid.yml up -d migrate web backup restore-test
   ```
7. Verify `/api/ready`, sign-in, gigs, portal data, invoice history and media/generated assets.
8. Only then restore the public route.

If verification fails, keep traffic away and repeat with an earlier verified backup.

## Security review

Implemented controls:
- owner/staff authorization remains enforced server-side on admin APIs;
- session cookie is secure in production and SameSite=Lax;
- global anti-framing, MIME sniffing, referrer, permissions and baseline CSP headers;
- login, inquiry and portal endpoints are rate limited with bounded stores;
- portal links use random 256-bit tokens; only SHA-256 hashes are persisted;
- portal links expire and can be revoked;
- uploads are signature/dimension validated and receive random server-side paths;
- Stripe webhook signatures are validated before processing;
- operational/audit helper metadata redacts token/password/secret/API-key style fields;
- production CI blocks known **critical** runtime dependency vulnerabilities.

Known architecture constraint: rate limits are in-process because V1 runs one web replica. If NightLight becomes multi-replica, move rate-limit state to Redis/PostgreSQL before scaling.

## Production-readiness checklist

Complete these against the actual production environment before launch:

- [ ] `/api/health` and `/api/ready` green in Uptime Kuma.
- [ ] Latest backup is green in Admin → Operations.
- [ ] Latest restore test is green and recent.
- [ ] Secondary backup copy is enabled and points off-machine.
- [ ] Password manager contains current production secrets and recovery access.
- [ ] Owner bootstrap token has been removed after owner creation.
- [ ] Session password is unique and at least 32 random characters.
- [ ] Stripe uses intended live/test mode and correct webhook secret.
- [ ] Resend/email sending domain is verified.
- [ ] Google Calendar OAuth scope/account/calendar are correct.
- [ ] Cloudflare/NPM only routes intended public ports/hostnames.
- [ ] Admin users and roles reviewed.
- [ ] Admin → Operations has no unexplained persistent failures.
- [ ] Critical E2E suite from phase 7 passes.
- [ ] Rollback path from the launch checklist is understood before DNS/proxy cutover.
