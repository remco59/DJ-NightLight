# Production launch and rollback checklist

Merging `main` does **not** launch DJ NightLight. Production deployment remains a deliberate, manual action after this checklist is completed.

## 1. Required CI gates

For the exact commit that will be deployed, confirm all CI jobs are green:

- Quality: lint, TypeScript, unit tests and production build.
- Docker: production image builds.
- Security: no high/critical production dependency advisory.
- Restore test: database + persistent files restore into an independent environment.
- E2E: critical NightLight workflows pass against a clean PostgreSQL database and production Nuxt build.

Do not deploy a different commit from the one that passed these gates.

## 2. Staging verification

Deploy the candidate commit to staging first.

- [ ] `https://dev.djnightlight.nl/api/health` is healthy.
- [ ] `https://dev.djnightlight.nl/api/ready` is ready.
- [ ] Owner login works.
- [ ] Create a disposable staging lead and move it to Booked.
- [ ] Client portal invitation opens and can be submitted on mobile.
- [ ] A staging invoice can be finalized.
- [ ] Stripe **test mode** Checkout/webhook flow reaches Paid.
- [ ] Google Calendar test/staging synchronization updates one event without duplicates.
- [ ] Email test-send arrives from the verified sending domain.
- [ ] Upload a photo and generate 1:1, 4:5 and 9:16 social outputs.
- [ ] Edit one harmless website field and verify the public render.
- [ ] Confirm a private booked gig never appears in the public agenda.
- [ ] Admin → Production status has no unexplained failures.

Remove/label disposable staging records after verification.

## 3. Backup and rollback readiness

Before changing production routing:

- [ ] A fresh production backup exists under the primary backup path.
- [ ] The second/off-machine copy is current.
- [ ] The latest automated restore-test CI job is green.
- [ ] Record the currently deployed NightLight Git commit/image.
- [ ] Record the current public-site routing target in Nginx Proxy Manager/Cloudflare.
- [ ] Keep the old public site available as a rollback target until the launch is accepted.

### Application rollback

If a new NightLight version is unhealthy but the database migration is compatible:

1. Restore the previous Git commit/image.
2. Rebuild/restart the web container.
3. Verify `/api/health` and `/api/ready`.
4. Verify owner login and one read-only business record.
5. Keep public traffic on the old site until the application is confirmed healthy.

### Data rollback / restore

Only restore a database/files backup when the data itself must be rolled back.

1. Stop NightLight write traffic.
2. Preserve a copy of the current state.
3. Follow `docs/PRODUCTION_READINESS.md` and `scripts/restore.sh`.
4. Verify a recent gig, invoice, media asset and generated post.
5. Re-enable traffic only after `/api/ready` and the business checks pass.

Never run a destructive data restore merely to roll back application code.

## 4. Production secrets and provider configuration

- [ ] Production database password is unique.
- [ ] `NUXT_SESSION_PASSWORD` is production-only and sufficiently random.
- [ ] Bootstrap token is removed/disabled after the owner account exists.
- [ ] Secure session cookies are enabled.
- [ ] Stripe is deliberately switched from test to the intended **live** credentials.
- [ ] Stripe live webhook points to `https://djnightlight.nl/api/webhooks/stripe`.
- [ ] Stripe webhook signing secret matches the live endpoint.
- [ ] Resend/email provider uses the verified NightLight sending domain.
- [ ] Google Calendar refresh token and calendar ID belong to the intended production calendar.
- [ ] No staging credential is reused in production.
- [ ] No secret is present in Git, PR text, screenshots or logs.

## 5. Routing and infrastructure

- [ ] Production Compose uses `/mnt/user/appdata/djnightlight`, not the staging data root.
- [ ] PostgreSQL has no public host port.
- [ ] Nginx Proxy Manager forwards the production hostname to the intended NightLight port.
- [ ] HTTPS certificate is valid.
- [ ] Cloudflare DNS/proxy points to the intended NPM endpoint.
- [ ] WebSocket/proxy settings match staging.
- [ ] Uptime Kuma monitors `/api/health` and `/api/ready`.
- [ ] Backup service is running and its second-copy destination is mounted.

## 6. Accessibility and performance smoke

Check on desktop and a real/narrow mobile viewport:

- [ ] Keyboard navigation reaches all public navigation and booking controls.
- [ ] Focus is visible.
- [ ] Images with meaningful content have useful alt text.
- [ ] Text remains readable over imagery.
- [ ] No horizontal overflow on Home, About, Media, Agenda and Booking.
- [ ] Booking form errors are understandable without color alone.
- [ ] Public pages have no obvious layout shift/broken media.
- [ ] Home/booking interaction remains usable on a normal mobile connection.
- [ ] Browser console has no recurring production errors.

Treat this as a smoke gate, not a replacement for a dedicated accessibility audit.

## 7. Launch action

Only after sections 1–6 are complete:

1. Deploy the exact green commit using the manual production deployment workflow or the documented Unraid production command.
2. Verify `/api/health` and `/api/ready`.
3. Verify Admin → Production status.
4. Switch/confirm public routing to NightLight.
5. Submit one real-world smoke booking using clearly identifiable test data, then remove/decline it.
6. Watch Uptime Kuma and structured logs during the initial launch window.
7. Keep the old-site rollback target available until acceptance is complete.

The production launch is complete only after the owner explicitly performs this launch action. A merge, CI success, or staging deployment alone is not a launch.

## Critical E2E coverage

CI's `e2e/nightlight-e2e.ts` exercises the NightLight side of these flows through real HTTP endpoints:

1. Public lead → authenticated Booked gig.
2. Portal invitation → questionnaire/terms/music-wishes submission.
3. Invoice creation/finalization → cryptographically signed Stripe webhook → Paid.
4. Gig edit → persistent Google Calendar synchronization boundary.
5. PNG media upload → branded generated-post persistence and retrieval.
6. CMS edit → public content API and homepage render.
7. Public agenda includes public bookings while excluding private/client/internal data.

Live Stripe, Google and email-provider permissions cannot be proven by an isolated CI environment, so those remain mandatory staging/production checks above.
