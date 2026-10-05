# Deployment

DJ NightLight is designed to run on the existing Unraid server behind Nginx Proxy Manager (NPM) and Cloudflare.

## Environments

| Environment | Host | Data root |
| --- | --- | --- |
| Local | http://localhost:3000 | Docker named volume |
| Staging | https://dev.djnightlight.nl | /mnt/user/appdata/djnightlight-staging |
| Production | https://djnightlight.nl | /mnt/user/appdata/djnightlight |

Staging and production must use different databases, credentials, storage roots and session/auth secrets.

## Database migrations

Docker Compose applies committed Drizzle migrations automatically before the web application starts.

The startup order is:

```text
PostgreSQL healthy
      ↓
one-shot migrate service
      ↓
Nuxt web service
```

The migration container runs `npm run db:migrate` and exits successfully. The web service uses `depends_on: condition: service_completed_successfully`, so a schema migration failure prevents the application from starting against an incompatible database.

Migrations are designed to be re-run safely on every deployment. Do not remove the `migrate` service or manually edit the production schema.

For troubleshooting:

```bash
docker compose --env-file .env.production -f docker-compose.unraid.yml logs migrate
```

A successful run ends with:

```text
Database migrations completed.
```

## Local stack

```bash
cp .env.example .env
docker compose up --build
```

The local database is exposed only on localhost for development tools. On the first start the migration service creates the application schema and seeds any migration-defined default records, including the initial website content.

The local Compose stack sets `NUXT_SESSION_COOKIE_SECURE=false` so authentication also works when the app is opened over plain HTTP from another LAN device, for example `http://tower.local:3000`. Only use this opt-out on a trusted development network. Staging and production keep secure cookies enabled and must be served over HTTPS.

## Stripe payments

The owner sets Stripe up in **Admin → Settings → Online payments**, which walks through creating a restricted key, connecting the webhook (automatically on a public HTTPS site, or manually), and verifying the connection. Credentials entered there are stored AES-256-GCM encrypted, keyed from `NUXT_SESSION_PASSWORD` — rotating that password requires re-entering the Stripe credentials.

Alternatively (or as a fallback), configure a separate Stripe restricted API key and webhook signing secret per environment. Credentials saved in Settings take precedence over these variables:

- `STRIPE_RESTRICTED_KEY` — prefer an `rk_` key with **Checkout Sessions: Write** and **Customers: Write**. Customers permission is required to create/reuse the virtual bank account used by EUR bank transfers.
- `STRIPE_WEBHOOK_SECRET` — the `whsec_` secret for the endpoint below.

Enable **Bank transfer** under Stripe Dashboard → Payment methods before testing EUR bank transfers. NightLight creates/reuses one Stripe Customer per client so Stripe can provide EU virtual-bank-account instructions and reconcile incoming transfers.

Register `https://<your-host>/api/webhooks/stripe` for `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`, `checkout.session.expired`, and `payment_intent.payment_failed`. Bank transfers are asynchronous: Checkout first becomes pending and the async success/failure event updates NightLight once Stripe resolves the transfer. Test the complete flow in Stripe test mode before adding live credentials. Never commit either secret or expose it to client-side runtime configuration.

## Unraid directories

Create these before the first deployment:

```text
/mnt/user/appdata/djnightlight/
├── postgres/
├── uploads/
├── generated/
├── backups/
└── config/

/mnt/user/appdata/djnightlight-staging/
├── postgres/
├── uploads/
├── generated/
├── backups/
└── config/
```

The application container is disposable. User-generated and database data live outside it.

Optionally set `MEDIA_LIBRARY_PATH` to an existing folder with clips and photos to link them into the media library read-only, without copying (see [MEDIA_STORAGE.md](MEDIA_STORAGE.md#server-media-folder-linked-not-copied)).

## Staging

Copy `.env.staging.example` to a private environment file on Unraid and replace all placeholder secrets.

```bash
docker compose --env-file .env.staging -f docker-compose.unraid.yml up -d --build
```

Configure Nginx Proxy Manager:

- Host: `dev.djnightlight.nl`
- Forward hostname/IP: Unraid host
- Forward port: value of `APP_PORT` (default 3081 for staging)
- Websockets: enabled
- SSL: enabled

Cloudflare should point `dev.djnightlight.nl` to the same public endpoint used by NPM.

## Production

Use a different private environment file based on `.env.production.example`.

```bash
docker compose --env-file .env.production -f docker-compose.unraid.yml up -d --build
```

Configure NPM for `djnightlight.nl` to the production `APP_PORT`.

## Updates from Settings

The owner can update the server from **Admin → Settings → Software-updates**:

1. **Controleren op updates** fetches the configured branch (default `main`) from GitHub and lists the new commits.
2. **Nu bijwerken** checks out the new commit, rebuilds the images and restarts the stack with `docker compose up -d` — the same steps as the deploy workflows.

While the images are rebuilt and the containers restart, every page shows a maintenance page (HTTP 503 with `Retry-After`) and every API route answers 503. Health checks, `/api/maintenance` and payment webhooks keep working. Open browser tabs switch to the maintenance page on their next request, and the maintenance page reloads itself once the site is back. The old containers keep serving until the new images are built, so the only real downtime is the few seconds in which the web container is swapped.

If the build fails, the checkout is reset to the previous commit and the running version stays live; the log of the last run is shown in Settings.

### How it works

The `updater` service in `docker-compose.unraid.yml` (built from `Dockerfile.updater`, code in `scripts/updater/`) holds the Docker socket and the server checkout. It exposes a small API on the private `backend` network only; the web app calls it with `UPDATER_TOKEN`. It never recreates itself during an update — afterwards a short-lived helper container refreshes it when its own code or configuration changed.

The Docker socket gives the updater root-equivalent access to the host. Keep `UPDATER_TOKEN` secret and long; only owners can reach the Settings actions.

### Setup

Add to the stack's env file (see `.env.production.example`):

```text
UPDATER_TOKEN=<long random string, e.g. openssl rand -hex 32>
UPDATER_BRANCH=main
NIGHTLIGHT_REPO_PATH=/absolute/path/to/this/checkout
NIGHTLIGHT_ENV_FILE=/absolute/path/to/.env.production
UPDATER_GIT_TOKEN=<only for a private repository>
```

- `NIGHTLIGHT_REPO_PATH` must be the absolute host path of the checkout the stack is started from (the deploy workflows' `*_DEPLOY_PATH`). The checkout is mounted at that same path inside the updater so Compose resolves the relative paths in the compose file exactly like on the host. When it is wrong, Settings shows the value to use.
- `NIGHTLIGHT_ENV_FILE` is the absolute path of the env file itself; the updater passes it to `docker compose --env-file`.
- The updater fetches over HTTPS (an SSH `origin` is rewritten), so it needs no SSH keys. For a private repository create a fine-grained GitHub token with read-only **Contents** access to this repository. `UPDATER_REMOTE_URL` overrides the fetch URL if needed.
- The updater runs git as root, so files it checks out are owned by root. On Unraid the checkout normally is already.

Then start the stack once more with `docker compose --env-file <env file> -f docker-compose.unraid.yml up -d --build`. Staging and production each get their own updater, token and checkout.

Leave `UPDATER_TOKEN` empty to disable the feature; the local `docker-compose.yml` stack has no updater and Settings says updates are unavailable.

## Networks

The PostgreSQL container is only connected to the internal `backend` network and has no host port in Unraid deployment.

The migration container only joins the private backend network.

The web container joins both the internal backend network and the existing external NPM proxy network.

The updater joins the backend network and a separate `egress` network, because it needs outbound access to GitHub and the backend network is internal-only.

Change `PROXY_NETWORK` if the NPM Docker network on Unraid has another name.

## Health

- `/api/health` verifies the web process responds.
- `/api/ready` additionally verifies PostgreSQL connectivity.
- PostgreSQL has its own `pg_isready` container health check.

## Secrets

Never commit:

- production/staging environment files;
- database passwords;
- authentication secrets;
- Stripe keys;
- Google credentials;
- email-provider credentials.

Only `*.example` environment files belong in Git.

## Deployment policy

Until the application is mature, production deployment should be an explicit action after staging verification. CI/CD setup is handled separately in issue #4.
