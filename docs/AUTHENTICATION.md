# Authentication

DJ NightLight uses `nuxt-auth-utils` for encrypted/sealed cookie sessions. Staff accounts are stored in PostgreSQL.

## Required secret

`NUXT_SESSION_PASSWORD` must be a strong secret of at least 32 characters and must be different between staging and production.

## Creating the first owner

The owner bootstrap endpoint only works when:

1. `OWNER_BOOTSTRAP_TOKEN` is configured; and
2. the users table is still empty.

Example:

```bash
curl -X POST https://dev.djnightlight.nl/api/auth/bootstrap \
  -H 'content-type: application/json' \
  -H 'x-bootstrap-token: YOUR_PRIVATE_BOOTSTRAP_TOKEN' \
  -d '{"email":"you@example.com","name":"Remco","password":"a-long-unique-password"}'
```

After the first owner exists, the endpoint refuses to create another account. Remove the bootstrap token from the runtime environment afterwards.

## Sessions

The encrypted session contains only the minimum staff identity needed by the UI:

- user id;
- email;
- name;
- role;
- session version.

Sensitive admin APIs re-load the user from PostgreSQL and verify that the account is active and its session version still matches.

Incrementing `session_version` revokes all existing sessions for that user. The initial admin endpoint `POST /api/admin/session/revoke-all` does this for the current user and logs them out.

## Roles

The authorization model already recognizes:

- owner;
- DJ;
- manager;
- content editor.

V1 exposes only the owner workflow. Future UI can add accounts without replacing the session/authorization model.

## Login protection

Login attempts are rate-limited per IP/email pair. This in-process limiter is appropriate for the initial single web instance. If the application is scaled horizontally later, move the limiter to a shared store.

All sensitive API endpoints must call the central `requireStaff` helper (with an allowed-role list when needed); hiding controls in the browser is not authorization.
