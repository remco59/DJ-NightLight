# Deployment

DJ NightLight is designed to run on the existing Unraid server behind Nginx Proxy Manager (NPM) and Cloudflare.

## Environments

| Environment | Host | Data root |
| --- | --- | --- |
| Local | http://localhost:3000 | Docker named volume |
| Staging | https://dev.djnightlight.nl | /mnt/user/appdata/djnightlight-staging |
| Production | https://djnightlight.nl | /mnt/user/appdata/djnightlight |

Staging and production must use different databases, credentials, storage roots and session/auth secrets.

## Local stack

```bash
cp .env.example .env
docker compose up --build
```

The local database is exposed only on localhost for development tools.

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
