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

## Networks

The PostgreSQL container is only connected to the internal `backend` network and has no host port in Unraid deployment.

The migration container only joins the private backend network.

The web container joins both the internal backend network and the existing external NPM proxy network.

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
