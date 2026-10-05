# API

The HTTP API is described in [`openapi.yaml`](./openapi.yaml) (OpenAPI 3.1). It covers all routes under `server/api`: the back-office (`/api/admin/*`), the public website content and contact form, the client portal, login, the calendar feed and the Stripe webhook.

## What the spec contains

- Path, method and path parameters (IDs are UUIDs; anything else answers `404`).
- Who may call it: `x-roles` lists the staff roles for `/api/admin/*` routes. Client-portal and calendar-feed routes are protected by the secret token in the path (`x-access`); the other routes without a `security` entry are public.
- Request bodies and query parameters, generated from the zod schemas the routes validate with. A few schemas are defined inside a route file; those are evaluated from the route source.
- The standard error responses a route can give (`401`, `403`, `404`, `422`, `429`, ...) as `{ statusCode, statusMessage }`.

The success responses are described as plain JSON objects (or files for downloads); the exact response fields are not part of the spec. Read the route for those.

## Keeping it up to date

The spec is generated from the route files, so do not edit it by hand:

```bash
npm run docs:openapi
```

Run this after adding, removing or changing a route (or the schema it validates with) and commit the result. A test (`tests/openapi.test.ts`) fails when `docs/openapi.yaml` no longer matches the routes, so CI catches a forgotten update.

To browse it, paste `openapi.yaml` into the [Swagger editor](https://editor.swagger.io/) or open it in any OpenAPI viewer.
