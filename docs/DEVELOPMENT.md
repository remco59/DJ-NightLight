# Development

## Requirements

- Node.js 22+
- npm

## Setup

```bash
cp .env.example .env
npm install
npm run dev
```

`.env.example` lists all environment variables. On startup the server validates them (`server/utils/env-validation.ts`) and fails with a clear error if a required one (`DATABASE_URL`, `NUXT_SESSION_PASSWORD`) is missing or invalid. Keep the schema and `.env.example` in sync.

## Quality checks

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

## Accessibility check

`npm run test:a11y` (`e2e/a11y.ts`) runs [axe-core](https://github.com/dequelabs/axe-core) against the public pages (home, over, media, agenda, boeken including its error state, and every published landing page) at a desktop and a mobile size. It checks WCAG 2.0/2.1 level A and AA plus axe's best practices and fails on any violation. CI runs it after the E2E workflows, against the production build.

To run it locally, start the app (`npm run dev` or the production build), then:

```bash
E2E_BASE_URL=http://127.0.0.1:3000 A11Y_BROWSER_PATH=/path/to/chromium npm run test:a11y
```

Without `A11Y_BROWSER_PATH` it uses an installed Google Chrome. axe cannot measure colour contrast for text on gradients or background images, so check those by eye when you change the look of a page. Keep new interactive elements reachable with the keyboard and visible when focused (the global `:focus-visible` style does this).

## Git hooks

`npm install` sets up [husky](https://typicode.github.io/husky/) hooks (via the `prepare` script):

- **pre-commit**: runs `eslint --fix` on the staged `.js/.mjs/.ts/.vue` files (lint-staged). The commit is blocked if lint errors remain.
- **pre-push**: runs `npm run typecheck`. Type checking covers the whole project, so it runs when pushing instead of on every commit.

CI runs the same checks, so the hooks only give you the feedback earlier. In an emergency you can skip them with `git commit --no-verify` / `git push --no-verify`, but CI will still fail on the same problems.

## Application areas

- `/` — public website
- `/admin` — private back office (authentication follows in issue #5)
- `/client/:token` — client-portal route reserved for the magic-link flow
- `/api/health` — basic service health endpoint

Do not commit secrets. Add new environment keys to `.env.example` with safe placeholder values.

## Icons

The whole site (public pages and back office) uses [Lucide](https://lucide.dev/icons) through `@nuxt/icon`:

```vue
<Icon name="lucide:calendar-days" aria-hidden="true" />
```

- Icons are bundled with the app (`@iconify-json/lucide`); nothing is loaded from the Iconify CDN.
- Icons size with the surrounding text (`1em`) and use `currentColor`, so style them with `font-size` and `color`.
- Decorative icons get `aria-hidden="true"`. Icon-only buttons need an `aria-label` (and usually a `title`).
- For a button or link that leads with an icon, add the global `with-icon` class to space and align it.
- Use `<IconTimes />` for the "×" in dimensions and multipliers (`1080<IconTimes />1920`).
- Don't use Unicode glyphs or emoji (`▶ ✕ ↗ 🗑`) as icons, and don't put arrows in editable site copy: the templates add them.
- Video motion templates (Remotion) can't use `<Icon>`. They draw Lucide icons from `shared/lucide-icons.ts`, which is also the list users pick from in the editor's `icon` template fields. To offer another icon, add it there with its body copied from `@iconify-json/lucide`; a test checks that the bodies match the package.
